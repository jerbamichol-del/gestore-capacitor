package com.gestore.spese;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.ContentResolver;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.Telephony;
import android.util.Log;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(
    name = "SMSReader",
    permissions = {
        @Permission(strings = {Manifest.permission.READ_SMS, Manifest.permission.RECEIVE_SMS}, alias = "sms")
    }
)
public class SMSReaderPlugin extends Plugin {
    private static final String TAG = "SMSReaderPlugin";
    private static final String SMS_RECEIVED_EVENT = "smsReceived";
    
    private BroadcastReceiver smsReceiver;

    @Override
    public void load() {
        super.load();
        Log.d(TAG, "SMSReaderPlugin loaded");
        registerSMSReceiver();
    }

    @Override
    protected void handleOnDestroy() {
        unregisterSMSReceiver();
        super.handleOnDestroy();
    }

    private void registerSMSReceiver() {
        Log.d(TAG, "Registering SMS BroadcastReceiver");
        
        smsReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                Log.d(TAG, "SMS broadcast received in plugin");
                
                try {
                    String smsDataJson = intent.getStringExtra("smsData");
                    if (smsDataJson != null) {
                        JSONObject smsData = new JSONObject(smsDataJson);
                        
                        JSObject data = new JSObject();
                        data.put("sender", smsData.getString("sender"));
                        data.put("body", smsData.getString("body"));
                        data.put("timestamp", smsData.getLong("timestamp"));
                        
                        Log.d(TAG, "Notifying JavaScript listeners for SMS: " + data.toString());
                        notifyListeners(SMS_RECEIVED_EVENT, data);
                    }
                } catch (Exception e) {
                    Log.e(TAG, "Error processing SMS broadcast: " + e.getMessage(), e);
                }
            }
        };

        IntentFilter filter = new IntentFilter("com.gestore.spese.SMS_RECEIVED");
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getContext().registerReceiver(smsReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            getContext().registerReceiver(smsReceiver, filter);
        }
        
        Log.d(TAG, "SMS BroadcastReceiver registered successfully");
    }

    private void unregisterSMSReceiver() {
        if (smsReceiver != null) {
            try {
                getContext().unregisterReceiver(smsReceiver);
                Log.d(TAG, "SMS BroadcastReceiver unregistered");
            } catch (Exception e) {
                Log.e(TAG, "Error unregistering SMS receiver: " + e.getMessage());
            }
        }
    }

    @PluginMethod
    public void checkPermission(PluginCall call) {
        Log.d(TAG, "✅ checkPermission() called");
        
        boolean hasReadPermission = ContextCompat.checkSelfPermission(
            getContext(),
            Manifest.permission.READ_SMS
        ) == PackageManager.PERMISSION_GRANTED;
        
        boolean hasReceivePermission = ContextCompat.checkSelfPermission(
            getContext(),
            Manifest.permission.RECEIVE_SMS
        ) == PackageManager.PERMISSION_GRANTED;

        // ✅ DETAILED LOGGING
        Log.d(TAG, "📝 READ_SMS permission: " + (hasReadPermission ? "GRANTED" : "DENIED"));
        Log.d(TAG, "📝 RECEIVE_SMS permission: " + (hasReceivePermission ? "GRANTED" : "DENIED"));
        Log.d(TAG, "📊 Final result: " + (hasReadPermission && hasReceivePermission ? "GRANTED" : "DENIED"));

        JSObject result = new JSObject();
        result.put("granted", hasReadPermission && hasReceivePermission);
        result.put("readSMS", hasReadPermission);
        result.put("receiveSMS", hasReceivePermission);
        call.resolve(result);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        Log.d(TAG, "📱 requestPermission() called");
        
        boolean hasReadPermission = ContextCompat.checkSelfPermission(
            getContext(), 
            Manifest.permission.READ_SMS
        ) == PackageManager.PERMISSION_GRANTED;
        
        boolean hasReceivePermission = ContextCompat.checkSelfPermission(
            getContext(),
            Manifest.permission.RECEIVE_SMS
        ) == PackageManager.PERMISSION_GRANTED;

        if (hasReadPermission && hasReceivePermission) {
            Log.d(TAG, "✅ Both permissions already granted");
            JSObject result = new JSObject();
            result.put("granted", true);
            call.resolve(result);
            return;
        }

        Log.d(TAG, "🔑 Requesting BOTH SMS permissions (READ_SMS + RECEIVE_SMS)...");
        
        // ✅ FIX: Request ALL permissions in the "sms" alias (both READ_SMS and RECEIVE_SMS)
        requestPermissionForAlias("sms", call, "smsPermissionCallback");
    }

    @PermissionCallback
    private void smsPermissionCallback(PluginCall call) {
        Log.d(TAG, "🔔 smsPermissionCallback invoked");
        
        // Re-check actual permissions after request
        boolean readGranted = ContextCompat.checkSelfPermission(
            getContext(),
            Manifest.permission.READ_SMS
        ) == PackageManager.PERMISSION_GRANTED;
        
        boolean receiveGranted = ContextCompat.checkSelfPermission(
            getContext(),
            Manifest.permission.RECEIVE_SMS
        ) == PackageManager.PERMISSION_GRANTED;
        
        Log.d(TAG, "READ_SMS after request: " + (readGranted ? "GRANTED" : "DENIED"));
        Log.d(TAG, "RECEIVE_SMS after request: " + (receiveGranted ? "GRANTED" : "DENIED"));
        
        boolean granted = readGranted && receiveGranted;
        
        JSObject result = new JSObject();
        result.put("granted", granted);
        result.put("readSMS", readGranted);
        result.put("receiveSMS", receiveGranted);
        call.resolve(result);
    }

    @PluginMethod
    public void getRecentSMS(PluginCall call) {
        Log.d(TAG, "📬 getRecentSMS() called");
        
        // Check permission first
        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.READ_SMS) 
            != PackageManager.PERMISSION_GRANTED) {
            Log.e(TAG, "❌ Permission denied for READ_SMS");
            call.reject("Permission denied. Call requestPermission() first.");
            return;
        }

        int hours = call.getInt("hours", 24);
        long cutoffTime = System.currentTimeMillis() - (hours * 60 * 60 * 1000L);

        Log.d(TAG, "🔍 Scanning SMS from last " + hours + " hours");

        List<JSObject> smsList = new ArrayList<>();

        try {
            ContentResolver contentResolver = getContext().getContentResolver();
            Uri smsUri = Telephony.Sms.Inbox.CONTENT_URI;

            // Columns to retrieve
            String[] projection = {
                Telephony.Sms._ID,
                Telephony.Sms.ADDRESS,  // Sender
                Telephony.Sms.BODY,     // Message body
                Telephony.Sms.DATE      // Timestamp
            };

            // Query only recent SMS
            String selection = Telephony.Sms.DATE + " > ?";
            String[] selectionArgs = {String.valueOf(cutoffTime)};
            String sortOrder = Telephony.Sms.DATE + " DESC";

            Cursor cursor = contentResolver.query(
                smsUri,
                projection,
                selection,
                selectionArgs,
                sortOrder
            );

            if (cursor != null) {
                int idIndex = cursor.getColumnIndex(Telephony.Sms._ID);
                int addressIndex = cursor.getColumnIndex(Telephony.Sms.ADDRESS);
                int bodyIndex = cursor.getColumnIndex(Telephony.Sms.BODY);
                int dateIndex = cursor.getColumnIndex(Telephony.Sms.DATE);

                while (cursor.moveToNext()) {
                    JSObject sms = new JSObject();
                    sms.put("id", cursor.getString(idIndex));
                    sms.put("sender", cursor.getString(addressIndex));
                    sms.put("body", cursor.getString(bodyIndex));
                    sms.put("timestamp", cursor.getLong(dateIndex));

                    smsList.add(sms);
                }

                cursor.close();
            }

            Log.d(TAG, "✅ Found " + smsList.size() + " SMS messages");

            JSObject result = new JSObject();
            result.put("messages", new JSArray(smsList));
            result.put("count", smsList.size());
            call.resolve(result);

        } catch (Exception e) {
            Log.e(TAG, "❌ Error reading SMS: " + e.getMessage(), e);
            call.reject("Error reading SMS: " + e.getMessage(), e);
        }
    }
}
