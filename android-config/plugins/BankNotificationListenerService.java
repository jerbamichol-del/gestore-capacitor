package com.gestore.spese;

import android.app.Notification;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.util.Log;

import com.getcapacitor.JSObject;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Arrays;
import java.util.List;

public class BankNotificationListenerService extends NotificationListenerService {

    private static final String TAG = "BankNotificationListener";
    
    // Static instance for access from plugin
    private static BankNotificationListenerService instance;
    
    // Package names delle app bancarie da monitorare
    // ✅ EXPANDED: Now includes common variations + fallback "pass all if user enables"
    private static final List<String> BANK_PACKAGES = Arrays.asList(
        "com.revolut.revolut",           // Revolut
        "com.paypal.android.p2pmobile",  // PayPal
        "it.poste.postepay",             // Postepay
        "com.bbva.mobile.android",       // BBVA
        "com.latuabancaperandroid",      // Intesa Sanpaolo
        "it.bnl.apps.banking",           // BNL
        "it.nogood.container",           // UniCredit (old/legacy)
        "eu.unicredit.mobile",           // UniCredit (possible new)
        "it.unicredit.mobile",           // UniCredit (alternate)
        "com.unicredit.euromobile"       // UniCredit (euromobile variant)
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
        
        try {
            ComponentName component = new ComponentName(this, BankNotificationListenerService.class);
            requestRebind(component);
            Log.d(TAG, "✅ requestRebind() called successfully on connect");
        } catch (Exception e) {
            Log.e(TAG, "❌ Error calling requestRebind on connect:", e);
        }
    }

    @Override
    public void onListenerDisconnected() {
        super.onListenerDisconnected();
        Log.d(TAG, "========================================");
        Log.d(TAG, "⚠️⚠️⚠️ Service DISCONNECTED from notification system");
        Log.d(TAG, "========================================");
        
        try {
            ComponentName component = new ComponentName(this, BankNotificationListenerService.class);
            requestRebind(component);
            Log.d(TAG, "✅ requestRebind() called successfully on disconnect");
        } catch (Exception e) {
            Log.e(TAG, "❌ Error calling requestRebind on disconnect:", e);
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
        
        // ✅ CRITICAL FIX: Log ALL notifications (even non-bank) for debugging
        // This helps identify unknown bank packages
        Log.d(TAG, "[ALL_NOTIF] Package: " + packageName + ", Key: " + sbn.getKey());
        
        // Check if it's a known bank package
        boolean isBankPackage = BANK_PACKAGES.contains(packageName);
        
        // ✅ NEW: Also accept packages containing common bank keywords
        // (fallback for unknown bank apps)
        boolean looksLikeBank = packageName.contains("bank") || 
                                packageName.contains("unicredit") ||
                                packageName.contains("revolut") ||
                                packageName.contains("paypal") ||
                                packageName.contains("poste") ||
                                packageName.contains("bbva") ||
                                packageName.contains("intesa") ||
                                packageName.contains("bnl");
        
        if (!isBankPackage && !looksLikeBank) {
            // Not a bank notification, skip silently
            return;
        }
        
        if (looksLikeBank && !isBankPackage) {
            Log.w(TAG, "⚠️ UNKNOWN BANK PACKAGE DETECTED: " + packageName + " (processing anyway)");
        }

        try {
            Notification notification = sbn.getNotification();
            Bundle extras = notification.extras;
            
            if (extras == null) {
                Log.w(TAG, "[SKIP] Notification has no extras: " + packageName);
                return;
            }

            // ✅ RESILIENT TEXT EXTRACTION: Try multiple fields in order of preference
            String title = extras.getString(Notification.EXTRA_TITLE, "");
            String text = extractNotificationText(extras);
            long timestamp = sbn.getPostTime();

            if (text == null || text.isEmpty()) {
                Log.w(TAG, "[SKIP] Could not extract text from notification: " + packageName);
                logExtrasForDebug(extras); // Log all available extras for debugging
                return;
            }

            Log.d(TAG, "📦 Bank notification from: " + packageName);
            Log.d(TAG, "Title: " + title);
            Log.d(TAG, "Text: " + text);

            // Prepara dati da inviare al JavaScript
            JSObject data = new JSObject();
            data.put("packageName", packageName);
            data.put("appName", getAppName(packageName));
            data.put("title", title);
            data.put("text", text);
            data.put("timestamp", timestamp);

            // Invia al plugin Capacitor
            sendToCapacitor(data);

        } catch (Exception e) {
            Log.e(TAG, "❌ Error processing notification from " + packageName, e);
        }
    }
    
    /**
     * ✅ RESILIENT TEXT EXTRACTION
     * Tries multiple notification fields to extract text content.
     * This handles different notification styles (basic, big text, messaging, etc.)
     */
    private String extractNotificationText(Bundle extras) {
        // 1. Try BIG_TEXT first (most detailed)
        String bigText = extras.getString(Notification.EXTRA_BIG_TEXT);
        if (bigText != null && !bigText.isEmpty()) {
            Log.d(TAG, "[TEXT] Extracted from EXTRA_BIG_TEXT");
            return bigText;
        }
        
        // 2. Try standard TEXT
        String text = extras.getString(Notification.EXTRA_TEXT);
        if (text != null && !text.isEmpty()) {
            Log.d(TAG, "[TEXT] Extracted from EXTRA_TEXT");
            return text;
        }
        
        // 3. Try TEXT_LINES (used by some apps for multi-line notifications)
        CharSequence[] textLines = extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES);
        if (textLines != null && textLines.length > 0) {
            StringBuilder sb = new StringBuilder();
            for (CharSequence line : textLines) {
                if (line != null) {
                    if (sb.length() > 0) sb.append(" ");
                    sb.append(line.toString());
                }
            }
            String combined = sb.toString();
            if (!combined.isEmpty()) {
                Log.d(TAG, "[TEXT] Extracted from EXTRA_TEXT_LINES");
                return combined;
            }
        }
        
        // 4. Try MESSAGES (messaging style notifications)
        android.os.Parcelable[] messages = extras.getParcelableArray(Notification.EXTRA_MESSAGES);
        if (messages != null && messages.length > 0) {
            StringBuilder sb = new StringBuilder();
            for (android.os.Parcelable p : messages) {
                if (p instanceof Bundle) {
                    Bundle msgBundle = (Bundle) p;
                    CharSequence msgText = msgBundle.getCharSequence("text");
                    if (msgText != null) {
                        if (sb.length() > 0) sb.append(" ");
                        sb.append(msgText.toString());
                    }
                }
            }
            String combined = sb.toString();
            if (!combined.isEmpty()) {
                Log.d(TAG, "[TEXT] Extracted from EXTRA_MESSAGES");
                return combined;
            }
        }
        
        // 5. Try INFO_TEXT (fallback)
        String infoText = extras.getString(Notification.EXTRA_INFO_TEXT);
        if (infoText != null && !infoText.isEmpty()) {
            Log.d(TAG, "[TEXT] Extracted from EXTRA_INFO_TEXT");
            return infoText;
        }
        
        // 6. Try SUB_TEXT (last resort)
        String subText = extras.getString(Notification.EXTRA_SUB_TEXT);
        if (subText != null && !subText.isEmpty()) {
            Log.d(TAG, "[TEXT] Extracted from EXTRA_SUB_TEXT");
            return subText;
        }
        
        Log.w(TAG, "[TEXT] No text found in any known field");
        return null;
    }
    
