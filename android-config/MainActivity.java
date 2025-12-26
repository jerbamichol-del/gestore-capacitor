package com.gestore.spese;

import android.os.Bundle;
import android.util.Log;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        Log.d("MainActivity", "🚀 Registering custom plugins...");
        registerPlugin(SMSReader.class);
        registerPlugin(NotificationListener.class);
        Log.d("MainActivity", "✅ Custom plugins registered");
        super.onCreate(savedInstanceState);
    }
}
