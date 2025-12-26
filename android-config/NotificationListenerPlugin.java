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

public class NotificationListenerPlugin extends Plugin {

    private static final String TAG = "NotificationListenerPlugin";
    private BankNotificationReceiver receiver;

    @Override
    public void load() {
        super.load();
        // Register broadcast receiver
        receiver = new BankNotificationReceiver();
        IntentFilter filter = new IntentFilter("com.gestore.spese.BANK_NOTIFICATION");
        getContext().registerReceiver(receiver, filter);
        Log.d(TAG, "BroadcastReceiver registered");
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        // Unregister receiver
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
        boolean enabled = isNotificationListenerEnabled();
        JSObject ret = new JSObject();
        ret.put("enabled", enabled);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        Log.d(TAG, "requestPermission() called");
        
        if (!isNotificationListenerEnabled()) {
            Log.d(TAG, "Permission not enabled, opening settings...");
            
            // Open Android notification listener settings
            Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
            getActivity().startActivity(intent);
            
            Log.d(TAG, "Settings opened successfully");
            
            // Return enabled: false (user needs to enable manually)
            JSObject ret = new JSObject();
            ret.put("enabled", false);
            call.resolve(ret);
        } else {
            Log.d(TAG, "Permission already enabled");
            
            // Already enabled
            JSObject ret = new JSObject();
            ret.put("enabled", true);
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void startListening(PluginCall call) {
        if (!isNotificationListenerEnabled()) {
            call.reject("Notification listener not enabled");
            return;
        }

        // Il servizio viene avviato automaticamente da Android
        // quando l'app ha il permesso
        JSObject ret = new JSObject();
        ret.put("listening", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void stopListening(PluginCall call) {
        // Non possiamo fermare il servizio direttamente
        // L'utente deve disabilitarlo manualmente dalle impostazioni
        JSObject ret = new JSObject();
        ret.put("message", "Service cannot be stopped programmatically");
        call.resolve(ret);
    }

    /**
     * Verifica se il BankNotificationListenerService è abilitato
     */
    private boolean isNotificationListenerEnabled() {
        ComponentName cn = new ComponentName(getContext(), BankNotificationListenerService.class);
        String flat = Settings.Secure.getString(
            getContext().getContentResolver(),
            "enabled_notification_listeners"
        );
        return flat != null && flat.contains(cn.flattenToString());
    }

    /**
     * BroadcastReceiver per ricevere notifiche dal BankNotificationListenerService
     */
    private class BankNotificationReceiver extends BroadcastReceiver {
        @Override
        public void onReceive(Context context, Intent intent) {
            if ("com.gestore.spese.BANK_NOTIFICATION".equals(intent.getAction())) {
                String dataJson = intent.getStringExtra("data");
                
                if (dataJson != null) {
                    try {
                        JSObject data = JSObject.fromJSONObject(new org.json.JSONObject(dataJson));
                        Log.d(TAG, "Received bank notification: " + data.toString());
                        
                        // Invia al JavaScript layer
                        notifyListeners("notificationReceived", data);
                    } catch (Exception e) {
                        Log.e(TAG, "Error parsing notification data", e);
                    }
                }
            }
        }
    }
}
