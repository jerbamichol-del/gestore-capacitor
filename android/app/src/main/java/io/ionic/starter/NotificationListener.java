package io.ionic.starter;

import android.content.Intent;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.util.Log;
import androidx.localbroadcastmanager.content.LocalBroadcastManager;

import java.util.Arrays;
import java.util.List;

public class NotificationListener extends NotificationListenerService {
    private static final String TAG = "NotificationListener";
    
    // Bank apps to monitor
    private static final List<String> MONITORED_PACKAGES = Arrays.asList(
        "com.revolut.revolut",           // Revolut
        "com.paypal.android.p2pmobile",  // PayPal
        "posteitaliane.posteapp.apppostepay", // Postepay
        "com.bbva.bbvacontigo",          // BBVA
        "com.latuabancaperandroid",      // Intesa Sanpaolo
        "it.bnl.apps.banking",           // BNL
        "com.unicredit",                 // UniCredit
        "com.unicredit.mobile"           // UniCredit Mobile
    );

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        super.onNotificationPosted(sbn);
        
        String packageName = sbn.getPackageName();
        
        // Only process notifications from monitored banking apps
        if (!MONITORED_PACKAGES.contains(packageName)) {
            return;
        }

        Bundle extras = sbn.getNotification().extras;
        if (extras == null) {
            return;
        }

        String title = extras.getString("android.title", "");
        CharSequence textSeq = extras.getCharSequence("android.text");
        String text = textSeq != null ? textSeq.toString() : "";
        long timestamp = sbn.getPostTime();

        // Log for debugging
        Log.d(TAG, "Bank notification from: " + packageName);
        Log.d(TAG, "Title: " + title);
        Log.d(TAG, "Text: " + text);

        // Broadcast to the plugin
        Intent intent = new Intent("io.ionic.starter.NOTIFICATION_RECEIVED");
        intent.putExtra("packageName", packageName);
        intent.putExtra("title", title);
        intent.putExtra("text", text);
        intent.putExtra("timestamp", timestamp);
        
        LocalBroadcastManager.getInstance(this).sendBroadcast(intent);
        Log.d(TAG, "Broadcast sent to plugin");
    }

    @Override
    public void onNotificationRemoved(StatusBarNotification sbn) {
        super.onNotificationRemoved(sbn);
        // Optional: handle notification removal
    }
}
