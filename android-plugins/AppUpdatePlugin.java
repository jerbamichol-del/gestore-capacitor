package com.gestore.spese.plugins;

import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.database.Cursor;
import android.net.Uri;
import android.os.Environment;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;

@CapacitorPlugin(name = "AppUpdate")
public class AppUpdatePlugin extends Plugin {

    private static final String TAG = "AppUpdatePlugin";
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
            // Get DownloadManager system service
            DownloadManager downloadManager = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
            if (downloadManager == null) {
                call.reject("DownloadManager not available");
                return;
            }

            // Create download request
            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
            request.setTitle(title);
            request.setDescription(description);
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName);
            request.setMimeType("application/vnd.android.package-archive");

            // Enqueue download
            downloadId = downloadManager.enqueue(request);
            Log.d(TAG, "Download started with ID: " + downloadId);

            // Register broadcast receiver for download completion
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

            getContext().registerReceiver(
                downloadReceiver,
                new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE),
                Context.RECEIVER_NOT_EXPORTED
            );

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
        try {
            // Query download status
            DownloadManager.Query query = new DownloadManager.Query();
            query.setFilterById(id);
            Cursor cursor = downloadManager.query(query);

            if (cursor != null && cursor.moveToFirst()) {
                int statusIndex = cursor.getColumnIndex(DownloadManager.COLUMN_STATUS);
                int status = cursor.getInt(statusIndex);

                if (status == DownloadManager.STATUS_SUCCESSFUL) {
                    // Get downloaded file URI
                    String uriString = cursor.getString(cursor.getColumnIndex(DownloadManager.COLUMN_LOCAL_URI));
                    Uri fileUri = Uri.parse(uriString);

                    Log.d(TAG, "File downloaded to: " + fileUri);

                    // Open APK for installation
                    installApk(fileUri);

                    // Notify JS side
                    JSObject ret = new JSObject();
                    ret.put("status", "completed");
                    ret.put("uri", fileUri.toString());
                    notifyListeners("downloadComplete", ret);
                } else {
                    Log.e(TAG, "Download failed with status: " + status);
                    JSObject ret = new JSObject();
                    ret.put("status", "failed");
                    notifyListeners("downloadComplete", ret);
                }
                cursor.close();
            }

            // Unregister receiver
            if (downloadReceiver != null) {
                getContext().unregisterReceiver(downloadReceiver);
                downloadReceiver = null;
            }

        } catch (Exception e) {
            Log.e(TAG, "Error handling download completion", e);
        }
    }

    private void installApk(Uri apkUri) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW);
            
            // For Android N and above, use FileProvider
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.N) {
                // Convert content:// to file:// for direct access
                File file = new File(apkUri.getPath());
                Uri contentUri = androidx.core.content.FileProvider.getUriForFile(
                    getContext(),
                    getContext().getPackageName() + ".fileprovider",
                    file
                );
                intent.setDataAndType(contentUri, "application/vnd.android.package-archive");
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            } else {
                intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
            }

            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            Log.d(TAG, "APK installation intent launched");

        } catch (Exception e) {
            Log.e(TAG, "Error installing APK", e);
        }
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
