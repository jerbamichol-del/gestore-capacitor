package com.gestore.spese;

import android.os.Bundle;
import android.util.Log;
import com.getcapacitor.BridgeActivity;

// ✅ CORRECT: Import plugin classes with Plugin suffix
import com.gestore.spese.NotificationListenerPlugin;
import com.gestore.spese.SMSReaderPlugin;
import com.gestore.spese.AppUpdatePlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // ✅ Register plugins BEFORE super.onCreate()
        Log.d("MainActivity", "Registering custom plugins...");
        registerPlugin(NotificationListenerPlugin.class);
        registerPlugin(SMSReaderPlugin.class);
        registerPlugin(AppUpdatePlugin.class);
        Log.d("MainActivity", "Custom plugins registered");

        super.onCreate(savedInstanceState);
    }
}
