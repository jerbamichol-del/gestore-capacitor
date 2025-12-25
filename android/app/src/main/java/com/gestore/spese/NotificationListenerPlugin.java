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
public class NotificationListenerPlugin extends Plugin {

    private static final String TAG = "NotificationListenerPlugin";
    private BankNotificationReceiver receiver;

    @Override
    public void load() {
        super.load();
        Log.d(TAG, "========================================");
        Log.d(TAG, "NotificationListenerPlugin.load() called!");
        Log.d(TAG, "========================================");
        
        try {
            // Register broadcast receiver
            receiver = new BankNotificationReceiver();
            IntentFilter filter = new IntentFilter("com.gestore.spese.BANK_NOTIFICATION");
            getContext().registerReceiver(receiver, filter);
            Log.d(TAG, "✅ BroadcastReceiver registered successfully");
        } catch (Exception e) {
            Log.e(TAG, "❌ Failed to register BroadcastReceiver", e);
        }
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        Log.d(TAG, "NotificationListenerPlugin.handleOnDestroy() called");
        
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
        Log.d(TAG, "========================================");
        Log.d(TAG, "isEnabled() method called from JavaScript!");
        Log.d(TAG, "========================================");
        
        boolean enabled = isNotificationListenerEnabled();
        Log.d(TAG, "Notification listener enabled status: " + enabled);
        
        JSObject ret = new JSObject();
        ret.put("enabled", enabled);
        
        Log.d(TAG, "Returning result: " + ret.toString());
        call.resolve(ret);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        Log.d(TAG, "========================================");
        Log.d(TAG, "requestPermission() method called from JavaScript!");
        Log.d(TAG, "========================================");
        
        boolean currentlyEnabled = isNotificationListenerEnabled();
        Log.d(TAG, "Current enabled status: " + currentlyEnabled);
        
        if (!currentlyEnabled) {
            // Apri le impostazioni per abilitare il listener
            try {
                Log.d(TAG, "Opening notification listener settings...");
                Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
                getActivity().startActivity(intent);
                Log.d(TAG, "✅ Successfully opened notification listener settings");
            } catch (Exception e) {
                Log.e(TAG, "❌ Failed to open notification listener settings", e);
                JSObject ret = new JSObject();
                ret.put("enabled", false);
                call.resolve(ret);
                return;
            }
        } else {
            Log.d(TAG, "Notification listener already enabled");
        }
        
        // Restituisci lo stato attuale
        JSObject ret = new JSObject();
        ret.put("enabled", currentlyEnabled);
        
        Log.d(TAG, "Returning result: " + ret.toString());
        call.resolve(ret);
    }

    @PluginMethod
    public void startListening(PluginCall call) {
        Log.d(TAG, "========================================");
        Log.d(TAG, "startListening() method called from JavaScript!");
        Log.d(TAG, "========================================");
        
        if (!isNotificationListenerEnabled()) {
            Log.e(TAG, "❌ Notification listener not enabled");
            call.reject("Notification listener not enabled");
            return;
        }

        // Il servizio viene avviato automaticamente da Android
        // quando l'app ha il permesso
        Log.d(TAG, "✅ Notification listener is enabled, service will start automatically");
        JSObject ret = new JSObject();
        ret.put("listening", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void stopListening(PluginCall call) {
        Log.d(TAG, "stopListening() method called from JavaScript!");
        
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
        try {
            ComponentName cn = new ComponentName(getContext(), BankNotificationListenerService.class);
            Log.d(TAG, "Checking for component: " + cn.flattenToString());
            
            String flat = Settings.Secure.getString(
                getContext().getContentResolver(),
                "enabled_notification_listeners"
            );
            
            Log.d(TAG, "Enabled notification listeners: " + flat);
            
            boolean enabled = flat != null && flat.contains(cn.flattenToString());
            Log.d(TAG, "Is our service enabled? " + enabled);
            
            return enabled;
        } catch (Exception e) {
            Log.e(TAG, "Error checking if notification listener is enabled", e);
            return false;
        }
    }

    /**
     * BroadcastReceiver per ricevere notifiche dal BankNotificationListenerService
     */
    private class BankNotificationReceiver extends BroadcastReceiver {
        @Override
        public void onReceive(Context context, Intent intent) {
            Log.d(TAG, "========================================");
            Log.d(TAG, "BroadcastReceiver.onReceive() called!");
            Log.d(TAG, "Action: " + intent.getAction());
            Log.d(TAG, "========================================");
            
            if ("com.gestore.spese.BANK_NOTIFICATION".equals(intent.getAction())) {
                String dataJson = intent.getStringExtra("data");
                Log.d(TAG, "Received data JSON: " + dataJson);
                
                if (dataJson != null) {
                    try {
                        JSObject data = JSObject.fromJSONObject(new org.json.JSONObject(dataJson));
                        Log.d(TAG, "✅ Parsed notification data: " + data.toString());
                        
                        // Invia al JavaScript layer
                        Log.d(TAG, "Notifying JavaScript listeners...");
                        notifyListeners("notificationReceived", data);
                        Log.d(TAG, "✅ JavaScript listeners notified");
                    } catch (Exception e) {
                        Log.e(TAG, "❌ Error parsing notification data", e);
                    }
                } else {
                    Log.e(TAG, "❌ Received null data from broadcast");
                }
            } else {
                Log.w(TAG, "⚠️ Received broadcast with wrong action: " + intent.getAction());
            }
        }
    }
}
