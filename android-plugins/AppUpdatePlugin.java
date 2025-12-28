package com.gestore.spese.plugins;

import android.app.DownloadManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

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

            // IMPORTANT: Context.RECEIVER_NOT_EXPORTED overload exists only on API 33+
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                getContext().registerReceiver(downloadReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
            } else {
                getContext().registerReceiver(downloadReceiver, filter);
            }

            JSObject ret = new JSObject();
            ret.put("downloadId", downloadId);
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
            // Prefer the official URI from DownloadManager (more reliable than COLUMN_LOCAL_URI parsing)
            downloadUri = downloadManager.getUriForDownloadedFile(id);

            // Query download status
            DownloadManager.Query query = new DownloadManager.Query();
            query.setFilterById(id);
            Cursor cursor = downloadManager.query(query);

            if (cursor != null && cursor.moveToFirst()) {
                int statusIndex = cursor.getColumnIndex(DownloadManager.COLUMN_STATUS);
                int status = cursor.getInt(statusIndex);

                if (status == DownloadManager.STATUS_SUCCESSFUL) {
                    if (downloadUri == null) {
                        // Fallback to local uri if needed
                        int localUriIndex = cursor.getColumnIndex(DownloadManager.COLUMN_LOCAL_URI);
                        if (localUriIndex != -1) {
                            String uriString = cursor.getString(localUriIndex);
                            if (uriString != null) {
                                downloadUri = Uri.parse(uriString);
                            }
                        }
                    }

                    Log.d(TAG, "File downloaded URI: " + downloadUri);

                    if (downloadUri != null) {
                        // Play-Store-like behavior: show a notification that opens the installer when tapped.
                        showInstallNotification(downloadUri);
                    } else {
                        Log.e(TAG, "Download finished but URI is null");
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
            }

        } catch (Exception e) {
            Log.e(TAG, "Error handling download completion", e);
        } finally {
            // Unregister receiver
            if (downloadReceiver != null) {
                try {
                    getContext().unregisterReceiver(downloadReceiver);
                } catch (Exception ignored) {
                }
                downloadReceiver = null;
            }
        }
    }

    private void showInstallNotification(Uri downloadedApkUri) {
        try {
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
                .setContentTitle("Download completato")
                .setContentText("Tocca per installare l'aggiornamento")
                .setAutoCancel(true)
                .setContentIntent(pendingIntent)
                .setPriority(NotificationCompat.PRIORITY_HIGH);

            NotificationManagerCompat.from(getContext()).notify(INSTALL_NOTIFICATION_ID, builder.build());
            Log.d(TAG, "Install notification posted");

        } catch (Exception e) {
            Log.e(TAG, "Error showing install notification", e);
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

        // If we ever get a file:// URI, convert it via FileProvider
        if (apkUri != null && "file".equalsIgnoreCase(apkUri.getScheme())) {
            try {
                File file = new File(apkUri.getPath());
                uriToUse = androidx.core.content.FileProvider.getUriForFile(
                    getContext(),
                    getContext().getPackageName() + ".fileprovider",
                    file
                );
            } catch (Exception e) {
                Log.e(TAG, "FileProvider conversion failed", e);
                uriToUse = apkUri;
            }
        }

        intent.setDataAndType(uriToUse, "application/vnd.android.package-archive");
        return intent;
    }

    @PluginMethod
    public void getDownloadProgress(PluginCall call) {
        Long id = call.getLong("downloadId");
        if (id == null || id == -1) {
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
