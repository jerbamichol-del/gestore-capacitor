package com.gestore.spese;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import java.util.ArrayList;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Register custom plugins with correct names
        registerPlugin(SMSReaderPlugin.class);
        registerPlugin(NotificationListenerPlugin.class);
    }
    
    @Override
    public void registerPlugin(Class<? extends Plugin> pluginClass) {
        super.registerPlugin(pluginClass);
        
        // Log registration for debugging
        android.util.Log.d("MainActivity", "Registered plugin: " + pluginClass.getSimpleName());
    }
}
