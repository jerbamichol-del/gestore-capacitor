package com.gestorefinanze.app;

import android.content.ComponentName;
import android.content.Intent;
import android.provider.Settings;
import android.text.TextUtils;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NotificationListener")
public class NotificationListenerPlugin extends Plugin {

    @PluginMethod
    public void isEnabled(PluginCall call) {
        boolean enabled = isNotificationListenerEnabled();
        JSObject ret = new JSObject();
        ret.put("enabled", enabled);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (!isNotificationListenerEnabled()) {
            // Apri le impostazioni per abilitare il listener
            Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
            getActivity().startActivity(intent);
            
            JSObject ret = new JSObject();
            ret.put("opened", true);
            call.resolve(ret);
        } else {
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
     * Verifica se il NotificationListenerService è abilitato
     */
    private boolean isNotificationListenerEnabled() {
        ComponentName cn = new ComponentName(getContext(), NotificationListenerService.class);
        String flat = Settings.Secure.getString(
            getContext().getContentResolver(),
            "enabled_notification_listeners"
        );
        return flat != null && flat.contains(cn.flattenToString());
    }

    /**
     * Chiamato dal NotificationListenerService quando riceve una notifica bancaria
     */
    public void onBankNotificationReceived(JSObject data) {
        notifyListeners("notificationReceived", data);
    }
}
