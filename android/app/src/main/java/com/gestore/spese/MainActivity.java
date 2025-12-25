package com.gestore.spese;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Registra i plugin custom
        registerPlugin(io.ionic.starter.NotificationListenerPlugin.class);
        registerPlugin(io.ionic.starter.SMSReaderPlugin.class);
    }
}
