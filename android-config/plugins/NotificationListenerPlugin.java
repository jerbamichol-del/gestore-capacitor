package com.gestore.spese;

import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.service.notification.StatusBarNotification;
import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;

import java.util.HashSet;
import java.util.Set;
import java.util.Arrays;
import java.util.List;

@CapacitorPlugin(name = "NotificationListener")
public class NotificationListenerPlugin extends Plugin {

    private static final String TAG = "NotificationListenerPlugin";
    private BankNotificationReceiver receiver;
    
    // Set to track processed notification IDs to avoid duplicates
    private Set<String> processedNotificationIds = new HashSet<>();
    
    // Bank app package names (same as BankNotificationListenerService)
    private static final List<String> BANK_PACKAGES = Arrays.asList(
        "com.revolut.revolut",
        "com.paypal.android.p2pmobile",
        "it.poste.postepay",
        "com.bbva.mobile.android",
        "com.latuabancaperandroid",
        "it.bnl.apps.banking",
        "it.nogood.container",
        "eu.unicredit.mobile",
        "it.unicredit.mobile",
        "com.unicredit.euromobile",
        "com.unicredit"
    );

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
            
            // ✅ FIX: Android 13+ requires explicit flag
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                getContext().registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED);
                Log.d(TAG, "✅ BroadcastReceiver registered with RECEIVER_NOT_EXPORTED (Android 13+)");
            } else {
                getContext().registerReceiver(receiver, filter);
                Log.d(TAG, "✅ BroadcastReceiver registered (Android <13)");
            }
            
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
        
        // ✅ CRITICAL: Add 300ms delay to ensure Android settings are updated
        new Handler(Looper.getMainLooper()).postDelayed(new Runnable() {
            @Override
            public void run() {
                try {
                    boolean enabled = isNotificationListenerEnabled();
                    Log.d(TAG, "Notification listener enabled status: " + enabled);
                    
                    JSObject ret = new JSObject();
                    ret.put("enabled", enabled);
                    
                    Log.d(TAG, "Returning result: " + ret.toString());
                    call.resolve(ret);
                } catch (Exception e) {
                    Log.e(TAG, "❌ Error checking permission (returning safe default)", e);
                    JSObject ret = new JSObject();
                    ret.put("enabled", false);
                    call.resolve(ret);
                }
            }
        }, 300);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        Log.d(TAG, "========================================");
        Log.d(TAG, "requestPermission() method called from JavaScript!");
        Log.d(TAG, "========================================");
        
        boolean currentlyEnabled = isNotificationListenerEnabled();
        Log.d(TAG, "Current enabled status: " + currentlyEnabled);
        
        if (!currentlyEnabled) {
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

        Log.d(TAG, "✅ Notification listener is enabled, service will start automatically");
        JSObject ret = new JSObject();
        ret.put("listening", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void stopListening(PluginCall call) {
        Log.d(TAG, "stopListening() method called from JavaScript!");
        
        JSObject ret = new JSObject();
        ret.put("message", "Service cannot be stopped programmatically");
        call.resolve(ret);
    }
    
    /**
     * ✅ NEW: Get pending notifications from persistent queue (for app-closed scenarios)
     * Reads notifications saved to SharedPreferences by BankNotificationListenerService
     * and clears the queue after reading.
     */
    @PluginMethod
    public void getPendingNotifications(PluginCall call) {
        Log.d(TAG, "========================================");
        Log.d(TAG, "📬 getPendingNotifications() called");
        Log.d(TAG, "========================================");
        
        try {
            SharedPreferences prefs = getContext().getSharedPreferences("pending_notifications", Context.MODE_PRIVATE);
            String queueJson = prefs.getString("queue", "[]");
            JSONArray queue = new JSONArray(queueJson);
            
            Log.d(TAG, "Found " + queue.length() + " pending notifications in queue");
            
            JSArray pending = new JSArray();
            for (int i = 0; i < queue.length(); i++) {
                pending.put(queue.getJSONObject(i));
            }
            
            // ✅ CRITICAL: Clear the queue after reading to avoid duplicates
            prefs.edit().putString("queue", "[]").apply();
            Log.d(TAG, "✅ Queue cleared after reading");
            
            JSObject ret = new JSObject();
            ret.put("notifications", pending);
            ret.put("count", pending.length());
            call.resolve(ret);
            
            Log.d(TAG, "✅ Returned " + pending.length() + " pending notifications");
            
        } catch (Exception e) {
            Log.e(TAG, "❌ Error getting pending notifications", e);
            call.reject("Failed to get pending notifications: " + e.getMessage());
        }
    }
    
    /**
     * ✅ NEW: Reprocess active bank notifications (for missed/stuck notifications)
     * This manually triggers processing of all active bank notifications,
     * ignoring the "already processed" cache.
     */
    @PluginMethod
    public void reprocessActiveNotifications(PluginCall call) {
        Log.d(TAG, "========================================");
        Log.d(TAG, "🔄 reprocessActiveNotifications() called - FORCING REPROCESS");
        Log.d(TAG, "========================================");
        
        if (!isNotificationListenerEnabled()) {
            Log.w(TAG, "⚠️ Notification listener not enabled");
            call.reject("Notification listener not enabled");
            return;
        }
        
        try {
            BankNotificationListenerService service = BankNotificationListenerService.getInstance();
            
            if (service == null) {
                Log.w(TAG, "⚠️ NotificationListenerService not running");
                call.reject("NotificationListenerService not running");
                return;
            }
            
            StatusBarNotification[] activeNotifications = service.getActiveNotifications();
            Log.d(TAG, "Found " + activeNotifications.length + " total active notifications");
            
            int reprocessedCount = 0;
            
            for (StatusBarNotification sbn : activeNotifications) {
                String packageName = sbn.getPackageName();
                
                // Check if it's a bank notification
                boolean isBank = BANK_PACKAGES.contains(packageName) ||
                                packageName.contains("bank") ||
                                packageName.contains("unicredit") ||
                                packageName.contains("revolut") ||
                                packageName.contains("paypal");
                
                if (!isBank) continue;
                
                try {
                    android.app.Notification notification = sbn.getNotification();
                    Bundle extras = notification.extras;
                    
                    if (extras == null) {
                        Log.w(TAG, "[REPROCESS] Skipping notification with no extras: " + packageName);
                        continue;
                    }
                    
                    String title = extras.getString(android.app.Notification.EXTRA_TITLE, "");
                    String text = extractNotificationText(extras);
                    long timestamp = sbn.getPostTime();
                    
                    if (text == null || text.isEmpty()) {
                        Log.w(TAG, "[REPROCESS] Skipping notification with no text: " + packageName);
                        continue;
                    }
                    
                    Log.d(TAG, "🔄 REPROCESSING notification from: " + packageName);
                    Log.d(TAG, "   Title: " + title);
                    Log.d(TAG, "   Text: " + text.substring(0, Math.min(text.length(), 100)) + "...");
                    
                    // Build data object
                    JSObject data = new JSObject();
                    data.put("packageName", packageName);
                    data.put("appName", getAppName(packageName));
                    data.put("title", title);
                    data.put("text", text);
                    data.put("timestamp", timestamp);
                    data.put("reprocessed", true); // Mark as reprocessed
                    
                    // Send directly to JS listeners (bypass broadcast)
                    notifyListeners("notificationReceived", data);
                    
                    reprocessedCount++;
                    Log.d(TAG, "✅ Notification reprocessed and sent to JS");
                    
                } catch (Exception e) {
                    Log.e(TAG, "❌ Error reprocessing notification from " + packageName, e);
                }
            }
            
            Log.d(TAG, "✅ Reprocessed " + reprocessedCount + " bank notifications");
            
            JSObject ret = new JSObject();
            ret.put("reprocessed", reprocessedCount);
            ret.put("total", activeNotifications.length);
            call.resolve(ret);
            
        } catch (Exception e) {
            Log.e(TAG, "❌ Error reprocessing notifications", e);
            call.reject("Failed to reprocess notifications: " + e.getMessage());
        }
    }
    
    /**
     * Extract text from notification extras (resilient multi-field strategy)
     */
    private String extractNotificationText(Bundle extras) {
        // Try BIG_TEXT first
        String bigText = extras.getString(android.app.Notification.EXTRA_BIG_TEXT);
        if (bigText != null && !bigText.isEmpty()) return bigText;
        
        // Try standard TEXT
        String text = extras.getString(android.app.Notification.EXTRA_TEXT);
        if (text != null && !text.isEmpty()) return text;
        
        // Try TEXT_LINES
        CharSequence[] textLines = extras.getCharSequenceArray(android.app.Notification.EXTRA_TEXT_LINES);
        if (textLines != null && textLines.length > 0) {
            StringBuilder sb = new StringBuilder();
            for (CharSequence line : textLines) {
                if (line != null) {
                    if (sb.length() > 0) sb.append(" ");
                    sb.append(line.toString());
                }
            }
            if (sb.length() > 0) return sb.toString();
        }
        
        return null;
    }
    
    /**
     * ✅ NEW: Get ALL active notifications with full details (for debugging)
     */
    @PluginMethod
    public void getAllActiveNotifications(PluginCall call) {
        Log.d(TAG, "========================================");
        Log.d(TAG, "getAllActiveNotifications() called (DEBUG MODE)");
        Log.d(TAG, "========================================");
        
        if (!isNotificationListenerEnabled()) {
            Log.w(TAG, "⚠️ Notification listener not enabled");
            call.reject("Notification listener not enabled");
            return;
        }
        
        try {
            BankNotificationListenerService service = BankNotificationListenerService.getInstance();
            
            if (service == null) {
                Log.w(TAG, "⚠️ NotificationListenerService not running");
                call.reject("NotificationListenerService not running");
                return;
            }
            
            StatusBarNotification[] activeNotifications = service.getActiveNotifications();
            Log.d(TAG, "Found " + activeNotifications.length + " total active notifications");
            
            JSArray allNotifs = new JSArray();
            
            for (StatusBarNotification sbn : activeNotifications) {
                try {
                    String packageName = sbn.getPackageName();
                    android.app.Notification notification = sbn.getNotification();
                    Bundle extras = notification.extras;
                    
                    JSObject notifData = new JSObject();
                    notifData.put("packageName", packageName);
                    notifData.put("key", sbn.getKey());
                    notifData.put("postTime", sbn.getPostTime());
                    
                    if (extras != null) {
                        notifData.put("title", extras.getString(android.app.Notification.EXTRA_TITLE, ""));
                        notifData.put("text", extras.getString(android.app.Notification.EXTRA_TEXT, ""));
                        notifData.put("bigText", extras.getString(android.app.Notification.EXTRA_BIG_TEXT, ""));
                        
                        // Add all extras keys for debugging
                        JSArray extrasKeys = new JSArray();
                        for (String key : extras.keySet()) {
                            extrasKeys.put(key);
                        }
                        notifData.put("extrasKeys", extrasKeys);
                    }
                    
                    allNotifs.put(notifData);
                    
                } catch (Exception e) {
                    Log.e(TAG, "Error processing notification", e);
                }
            }
            
            Log.d(TAG, "✅ Returning " + allNotifs.length() + " notifications");
            
            JSObject ret = new JSObject();
            ret.put("notifications", allNotifs);
            ret.put("count", allNotifs.length());
            call.resolve(ret);
            
        } catch (Exception e) {
            Log.e(TAG, "❌ Error getting all notifications", e);
            call.reject("Failed to get notifications: " + e.getMessage());
        }
    }
    
    /**
     * Check for missed notifications while app was closed
     */
    @PluginMethod
    public void checkMissedNotifications(PluginCall call) {
        Log.d(TAG, "========================================");
        Log.d(TAG, "checkMissedNotifications() method called from JavaScript!");
        Log.d(TAG, "========================================");
        
        if (!isNotificationListenerEnabled()) {
            Log.w(TAG, "⚠️ Notification listener not enabled, returning empty array");
            JSObject ret = new JSObject();
            ret.put("missed", new JSArray());
            call.resolve(ret);
            return;
        }
        
        try {
            BankNotificationListenerService service = BankNotificationListenerService.getInstance();
            
            if (service == null) {
                Log.w(TAG, "⚠️ NotificationListenerService not running, returning empty array");
                JSObject ret = new JSObject();
                ret.put("missed", new JSArray());
                call.resolve(ret);
                return;
            }
            
            StatusBarNotification[] activeNotifications = service.getActiveNotifications();
            Log.d(TAG, "Found " + activeNotifications.length + " active notifications");
            
            JSArray missedArray = new JSArray();
            long currentTime = System.currentTimeMillis();
            long twentyFourHoursAgo = currentTime - (24 * 60 * 60 * 1000);
            
            for (StatusBarNotification sbn : activeNotifications) {
                String packageName = sbn.getPackageName();
                long postTime = sbn.getPostTime();
                
                // ✅ UPDATED: Check both whitelist AND keyword matching
                boolean isBank = BANK_PACKAGES.contains(packageName) ||
                                packageName.contains("bank") ||
                                packageName.contains("unicredit") ||
                                packageName.contains("revolut") ||
                                packageName.contains("paypal");
                
                if (isBank && postTime >= twentyFourHoursAgo) {
                    String notificationId = sbn.getKey();
                    
                    if (processedNotificationIds.contains(notificationId)) {
                        Log.d(TAG, "⏭️ Skipping already processed notification: " + notificationId);
                        continue;
                    }
                    
                    try {
                        android.app.Notification notification = sbn.getNotification();
                        Bundle extras = notification.extras;
                        
                        if (extras != null) {
                            String title = extras.getString(android.app.Notification.EXTRA_TITLE, "");
                            String text = extras.getString(android.app.Notification.EXTRA_TEXT, "");
                            String bigText = extras.getString(android.app.Notification.EXTRA_BIG_TEXT, "");
                            
                            String fullText = (bigText != null && !bigText.isEmpty()) ? bigText : text;
                            
                            if (fullText != null && !fullText.isEmpty()) {
                                JSObject notifData = new JSObject();
                                notifData.put("packageName", packageName);
                                notifData.put("appName", getAppName(packageName));
                                notifData.put("title", title);
                                notifData.put("text", fullText);
                                notifData.put("timestamp", postTime);
                                
                                missedArray.put(notifData);
                                processedNotificationIds.add(notificationId);
                                
                                Log.d(TAG, "✅ Found missed notification from " + packageName + ": " + title);
                            }
                        }
                    } catch (Exception e) {
                        Log.e(TAG, "❌ Error processing notification", e);
                    }
                }
            }
            
            Log.d(TAG, "✅ Found " + missedArray.length() + " missed bank notifications");
            
            JSObject ret = new JSObject();
            ret.put("missed", missedArray);
            call.resolve(ret);
            
        } catch (Exception e) {
            Log.e(TAG, "❌ Error checking missed notifications", e);
            call.reject("Failed to check missed notifications: " + e.getMessage());
        }
    }
    
    @PluginMethod
    public void markAsProcessed(PluginCall call) {
        String notificationId = call.getString("notificationId");
        if (notificationId != null) {
            processedNotificationIds.add(notificationId);
            Log.d(TAG, "✅ Marked notification as processed: " + notificationId);
        }
        call.resolve();
    }

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
            case "com.unicredit":
                return "unicredit";
            default:
                String[] parts = packageName.split("\\.");
                return parts[parts.length - 1].toLowerCase();
        }
    }

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
