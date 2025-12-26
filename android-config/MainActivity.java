package com.gestore.spese;

import android.os.Bundle;
import android.util.Log;
import com.getcapacitor.BridgeActivity;

// ✅ CRITICAL: Import plugin classes from android-plugins module
import com.gestore.spese.NotificationListener;
import com.gestore.spese.SMSReader;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // ✅ Register plugins BEFORE super.onCreate()
        Log.d("MainActivity", "🚀 Registering custom plugins...");
        registerPlugin(NotificationListener.class);
        registerPlugin(SMSReader.class);
        Log.d("MainActivity", "✅ Custom plugins registered");
        
        super.onCreate(savedInstanceState);
    }
}
