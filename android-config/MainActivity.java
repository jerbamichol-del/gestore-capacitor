package com.gestore.spese;

import android.os.Bundle;
import android.util.Log;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // ✅ CRITICAL: Register plugins BEFORE super.onCreate()!
        Log.d("MainActivity", "🚀 Registering custom plugins...");
        registerPlugin(NotificationListener.class);
        registerPlugin(SMSReader.class);
        Log.d("MainActivity", "✅ Custom plugins registered");
        
        // ✅ MUST be AFTER registerPlugin()
        super.onCreate(savedInstanceState);
    }
}
