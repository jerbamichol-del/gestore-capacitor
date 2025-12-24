package io.ionic.starter;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import io.ionic.starter.SMSReaderPlugin;
import io.ionic.starter.NotificationListenerPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Register custom plugins
        registerPlugin(SMSReaderPlugin.class);
        registerPlugin(NotificationListenerPlugin.class);
    }
}
