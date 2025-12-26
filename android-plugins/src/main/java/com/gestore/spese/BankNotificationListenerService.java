package com.gestore.spese;

import android.app.Notification;
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
    
    private static final List<String> BANK_PACKAGES = Arrays.asList(
        "com.revolut.revolut",
        "com.paypal.android.p2pmobile",
        "it.poste.postepay",
        "com.bbva.mobile.android",
        "com.latuabancaperandroid",
        "it.bnl.apps.banking",
        "it.nogood.container"
    );

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        String packageName = sbn.getPackageName();
        
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

            String fullText = bigText != null && !bigText.isEmpty() ? bigText : text;

            if (fullText == null || fullText.isEmpty()) {
                return;
            }

            Log.d(TAG, "Bank notification from: " + packageName);

            JSObject data = new JSObject();
            data.put("packageName", packageName);
            data.put("appName", getAppName(packageName));
            data.put("title", title);
            data.put("text", fullText);
            data.put("timestamp", timestamp);

            sendToCapacitor(data);

        } catch (Exception e) {
            Log.e(TAG, "Error processing notification", e);
        }
    }

    @Override
    public void onNotificationRemoved(StatusBarNotification sbn) {
    }

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

    private void sendToCapacitor(JSObject data) {
        Intent intent = new Intent("com.gestore.spese.BANK_NOTIFICATION");
        intent.putExtra("data", data.toString());
        sendBroadcast(intent);
        Log.d(TAG, "Notification data sent to Capacitor");
    }
}
