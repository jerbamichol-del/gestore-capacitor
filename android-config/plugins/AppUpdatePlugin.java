package com.gestore.spese;

import android.app.DownloadManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.util.Log;
import android.widget.Toast;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;

@CapacitorPlugin(name = "AppUpdate")
public class AppUpdatePlugin extends Plugin {

    private static final String TAG = "AppUpdatePlugin";
    private static final String NOTIFICATION_CHANNEL_ID = "app_update";
    private static final int INSTALL_NOTIFICATION_ID = 7001;
    private static final int POLL_INTERVAL_MS = 1000; // Poll every 1 second

    private Handler handler;
    private Runnable pollRunnable;
    private long currentDownloadId = -1;
    private boolean installerLaunched = false;

    @Override
    public void load() {
        super.load();
        handler = new Handler(Looper.getMainLooper());
    }

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String url = call.getString("url");
        String fileName = call.getString("fileName", "app-update.apk");
        String title = call.getString("title", "Aggiornamento App");
        String description = call.getString("description", "Download in corso...");

        if (url == null || url.isEmpty()) {
            call.reject("URL is required");
            return;
        }

        try {
            DownloadManager downloadManager = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
            if (downloadManager == null) {
                call.reject("DownloadManager not available");
                return;
            }

            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
            request.setTitle(title);
            request.setDescription(description);
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName);
            request.setMimeType("application/vnd.android.package-archive");

            try {
                request.setAllowedNetworkTypes(DownloadManager.Request.NETWORK_WIFI | DownloadManager.Request.NETWORK_MOBILE);
                request.setAllowedOverMetered(true);
                request.setAllowedOverRoaming(true);
                request.setVisibleInDownloadsUi(true);
                request.addRequestHeader("User-Agent", "Android");
            } catch (Exception ignored) {
            }

            currentDownloadId = downloadManager.enqueue(request);
            installerLaunched = false;
            Log.d(TAG, "Download started with ID: " + currentDownloadId);

            // Start polling for completion
            startPolling(downloadManager, currentDownloadId);

