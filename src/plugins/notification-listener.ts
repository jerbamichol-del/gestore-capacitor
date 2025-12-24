// src/plugins/notification-listener.ts

import { registerPlugin } from '@capacitor/core';

export interface BankNotification {
  appName: string;
  packageName: string;
  title: string;
  text: string;
  timestamp: number;
}

export interface NotificationListenerPlugin {
  /**
   * Check if notification listener is enabled
   */
  isEnabled(): Promise<{ enabled: boolean }>;

  /**
   * Request notification listener permission
   * Opens Android settings
   */
  requestPermission(): Promise<{ enabled: boolean }>;

  /**
   * Start listening for notifications (registers the service)
   */
  startListening(): Promise<void>;

  /**
   * Add listener for notification events
   */
  addListener(
    eventName: 'notificationReceived',
    listenerFunc: (data: NotificationData) => void
  ): Promise<PluginListenerHandle>;

  /**
   * Remove all listeners
   */
  removeAllListeners(): Promise<void>;
}

export interface NotificationData {
  packageName: string;
  title: string;
  text: string;
  timestamp: number;
}

export interface PluginListenerHandle {
  remove: () => Promise<void>;
}

// Map package names to app names
const PACKAGE_TO_APP_NAME: Record<string, string> = {
  'com.revolut.revolut': 'Revolut',
  'com.paypal.android.p2pmobile': 'PayPal',
  'posteitaliane.posteapp.apppostepay': 'Postepay',
  'com.bbva.bbvacontigo': 'BBVA',
  'com.latuabancaperandroid': 'Intesa Sanpaolo',
  'it.bnl.apps.banking': 'BNL',
  'com.unicredit': 'UniCredit',
  'com.unicredit.mobile': 'UniCredit',
};

const NotificationListenerPlugin = registerPlugin<NotificationListenerPlugin>('NotificationListener', {
  web: () => import('./notification-listener-web').then(m => new m.NotificationListenerWeb()),
});

// Create wrapper with BankNotification conversion
class NotificationListenerWrapper {
  async isEnabled(): Promise<{ enabled: boolean }> {
    return NotificationListenerPlugin.isEnabled();
  }

  async requestPermission(): Promise<{ enabled: boolean }> {
    await NotificationListenerPlugin.requestPermission();
    // Check status after opening settings
    return { enabled: false }; // User needs to manually enable
  }

  async startListening(): Promise<void> {
    // No-op for now, listening starts automatically on Android
    return Promise.resolve();
  }

  async addListener(
    eventName: 'notificationReceived',
    listenerFunc: (data: BankNotification) => void
  ): Promise<PluginListenerHandle> {
    return NotificationListenerPlugin.addListener(eventName, (data: NotificationData) => {
      // Convert to BankNotification format
      const bankNotification: BankNotification = {
        appName: PACKAGE_TO_APP_NAME[data.packageName] || 'Unknown',
        packageName: data.packageName,
        title: data.title,
        text: data.text,
        timestamp: data.timestamp,
      };
      listenerFunc(bankNotification);
    });
  }

  async removeAllListeners(): Promise<void> {
    return NotificationListenerPlugin.removeAllListeners();
  }
}

const NotificationListener = new NotificationListenerWrapper();
export default NotificationListener;
