package com.gestore.spese;

import android.app.DownloadManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
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

    private long downloadId = -1;
    private BroadcastReceiver downloadReceiver;

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

            // Be explicit to avoid OEM quirks.
            try {
                request.setAllowedNetworkTypes(DownloadManager.Request.NETWORK_WIFI | DownloadManager.Request.NETWORK_MOBILE);
            } catch (Exception ignored) {
            }
            try {
                request.setAllowedOverMetered(true);
                request.setAllowedOverRoaming(true);
            } catch (Exception ignored) {
            }
            try {
                request.setVisibleInDownloadsUi(true);
            } catch (Exception ignored) {
            }

            // GitHub release URLs often redirect; a UA header helps on some OEM stacks.
            try {
                request.addRequestHeader("User-Agent", "Android");
            } catch (Exception ignored) {
            }

            downloadId = downloadManager.enqueue(request);
            Log.d(TAG, "Download started with ID: " + downloadId);

            // (Re)register receiver for completion
            if (downloadReceiver != null) {
                try {
                    getContext().unregisterReceiver(downloadReceiver);
                } catch (Exception ignored) {
                }
                downloadReceiver = null;
            }

            downloadReceiver = new BroadcastReceiver() {
                @Override
                public void onReceive(Context context, Intent intent) {
                    long id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
                    if (id == downloadId) {
                        Log.d(TAG, "Download completed: " + id);
                        handleDownloadComplete(downloadManager, id);
                    }
                }
            };

            IntentFilter filter = new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                getContext().registerReceiver(downloadReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
            } else {
                getContext().registerReceiver(downloadReceiver, filter);
            }

            // IMPORTANT: return downloadId as STRING to avoid JS<->Java numeric coercion issues.
            JSObject ret = new JSObject();
            ret.put("downloadId", String.valueOf(downloadId));
            ret.put("status", "started");
            call.resolve(ret);

        } catch (Exception e) {
            Log.e(TAG, "Error starting download", e);
            call.reject("Download failed: " + e.getMessage());
        }
    }

    private void handleDownloadComplete(DownloadManager downloadManager, long id) {
        Uri downloadUri = null;

        try {
            Log.d(TAG, "[DIAGNOSTIC] handleDownloadComplete called for ID: " + id);
            downloadUri = downloadManager.getUriForDownloadedFile(id);
            Log.d(TAG, "[DIAGNOSTIC] getUriForDownloadedFile returned: " + downloadUri);

            DownloadManager.Query query = new DownloadManager.Query();
            query.setFilterById(id);
            Cursor cursor = downloadManager.query(query);

            if (cursor != null && cursor.moveToFirst()) {
                int statusIndex = cursor.getColumnIndex(DownloadManager.COLUMN_STATUS);
                int status = cursor.getInt(statusIndex);
                Log.d(TAG, "[DIAGNOSTIC] Download status: " + status + " (8=SUCCESSFUL)");

                if (status == DownloadManager.STATUS_SUCCESSFUL) {
                    if (downloadUri == null) {
                        int localUriIndex = cursor.getColumnIndex(DownloadManager.COLUMN_LOCAL_URI);
                        if (localUriIndex != -1) {
                            String uriString = cursor.getString(localUriIndex);
                            if (uriString != null) {
                                downloadUri = Uri.parse(uriString);
                                Log.d(TAG, "[DIAGNOSTIC] Parsed local URI from cursor: " + downloadUri);
                            }
                        }
                    }

                    if (downloadUri != null) {
                        Log.d(TAG, "[DIAGNOSTIC] About to call openInstaller with URI: " + downloadUri);
                        // AUTO-LAUNCH INSTALLER (primary path)
                        openInstaller(downloadUri);

                        // ALSO show notification as fallback (if auto-launch fails or user dismisses)
                        showInstallNotification(downloadUri);
                    } else {
                        Log.e(TAG, "[DIAGNOSTIC] Download finished but URI is null - cannot launch installer");
                        Toast.makeText(getContext(), "Download completato ma URI nullo - apri manualmente da Download", Toast.LENGTH_LONG).show();
                    }

                    JSObject ret = new JSObject();
                    ret.put("status", "completed");
                    if (downloadUri != null) ret.put("uri", downloadUri.toString());
                    notifyListeners("downloadComplete", ret);
                } else {
                    Log.e(TAG, "Download failed with status: " + status);
                    JSObject ret = new JSObject();
                    ret.put("status", "failed");
                    notifyListeners("downloadComplete", ret);
                }

                cursor.close();
            } else {
                Log.e(TAG, "[DIAGNOSTIC] Cursor is null or empty for download ID: " + id);
            }

        } catch (Exception e) {
            Log.e(TAG, "[DIAGNOSTIC] Exception in handleDownloadComplete", e);
        } finally {
            if (downloadReceiver != null) {
                try {
                    getContext().unregisterReceiver(downloadReceiver);
                } catch (Exception ignored) {
                }
                downloadReceiver = null;
            }
        }
    }

    private void openInstaller(Uri apkUri) {
        try {
            Log.d(TAG, "[DIAGNOSTIC] openInstaller called with URI: " + apkUri);
            Log.d(TAG, "[DIAGNOSTIC] Android SDK: " + Build.VERSION.SDK_INT);

            // Check if app can install unknown apps (Android 8+)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                boolean canInstall = getContext().getPackageManager().canRequestPackageInstalls();
                Log.d(TAG, "[DIAGNOSTIC] canRequestPackageInstalls() = " + canInstall);

                if (!canInstall) {
                    Log.w(TAG, "[DIAGNOSTIC] App cannot install unknown apps - opening settings");
                    Toast.makeText(getContext(), "Abilita 'Installa app sconosciute' per questa app", Toast.LENGTH_LONG).show();

                    // Open settings to enable "Install unknown apps" for this app
                    Intent settingsIntent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
                    settingsIntent.setData(Uri.parse("package:" + getContext().getPackageName()));
                    settingsIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getContext().startActivity(settingsIntent);
                    Log.d(TAG, "[DIAGNOSTIC] Settings activity started");
                    return;
                }
            } else {
                Log.d(TAG, "[DIAGNOSTIC] Android < 8.0 - no runtime install permission check needed");
            }

            Log.d(TAG, "[DIAGNOSTIC] Building install intent...");
            Intent installIntent = buildInstallIntent(apkUri);
            Log.d(TAG, "[DIAGNOSTIC] Install intent built: " + installIntent);
            Log.d(TAG, "[DIAGNOSTIC] Install intent data: " + installIntent.getData());
            Log.d(TAG, "[DIAGNOSTIC] Install intent type: " + installIntent.getType());
            Log.d(TAG, "[DIAGNOSTIC] Install intent flags: " + installIntent.getFlags());

            getContext().startActivity(installIntent);
            Log.d(TAG, "[DIAGNOSTIC] startActivity(installIntent) called - installer should open now");
            Toast.makeText(getContext(), "Apertura installer...", Toast.LENGTH_SHORT).show();

        } catch (Exception e) {
            Log.e(TAG, "[DIAGNOSTIC] Exception in openInstaller", e);
            Toast.makeText(getContext(), "Errore apertura installer: " + e.getMessage(), Toast.LENGTH_LONG).show();
            // Notification is already posted as fallback
        }
    }

    private void showInstallNotification(Uri downloadedApkUri) {
        try {
            Log.d(TAG, "[DIAGNOSTIC] showInstallNotification called");
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
            Log.d(TAG, "[DIAGNOSTIC] Install notification posted");

        } catch (Exception e) {
            Log.e(TAG, "[DIAGNOSTIC] Error showing install notification", e);
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
        Log.d(TAG, "[DIAGNOSTIC] Notification channel created");
    }

    private Intent buildInstallIntent(Uri apkUri) {
        Log.d(TAG, "[DIAGNOSTIC] buildInstallIntent - input URI: " + apkUri);
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

        Uri uriToUse = apkUri;

        if (apkUri != null && "file".equalsIgnoreCase(apkUri.getScheme())) {
            Log.d(TAG, "[DIAGNOSTIC] URI is file:// scheme - converting to FileProvider URI");
            try {
                File file = new File(apkUri.getPath());
                Log.d(TAG, "[DIAGNOSTIC] File path: " + file.getAbsolutePath());
                Log.d(TAG, "[DIAGNOSTIC] File exists: " + file.exists());
                Log.d(TAG, "[DIAGNOSTIC] File size: " + file.length());

                String authority = getContext().getPackageName() + ".fileprovider";
                Log.d(TAG, "[DIAGNOSTIC] FileProvider authority: " + authority);

                uriToUse = FileProvider.getUriForFile(
                    getContext(),
                    authority,
                    file
                );
                Log.d(TAG, "[DIAGNOSTIC] FileProvider URI: " + uriToUse);
            } catch (Exception e) {
                Log.e(TAG, "[DIAGNOSTIC] FileProvider conversion failed", e);
                uriToUse = apkUri;
            }
        } else {
            Log.d(TAG, "[DIAGNOSTIC] URI is not file:// - using as-is (likely content://)");
        }

        intent.setDataAndType(uriToUse, "application/vnd.android.package-archive");
        Log.d(TAG, "[DIAGNOSTIC] buildInstallIntent - final URI: " + uriToUse);
        return intent;
    }

    @PluginMethod
    public void getDownloadProgress(PluginCall call) {
        Long id = null;

        // Prefer reading from raw data to handle String/Double/Long/Integer reliably.
        try {
            Object raw = call.getData() != null ? call.getData().get("downloadId") : null;
            if (raw instanceof Number) {
                id = ((Number) raw).longValue();
            } else if (raw instanceof String) {
                id = Long.parseLong((String) raw);
            }
        } catch (Exception ignored) {
        }

        // Fallbacks
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
}
