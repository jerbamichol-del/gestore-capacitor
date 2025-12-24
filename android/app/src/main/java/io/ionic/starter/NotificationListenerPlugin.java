package io.ionic.starter;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Bundle;
import android.service.notification.StatusBarNotification;
import android.util.Log;
import androidx.localbroadcastmanager.content.LocalBroadcastManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONException;
import org.json.JSONObject;

@CapacitorPlugin(name = "NotificationListener")
public class NotificationListenerPlugin extends Plugin {
    private static final String TAG = "NotificationListener";
    private BroadcastReceiver notificationReceiver;

    @Override
    public void load() {
        super.load();
        setupNotificationReceiver();
    }

    private void setupNotificationReceiver() {
        notificationReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if ("io.ionic.starter.NOTIFICATION_RECEIVED".equals(intent.getAction())) {
                    String packageName = intent.getStringExtra("packageName");
                    String title = intent.getStringExtra("title");
                    String text = intent.getStringExtra("text");
                    long timestamp = intent.getLongExtra("timestamp", System.currentTimeMillis());

                    Log.d(TAG, "Notification received: " + packageName + " | " + title + " | " + text);

                    // Send to JS
                    JSObject ret = new JSObject();
                    ret.put("packageName", packageName);
                    ret.put("title", title);
                    ret.put("text", text);
                    ret.put("timestamp", timestamp);
                    notifyListeners("notificationReceived", ret);
                }
            }
        };

        IntentFilter filter = new IntentFilter("io.ionic.starter.NOTIFICATION_RECEIVED");
        LocalBroadcastManager.getInstance(getContext()).registerReceiver(notificationReceiver, filter);
        Log.d(TAG, "NotificationReceiver registered");
    }

    @PluginMethod
    public void isEnabled(PluginCall call) {
        boolean enabled = isNotificationListenerEnabled();
        JSObject ret = new JSObject();
        ret.put("enabled", enabled);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        Intent intent = new Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS");
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    private boolean isNotificationListenerEnabled() {
        try {
            String enabledListeners = android.provider.Settings.Secure.getString(
                getContext().getContentResolver(),
                "enabled_notification_listeners"
            );
            
            if (enabledListeners == null || enabledListeners.isEmpty()) {
                return false;
            }

            String packageName = getContext().getPackageName();
            return enabledListeners.contains(packageName);
        } catch (Exception e) {
            Log.e(TAG, "Error checking notification listener status", e);
            return false;
        }
    }

    @Override
    protected void handleOnDestroy() {
        if (notificationReceiver != null) {
            LocalBroadcastManager.getInstance(getContext()).unregisterReceiver(notificationReceiver);
        }
        super.handleOnDestroy();
    }
}
