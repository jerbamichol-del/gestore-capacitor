package com.gestore.spese;

import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
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
        "it.nogood.container"
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

    /**
     * ✅ CRITICAL FIX: Added 300ms delay to prevent white screen crash
     * 
     * When user returns from Android Settings after enabling the permission,
     * Settings.Secure might not be immediately updated. The delay ensures
     * Android has time to update the system settings before we query them.
     * 
     * The try-catch prevents any native crash from propagating to the JS layer.
     */
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
                    // ✅ CRITICAL: Don't crash, return safe default
                    Log.e(TAG, "❌ Error checking permission (returning safe default)", e);
                    JSObject ret = new JSObject();
                    ret.put("enabled", false);
                    call.resolve(ret);
                }
            }
        }, 300); // 300ms delay
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
     * NEW METHOD: Check for missed notifications while app was closed
     * Scans active notifications from last 24 hours
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
            // Get the NotificationListenerService instance
            BankNotificationListenerService service = BankNotificationListenerService.getInstance();
            
            if (service == null) {
                Log.w(TAG, "⚠️ NotificationListenerService not running, returning empty array");
                JSObject ret = new JSObject();
                ret.put("missed", new JSArray());
                call.resolve(ret);
                return;
            }
            
            // Get active notifications
            StatusBarNotification[] activeNotifications = service.getActiveNotifications();
            Log.d(TAG, "Found " + activeNotifications.length + " active notifications");
            
            JSArray missedArray = new JSArray();
            long currentTime = System.currentTimeMillis();
            long twentyFourHoursAgo = currentTime - (24 * 60 * 60 * 1000); // 24 hours
            
            for (StatusBarNotification sbn : activeNotifications) {
                String packageName = sbn.getPackageName();
                long postTime = sbn.getPostTime();
                
                // Check if it's a bank notification and within 24 hours
                if (BANK_PACKAGES.contains(packageName) && postTime >= twentyFourHoursAgo) {
                    String notificationId = sbn.getKey();
                    
                    // Skip if already processed
                    if (processedNotificationIds.contains(notificationId)) {
                        Log.d(TAG, "⏭️ Skipping already processed notification: " + notificationId);
                        continue;
                    }
                    
                    try {
                        android.app.Notification notification = sbn.getNotification();
                        android.os.Bundle extras = notification.extras;
                        
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
                                
                                // Mark as processed
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
    
    /**
     * Mark a notification as processed to avoid showing it again
     */
    @PluginMethod
    public void markAsProcessed(PluginCall call) {
        String notificationId = call.getString("notificationId");
        if (notificationId != null) {
            processedNotificationIds.add(notificationId);
            Log.d(TAG, "✅ Marked notification as processed: " + notificationId);
        }
        call.resolve();
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
