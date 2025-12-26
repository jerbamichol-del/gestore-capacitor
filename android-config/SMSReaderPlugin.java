package com.gestore.spese;

import android.Manifest;
import android.content.ContentResolver;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.provider.Telephony;
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

import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(
    name = "SMSReader",
    permissions = {
        @Permission(strings = {Manifest.permission.READ_SMS}, alias = "readSMS"),
        @Permission(strings = {Manifest.permission.RECEIVE_SMS}, alias = "receiveSMS")
    }
)
public class SMSReaderPlugin extends Plugin {

    @PluginMethod
    public void checkPermission(PluginCall call) {
        boolean hasPermission = ContextCompat.checkSelfPermission(
            getContext(),
            Manifest.permission.READ_SMS
        ) == PackageManager.PERMISSION_GRANTED;

        JSObject result = new JSObject();
        result.put("granted", hasPermission);
        call.resolve(result);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.READ_SMS) 
            == PackageManager.PERMISSION_GRANTED) {
            JSObject result = new JSObject();
            result.put("granted", true);
            call.resolve(result);
            return;
        }

        // Use Capacitor's permission request system
        requestPermissionForAlias("readSMS", call, "smsPermissionCallback");
    }

    @PermissionCallback
    private void smsPermissionCallback(PluginCall call) {
        boolean granted = getPermissionState("readSMS") == com.getcapacitor.PermissionState.GRANTED;
        JSObject result = new JSObject();
        result.put("granted", granted);
        call.resolve(result);
    }

    @PluginMethod
    public void getRecentSMS(PluginCall call) {
        // Check permission first
        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.READ_SMS) 
            != PackageManager.PERMISSION_GRANTED) {
            call.reject("Permission denied. Call requestPermission() first.");
            return;
        }

        int hours = call.getInt("hours", 24);
        long cutoffTime = System.currentTimeMillis() - (hours * 60 * 60 * 1000L);

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

            JSObject result = new JSObject();
            result.put("messages", new JSArray(smsList));
            result.put("count", smsList.size());
            call.resolve(result);

        } catch (Exception e) {
            call.reject("Error reading SMS: " + e.getMessage(), e);
        }
    }
}
