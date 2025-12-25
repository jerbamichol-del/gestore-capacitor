package com.gestore.spese;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import android.util.Log;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "MainActivity";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        Log.d(TAG, "MainActivity onCreate() called");
        
        // Registra i plugin custom
        try {
            Log.d(TAG, "Registering NotificationListenerPlugin...");
            registerPlugin(NotificationListenerPlugin.class);
            Log.d(TAG, "NotificationListenerPlugin registered successfully!");
        } catch (Exception e) {
            Log.e(TAG, "Failed to register NotificationListenerPlugin", e);
        }
        
        try {
            Log.d(TAG, "Registering SMSReaderPlugin...");
            registerPlugin(SMSReaderPlugin.class);
            Log.d(TAG, "SMSReaderPlugin registered successfully!");
        } catch (Exception e) {
            Log.e(TAG, "Failed to register SMSReaderPlugin", e);
        }
        
        Log.d(TAG, "All plugins registered. Bridge initialized.");
    }
}
