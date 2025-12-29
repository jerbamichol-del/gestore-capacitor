package com.gestore.spese;

import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.util.Log;

import java.io.File;

/**
 * Cleanup receiver: runs after the app was updated (APK installed).
 * Deletes the downloaded update APK to avoid storage bloat.
 */
public class UpdateCleanupReceiver extends BroadcastReceiver {

    private static final String TAG = "UpdateCleanupReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;

        final String action = intent.getAction();
        Log.d(TAG, "onReceive action=" + action);

        if (!Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) {
            return;
        }

        try {
            SharedPreferences prefs = context.getSharedPreferences(AppUpdatePlugin.PREFS_NAME, Context.MODE_PRIVATE);
            long downloadId = prefs.getLong(AppUpdatePlugin.KEY_LAST_DOWNLOAD_ID, -1);
            String apkPath = prefs.getString(AppUpdatePlugin.KEY_LAST_APK_PATH, null);
            String fileName = prefs.getString(AppUpdatePlugin.KEY_LAST_FILE_NAME, null);

            // Remove DownloadManager entry (best effort)
            if (downloadId > 0) {
                try {
                    DownloadManager dm = (DownloadManager) context.getSystemService(Context.DOWNLOAD_SERVICE);
                    if (dm != null) {
                        dm.remove(downloadId);
                        Log.d(TAG, "Removed DownloadManager entry id=" + downloadId);
                    }
                } catch (Exception e) {
                    Log.w(TAG, "Failed to remove DownloadManager entry", e);
                }
            }

            // Delete the file
            boolean deleted = false;
            if (apkPath != null) {
                File f = new File(apkPath);
                if (f.exists()) {
                    deleted = f.delete();
                    Log.d(TAG, "Delete apkPath=" + apkPath + " deleted=" + deleted);
                } else {
                    Log.d(TAG, "apkPath not found on disk: " + apkPath);
                }
            }

            // Extra best-effort: if path missing, try deleting common filename in app-specific folder
            if (!deleted && fileName != null) {
                try {
                    File dir = context.getExternalFilesDir(android.os.Environment.DIRECTORY_DOWNLOADS);
                    if (dir != null) {
                        File f2 = new File(dir, fileName);
                        if (f2.exists()) {
                            boolean d2 = f2.delete();
                            Log.d(TAG, "Fallback delete fileName=" + f2.getAbsolutePath() + " deleted=" + d2);
                        }
                    }
                } catch (Exception e) {
                    Log.w(TAG, "Fallback delete failed", e);
                }
            }

            // Clear prefs so we don't delete anything else later
            prefs.edit().clear().apply();
            Log.d(TAG, "Cleanup completed");

        } catch (Exception e) {
            Log.e(TAG, "Cleanup failed", e);
        }
    }
}
