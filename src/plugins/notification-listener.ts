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

// Create wrapper with BankNotification conversion + error handling
class NotificationListenerWrapper {
  async isEnabled(): Promise<{ enabled: boolean }> {
    try {
      const result = await NotificationListenerPlugin.isEnabled();
      console.log('✅ NotificationListener.isEnabled() result:', result);
      return result;
    } catch (error: any) {
      console.error('❌ NotificationListener.isEnabled() error:', error);
      return { enabled: false };
    }
  }

  async requestPermission(): Promise<{ enabled: boolean }> {
    try {
      console.log('📱 Opening Android notification settings...');
      const result = await NotificationListenerPlugin.requestPermission();
      console.log('✅ NotificationListener.requestPermission() result:', result);
      return result;
    } catch (error: any) {
      console.error('❌ NotificationListener.requestPermission() error:', error);
      return { enabled: false };
    }
  }

  async startListening(): Promise<void> {
    try {
      console.log('🎧 Starting notification listener...');
      // No-op for now, listening starts automatically on Android
      return Promise.resolve();
    } catch (error) {
      console.error('❌ Failed to start listening:', error);
      return Promise.resolve();
    }
  }

  async addListener(
    eventName: 'notificationReceived',
    listenerFunc: (data: BankNotification) => void
  ): Promise<PluginListenerHandle> {
    try {
      console.log('👂 Adding notification listener...');
      return await NotificationListenerPlugin.addListener(eventName, (data: NotificationData) => {
        console.log('🔔 Notification received:', data);
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
    } catch (error) {
      console.error('❌ Failed to add listener:', error);
      // Return a no-op listener handle
      return {
        remove: async () => Promise.resolve()
      };
    }
  }

  async removeAllListeners(): Promise<void> {
    try {
      return await NotificationListenerPlugin.removeAllListeners();
    } catch (error) {
      console.error('❌ Failed to remove listeners:', error);
      return Promise.resolve();
    }
  }
}

const NotificationListener = new NotificationListenerWrapper();
export default NotificationListener;
