package com.gestore.spese;

import android.app.Notification;
import android.content.ComponentName;
import android.content.Intent;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.util.Log;

import com.getcapacitor.JSObject;

import java.util.Arrays;
import java.util.List;

public class BankNotificationListenerService extends NotificationListenerService {

    private static final String TAG = "BankNotificationListener";
    
    // Static instance for access from plugin
    private static BankNotificationListenerService instance;
    
    // Package names delle app bancarie da monitorare
    private static final List<String> BANK_PACKAGES = Arrays.asList(
        "com.revolut.revolut",           // Revolut
        "com.paypal.android.p2pmobile",  // PayPal
        "it.poste.postepay",             // Postepay
        "com.bbva.mobile.android",       // BBVA
        "com.latuabancaperandroid",      // Intesa Sanpaolo
        "it.bnl.apps.banking",           // BNL
        "it.nogood.container"            // Unicredit
    );
    
    /**
     * Get the running service instance
     */
    public static BankNotificationListenerService getInstance() {
        return instance;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        Log.d(TAG, "========================================");
        Log.d(TAG, "✅ BankNotificationListenerService CREATED");
        Log.d(TAG, "========================================");
    }

    @Override
    public void onListenerConnected() {
        super.onListenerConnected();
        Log.d(TAG, "========================================");
        Log.d(TAG, "✅✅✅ Service CONNECTED to notification system");
        Log.d(TAG, "========================================");
        
        // ✅✅✅ CRITICAL FIX: Request rebind to ensure service is properly bound
        // This is CRUCIAL when returning from Android Settings after enabling permission
        // Without this, the service can stay in a "zombie" state where it's technically
        // enabled but not actually receiving notifications
        try {
            ComponentName component = new ComponentName(this, BankNotificationListenerService.class);
            requestRebind(component);
            Log.d(TAG, "✅ requestRebind() called successfully on connect");
        } catch (Exception e) {
            Log.e(TAG, "❌ Error calling requestRebind on connect:", e);
            // Don't crash - service continues
        }
    }

    @Override
    public void onListenerDisconnected() {
        super.onListenerDisconnected();
        Log.d(TAG, "========================================");
        Log.d(TAG, "⚠️⚠️⚠️ Service DISCONNECTED from notification system");
        Log.d(TAG, "========================================");
        
        // ✅✅✅ CRITICAL FIX: Request rebind when disconnected
        // This prevents the service from staying dead after a crash or disconnect
        // Android will automatically restart and rebind the service
        try {
            ComponentName component = new ComponentName(this, BankNotificationListenerService.class);
            requestRebind(component);
            Log.d(TAG, "✅ requestRebind() called successfully on disconnect");
        } catch (Exception e) {
            Log.e(TAG, "❌ Error calling requestRebind on disconnect:", e);
            // Don't crash - Android will retry
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        instance = null;
        Log.d(TAG, "========================================");
        Log.d(TAG, "❌ BankNotificationListenerService DESTROYED");
        Log.d(TAG, "========================================");
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        String packageName = sbn.getPackageName();
        
        // Ignora se non è una notifica bancaria
        if (!BANK_PACKAGES.contains(packageName)) {
            return;
        }

        try {
            Notification notification = sbn.getNotification();
            Bundle extras = notification.extras;
            
            if (extras == null) {
                return;
            }

            String title = extras.getString(Notification.EXTRA_TITLE, "");
            String text = extras.getString(Notification.EXTRA_TEXT, "");
            String bigText = extras.getString(Notification.EXTRA_BIG_TEXT, "");
            long timestamp = sbn.getPostTime();

            // Usa bigText se disponibile, altrimenti text
            String fullText = bigText != null && !bigText.isEmpty() ? bigText : text;

            if (fullText == null || fullText.isEmpty()) {
                return;
            }

            Log.d(TAG, "📦 Bank notification from: " + packageName);
            Log.d(TAG, "Title: " + title);
            Log.d(TAG, "Text: " + fullText);

            // Prepara dati da inviare al JavaScript
            JSObject data = new JSObject();
            data.put("packageName", packageName);
            data.put("appName", getAppName(packageName));
            data.put("title", title);
            data.put("text", fullText);
            data.put("timestamp", timestamp);

            // Invia al plugin Capacitor
            sendToCapacitor(data);

        } catch (Exception e) {
            Log.e(TAG, "❌ Error processing notification", e);
        }
    }

    @Override
    public void onNotificationRemoved(StatusBarNotification sbn) {
        // Non ci interessa quando vengono rimosse
    }

    /**
     * Ottieni nome friendly dell'app bancaria
     */
    private String getAppName(String packageName) {
        switch (packageName) {
            case "com.revolut.revolut":
                return "revolut";
            case "com.paypal.android.p2pmobile":
                return "paypal";
            case "it.poste.postepay":
                return "postepay";
            case "com.bbva.mobile.android":
                return "bbva";
            case "com.latuabancaperandroid":
                return "intesa";
            case "it.bnl.apps.banking":
                return "bnl";
            case "it.nogood.container":
                return "unicredit";
            default:
                return packageName;
        }
    }

    /**
     * Invia dati al layer JavaScript tramite Capacitor
     */
    private void sendToCapacitor(JSObject data) {
        // Invia broadcast intent che verrà catturato dal plugin
        Intent intent = new Intent("com.gestore.spese.BANK_NOTIFICATION");
        intent.putExtra("data", data.toString());
        sendBroadcast(intent);

        Log.d(TAG, "✅ Notification data sent to Capacitor");
    }
}
