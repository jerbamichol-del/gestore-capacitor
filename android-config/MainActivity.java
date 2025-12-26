package com.gestore.spese;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SMSReaderPlugin.class);
        registerPlugin(NotificationListenerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
