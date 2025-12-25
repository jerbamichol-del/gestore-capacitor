package com.gestore.spese;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Registra i plugin custom (ora nello stesso package)
        registerPlugin(NotificationListenerPlugin.class);
        registerPlugin(SMSReaderPlugin.class);
    }
}
