package com.gestore.spese;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.telephony.SmsMessage;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;

/**
 * BroadcastReceiver for intercepting incoming SMS messages in real-time.
 * This receiver listens for SMS_RECEIVED broadcasts and forwards them to the SMSReaderPlugin.
 */
public class SMSReceiver extends BroadcastReceiver {
    private static final String TAG = "SMSReceiver";
    private static final String SMS_RECEIVED_ACTION = "android.provider.Telephony.SMS_RECEIVED";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !SMS_RECEIVED_ACTION.equals(intent.getAction())) {
            return;
        }

        Log.d(TAG, "SMS_RECEIVED broadcast received");

        try {
            Bundle bundle = intent.getExtras();
            if (bundle == null) {
                Log.w(TAG, "Bundle is null");
                return;
            }

            Object[] pdus = (Object[]) bundle.get("pdus");
            if (pdus == null || pdus.length == 0) {
                Log.w(TAG, "No PDUs found in bundle");
                return;
            }

            String format = bundle.getString("format");
            
            for (Object pdu : pdus) {
                SmsMessage smsMessage;
                
                // Handle different Android versions
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                    smsMessage = SmsMessage.createFromPdu((byte[]) pdu, format);
                } else {
                    smsMessage = SmsMessage.createFromPdu((byte[]) pdu);
                }

                if (smsMessage == null) {
                    continue;
                }

                String sender = smsMessage.getOriginatingAddress();
                String body = smsMessage.getMessageBody();
                long timestamp = smsMessage.getTimestampMillis();

                Log.d(TAG, "SMS received from: " + sender);
                Log.d(TAG, "SMS body: " + body);
                Log.d(TAG, "SMS timestamp: " + timestamp);

                // Notify the plugin about the received SMS
                notifyPlugin(context, sender, body, timestamp);
            }

        } catch (Exception e) {
            Log.e(TAG, "Error processing SMS: " + e.getMessage(), e);
        }
    }

    /**
     * Notify the SMSReaderPlugin about the received SMS.
     * This sends an event to JavaScript listeners.
     */
    private void notifyPlugin(Context context, String sender, String body, long timestamp) {
        try {
            // Create JSON object with SMS data
            JSObject smsData = new JSObject();
            smsData.put("sender", sender);
            smsData.put("body", body);
            smsData.put("timestamp", timestamp);

            Log.d(TAG, "SMS data prepared for plugin: " + smsData.toString());

            // Broadcast to plugin via Intent
            Intent pluginIntent = new Intent("com.gestore.spese.SMS_RECEIVED");
            pluginIntent.putExtra("smsData", smsData.toString());
            context.sendBroadcast(pluginIntent);

            Log.d(TAG, "SMS broadcast sent to plugin");

        } catch (Exception e) {
            Log.e(TAG, "Error notifying plugin: " + e.getMessage(), e);
        }
    }
}