    /**
     * ✅ DEBUG HELPER: Log all extras keys for unknown notification formats
     */
    private void logExtrasForDebug(Bundle extras) {
        try {
            Log.d(TAG, "[DEBUG] Available extras keys:");
            for (String key : extras.keySet()) {
                Object value = extras.get(key);
                String valueStr = value != null ? value.toString() : "null";
                // Truncate long values
                if (valueStr.length() > 100) {
                    valueStr = valueStr.substring(0, 97) + "...";
                }
                Log.d(TAG, "  - " + key + ": " + valueStr);
            }
        } catch (Exception e) {
            Log.e(TAG, "[DEBUG] Error logging extras", e);
        }
    }

    @Override
    public void onNotificationRemoved(StatusBarNotification sbn) {
        // Non ci interessa quando vengono rimosse
    }

    /**
     * Ottieni nome friendly dell'app bancaria
     * ✅ UPDATED: Handle unknown packages gracefully
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
            case "eu.unicredit.mobile":
            case "it.unicredit.mobile":
            case "com.unicredit.euromobile":
                return "unicredit";
            default:
                // Return simplified package name for unknown apps
                String[] parts = packageName.split("\\.");
                return parts[parts.length - 1].toLowerCase();
        }
    }

    /**
     * Invia dati al layer JavaScript tramite Capacitor
     * ✅ UPDATED: Now also saves to persistent queue for app-closed scenarios
     */
    private void sendToCapacitor(JSObject data) {
        // 1. Invia broadcast intent che verrà catturato dal plugin (se app è aperta)
        Intent intent = new Intent("com.gestore.spese.BANK_NOTIFICATION");
        intent.putExtra("data", data.toString());
        sendBroadcast(intent);
        Log.d(TAG, "✅ Notification data sent to Capacitor (broadcast)");
        
        // 2. ✅ NEW: Salva anche in SharedPreferences (per app chiusa)
        try {
            SharedPreferences prefs = getSharedPreferences("pending_notifications", Context.MODE_PRIVATE);
            String existingJson = prefs.getString("queue", "[]");
            JSONArray queue = new JSONArray(existingJson);
            queue.put(new JSONObject(data.toString()));
            prefs.edit().putString("queue", queue.toString()).apply();
            Log.d(TAG, "✅ Notification saved to persistent queue (total: " + queue.length() + ")");
        } catch (Exception e) {
            Log.e(TAG, "❌ Failed to save notification to queue", e);
        }
    }
}
