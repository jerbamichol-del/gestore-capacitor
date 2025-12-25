package io.ionic.starter;

import android.app.Notification;
import android.content.Intent;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.util.Log;

import com.getcapacitor.Bridge;
import com.getcapacitor.JSObject;

import java.util.Arrays;
import java.util.List;

public class BankNotificationListenerService extends NotificationListenerService {

    private static final String TAG = "BankNotificationListener";
    
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

            Log.d(TAG, "Bank notification from: " + packageName);
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
            Log.e(TAG, "Error processing notification", e);
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
        Intent intent = new Intent("io.ionic.starter.BANK_NOTIFICATION");
        intent.putExtra("data", data.toString());
        sendBroadcast(intent);

        Log.d(TAG, "Notification data sent to Capacitor");
    }
}