            JSObject ret = new JSObject();
            ret.put("downloadId", String.valueOf(currentDownloadId));
            ret.put("status", "started");
            call.resolve(ret);

        } catch (Exception e) {
            Log.e(TAG, "Error starting download", e);
            call.reject("Download failed: " + e.getMessage());
        }
    }

    private void startPolling(final DownloadManager downloadManager, final long downloadId) {
        stopPolling(); // Stop any existing polling

        pollRunnable = new Runnable() {
            @Override
            public void run() {
                try {
                    checkDownloadStatus(downloadManager, downloadId);
                } catch (Exception e) {
                    Log.e(TAG, "Error in polling", e);
                }
                // Continue polling
                if (pollRunnable != null) {
                    handler.postDelayed(this, POLL_INTERVAL_MS);
                }
            }
        };

        handler.post(pollRunnable);
        Log.d(TAG, "[POLLING] Started polling for download ID: " + downloadId);
    }

    private void stopPolling() {
        if (pollRunnable != null) {
            handler.removeCallbacks(pollRunnable);
            pollRunnable = null;
            Log.d(TAG, "[POLLING] Stopped polling");
        }
    }

    private void checkDownloadStatus(DownloadManager downloadManager, long downloadId) {
        DownloadManager.Query query = new DownloadManager.Query();
        query.setFilterById(downloadId);
        Cursor cursor = downloadManager.query(query);

        if (cursor != null && cursor.moveToFirst()) {
            int statusIndex = cursor.getColumnIndex(DownloadManager.COLUMN_STATUS);
            int status = cursor.getInt(statusIndex);

            if (status == DownloadManager.STATUS_SUCCESSFUL) {
                Log.d(TAG, "[POLLING] Download successful - stopping polling");
                stopPolling();

                if (!installerLaunched) {
                    installerLaunched = true;
                    handleDownloadSuccess(downloadManager, downloadId);
                }
            } else if (status == DownloadManager.STATUS_FAILED) {
                Log.e(TAG, "[POLLING] Download failed - stopping polling");
                stopPolling();

                JSObject ret = new JSObject();
                ret.put("status", "failed");
                notifyListeners("downloadComplete", ret);
            }
            // For RUNNING, PENDING, PAUSED - keep polling

            cursor.close();
        } else {
            Log.w(TAG, "[POLLING] Download not found in query");
        }
    }

    private void handleDownloadSuccess(DownloadManager downloadManager, long downloadId) {
        Uri downloadUri = null;

        try {
            Log.d(TAG, "[SUCCESS] Handling successful download ID: " + downloadId);
            downloadUri = downloadManager.getUriForDownloadedFile(downloadId);
            Log.d(TAG, "[SUCCESS] URI from getUriForDownloadedFile: " + downloadUri);

            if (downloadUri == null) {
                // Fallback: try to get URI from cursor
                DownloadManager.Query query = new DownloadManager.Query();
                query.setFilterById(downloadId);
                Cursor cursor = downloadManager.query(query);

                if (cursor != null && cursor.moveToFirst()) {
                    int localUriIndex = cursor.getColumnIndex(DownloadManager.COLUMN_LOCAL_URI);
                    if (localUriIndex != -1) {
                        String uriString = cursor.getString(localUriIndex);
                        if (uriString != null) {
                            downloadUri = Uri.parse(uriString);
                            Log.d(TAG, "[SUCCESS] URI from cursor: " + downloadUri);
                        }
                    }
                    cursor.close();
                }
            }

            if (downloadUri != null) {
                Log.d(TAG, "[SUCCESS] Launching installer");
                openInstaller(downloadUri);
                showInstallNotification(downloadUri);
            } else {
                Log.e(TAG, "[SUCCESS] URI is null - cannot launch installer");
                Toast.makeText(getContext(), "Download completato ma impossibile trovare il file", Toast.LENGTH_LONG).show();
            }

            JSObject ret = new JSObject();
            ret.put("status", "completed");
            if (downloadUri != null) ret.put("uri", downloadUri.toString());
            notifyListeners("downloadComplete", ret);

        } catch (Exception e) {
            Log.e(TAG, "[SUCCESS] Error handling download success", e);
            Toast.makeText(getContext(), "Errore: " + e.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    private void openInstaller(Uri apkUri) {
        try {
            Log.d(TAG, "[INSTALLER] Opening installer for URI: " + apkUri);
            Log.d(TAG, "[INSTALLER] Android SDK: " + Build.VERSION.SDK_INT);

            // Check install permission (Android 8+)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                boolean canInstall = getContext().getPackageManager().canRequestPackageInstalls();
                Log.d(TAG, "[INSTALLER] canRequestPackageInstalls: " + canInstall);

                if (!canInstall) {
                    Log.w(TAG, "[INSTALLER] Cannot install - opening settings");
                    Toast.makeText(getContext(), "Abilita 'Installa app sconosciute' per questa app", Toast.LENGTH_LONG).show();

                    Intent settingsIntent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
                    settingsIntent.setData(Uri.parse("package:" + getContext().getPackageName()));
                    settingsIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getContext().startActivity(settingsIntent);
                    return;
                }
            }

            Intent installIntent = buildInstallIntent(apkUri);
            Log.d(TAG, "[INSTALLER] Starting install activity");
            getContext().startActivity(installIntent);
            Toast.makeText(getContext(), "Apertura installer...", Toast.LENGTH_SHORT).show();
            Log.d(TAG, "[INSTALLER] Install activity started successfully");

        } catch (Exception e) {
            Log.e(TAG, "[INSTALLER] Failed to open installer", e);
            Toast.makeText(getContext(), "Errore apertura installer: " + e.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    private void showInstallNotification(Uri downloadedApkUri) {
        try {
            Log.d(TAG, "[NOTIFICATION] Showing install notification");
            ensureNotificationChannel();

            Intent installIntent = buildInstallIntent(downloadedApkUri);

            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }

            PendingIntent pendingIntent = PendingIntent.getActivity(
                getContext(),
                0,
                installIntent,
                flags
            );

            NotificationCompat.Builder builder = new NotificationCompat.Builder(getContext(), NOTIFICATION_CHANNEL_ID)
                .setSmallIcon(android.R.drawable.stat_sys_download_done)
                .setContentTitle("Aggiornamento pronto")
                .setContentText("Tocca per installare")
                .setAutoCancel(true)
                .setContentIntent(pendingIntent)
                .setPriority(NotificationCompat.PRIORITY_HIGH);

            NotificationManagerCompat.from(getContext()).notify(INSTALL_NOTIFICATION_ID, builder.build());
            Log.d(TAG, "[NOTIFICATION] Notification posted");

        } catch (Exception e) {
            Log.e(TAG, "[NOTIFICATION] Error showing notification", e);
        }
    }

    private void ensureNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationManager nm = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        NotificationChannel existing = nm.getNotificationChannel(NOTIFICATION_CHANNEL_ID);
        if (existing != null) return;

        NotificationChannel channel = new NotificationChannel(
            NOTIFICATION_CHANNEL_ID,
            "Aggiornamenti app",
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Notifiche per installare aggiornamenti");
        nm.createNotificationChannel(channel);
    }

    private Intent buildInstallIntent(Uri apkUri) {
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

        Uri uriToUse = apkUri;

        if (apkUri != null && "file".equalsIgnoreCase(apkUri.getScheme())) {
            try {
                File file = new File(apkUri.getPath());
                Log.d(TAG, "[INTENT] File: " + file.getAbsolutePath() + ", exists: " + file.exists());

                String authority = getContext().getPackageName() + ".fileprovider";
                uriToUse = FileProvider.getUriForFile(getContext(), authority, file);
                Log.d(TAG, "[INTENT] FileProvider URI: " + uriToUse);
            } catch (Exception e) {
                Log.e(TAG, "[INTENT] FileProvider failed", e);
            }
        }

        intent.setDataAndType(uriToUse, "application/vnd.android.package-archive");
        return intent;
    }

    @PluginMethod
    public void getDownloadProgress(PluginCall call) {
        Long id = null;

        try {
            Object raw = call.getData() != null ? call.getData().get("downloadId") : null;
            if (raw instanceof Number) {
                id = ((Number) raw).longValue();
            } else if (raw instanceof String) {
                id = Long.parseLong((String) raw);
            }
        } catch (Exception ignored) {
        }

        if (id == null) {
            try {
                id = call.getLong("downloadId");
            } catch (Exception ignored) {
            }
        }
        if (id == null) {
            try {
                String idStr = call.getString("downloadId");
                if (idStr != null) id = Long.parseLong(idStr);
            } catch (Exception ignored) {
            }
        }

        if (id == null || id <= 0) {
            call.reject("Invalid download ID");
            return;
        }

        try {
            DownloadManager downloadManager = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
            if (downloadManager == null) {
                call.reject("DownloadManager not available");
                return;
            }

            DownloadManager.Query query = new DownloadManager.Query();
            query.setFilterById(id);
            Cursor cursor = downloadManager.query(query);

            if (cursor != null && cursor.moveToFirst()) {
                int bytesDownloadedIndex = cursor.getColumnIndex(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR);
                int bytesTotalIndex = cursor.getColumnIndex(DownloadManager.COLUMN_TOTAL_SIZE_BYTES);
                int statusIndex = cursor.getColumnIndex(DownloadManager.COLUMN_STATUS);

                long bytesDownloaded = cursor.getLong(bytesDownloadedIndex);
                long bytesTotal = cursor.getLong(bytesTotalIndex);
                int status = cursor.getInt(statusIndex);

                int progress = bytesTotal > 0 ? (int) ((bytesDownloaded * 100) / bytesTotal) : 0;
                if (status == DownloadManager.STATUS_SUCCESSFUL) progress = 100;

                JSObject ret = new JSObject();
                ret.put("progress", progress);
                ret.put("bytesDownloaded", bytesDownloaded);
                ret.put("bytesTotal", bytesTotal);
                ret.put("status", getStatusString(status));

                cursor.close();
                call.resolve(ret);
            } else {
                call.reject("Download not found");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error getting download progress", e);
            call.reject("Failed to get progress: " + e.getMessage());
        }
    }

    private String getStatusString(int status) {
        switch (status) {
            case DownloadManager.STATUS_PENDING:
                return "pending";
            case DownloadManager.STATUS_RUNNING:
                return "running";
            case DownloadManager.STATUS_PAUSED:
                return "paused";
            case DownloadManager.STATUS_SUCCESSFUL:
                return "successful";
            case DownloadManager.STATUS_FAILED:
                return "failed";
            default:
                return "unknown";
        }
    }

    @Override
    protected void handleOnDestroy() {
        stopPolling();
        super.handleOnDestroy();
    }
}
