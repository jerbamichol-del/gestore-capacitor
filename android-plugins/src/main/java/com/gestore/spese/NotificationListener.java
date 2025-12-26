package com.gestore.spese;

import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.provider.Settings;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NotificationListener")
public class NotificationListener extends Plugin {

    private static final String TAG = "NotificationListener";
    private BankNotificationReceiver receiver;

    @Override
    public void load() {
        super.load();
        Log.d(TAG, "✅ Plugin loaded: NotificationListener");
        
        receiver = new BankNotificationReceiver();
        IntentFilter filter = new IntentFilter("com.gestore.spese.BANK_NOTIFICATION");
        getContext().registerReceiver(receiver, filter);
        Log.d(TAG, "✅ BroadcastReceiver registered");
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        if (receiver != null) {
            try {
                getContext().unregisterReceiver(receiver);
                Log.d(TAG, "BroadcastReceiver unregistered");
            } catch (Exception e) {
                Log.e(TAG, "Error unregistering receiver", e);
            }
        }
    }

    @PluginMethod
    public void isEnabled(PluginCall call) {
        Log.d(TAG, "✅ isEnabled() called");
        boolean enabled = isNotificationListenerEnabled();
        JSObject ret = new JSObject();
        ret.put("enabled", enabled);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        Log.d(TAG, "✅ requestPermission() called");
        
        if (!isNotificationListenerEnabled()) {
            Log.d(TAG, "Permission not enabled, opening settings...");
            Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
            getActivity().startActivity(intent);
            
            JSObject ret = new JSObject();
            ret.put("enabled", false);
            call.resolve(ret);
        } else {
            JSObject ret = new JSObject();
            ret.put("enabled", true);
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void startListening(PluginCall call) {
        Log.d(TAG, "✅ startListening() called");
        if (!isNotificationListenerEnabled()) {
            call.reject("Notification listener not enabled");
            return;
        }

        JSObject ret = new JSObject();
        ret.put("listening", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void stopListening(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("message", "Service cannot be stopped programmatically");
        call.resolve(ret);
    }

    private boolean isNotificationListenerEnabled() {
        ComponentName cn = new ComponentName(getContext(), BankNotificationListenerService.class);
        String flat = Settings.Secure.getString(
            getContext().getContentResolver(),
            "enabled_notification_listeners"
        );
        return flat != null && flat.contains(cn.flattenToString());
    }

    private class BankNotificationReceiver extends BroadcastReceiver {
        @Override
        public void onReceive(Context context, Intent intent) {
            if ("com.gestore.spese.BANK_NOTIFICATION".equals(intent.getAction())) {
                String dataJson = intent.getStringExtra("data");
                
                if (dataJson != null) {
                    try {
                        JSObject data = JSObject.fromJSONObject(new org.json.JSONObject(dataJson));
                        Log.d(TAG, "Received bank notification: " + data.toString());
                        notifyListeners("notificationReceived", data);
                    } catch (Exception e) {
                        Log.e(TAG, "Error parsing notification data", e);
                    }
                }
            }
        }
    }
}
