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
  private nativePluginAvailable = true;

  async isEnabled(): Promise<{ enabled: boolean }> {
    if (!this.nativePluginAvailable) {
      console.log('⚠️ NotificationListener native plugin not available');
      return { enabled: false };
    }

    try {
      return await NotificationListenerPlugin.isEnabled();
    } catch (error: any) {
      console.log('Failed to check if enabled:', error);
      // Se il plugin non è implementato, disabilitalo permanentemente
      if (error?.message?.includes('not implemented')) {
        this.nativePluginAvailable = false;
      }
      return { enabled: false };
    }
  }

  async requestPermission(): Promise<{ enabled: boolean }> {
    if (!this.nativePluginAvailable) {
      console.log('⚠️ NotificationListener native plugin not available');
      return { enabled: false };
    }

    try {
      // This opens Android settings and returns immediately
      // The native plugin will return { enabled: false } because user hasn't acted yet
      return await NotificationListenerPlugin.requestPermission();
    } catch (error: any) {
      console.log('Failed to request permission:', error);
      // Se il plugin non è implementato, disabilitalo permanentemente
      if (error?.message?.includes('not implemented')) {
        this.nativePluginAvailable = false;
      }
      return { enabled: false };
    }
  }

  async startListening(): Promise<void> {
    if (!this.nativePluginAvailable) {
      return Promise.resolve();
    }

    try {
      // No-op for now, listening starts automatically on Android
      return Promise.resolve();
    } catch (error) {
      console.log('Failed to start listening:', error);
      return Promise.resolve();
    }
  }

  async addListener(
    eventName: 'notificationReceived',
    listenerFunc: (data: BankNotification) => void
  ): Promise<PluginListenerHandle> {
    if (!this.nativePluginAvailable) {
      // Return a no-op listener handle
      return {
        remove: async () => Promise.resolve()
      };
    }

    try {
      return await NotificationListenerPlugin.addListener(eventName, (data: NotificationData) => {
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
      console.log('Failed to add listener:', error);
      // Return a no-op listener handle
      return {
        remove: async () => Promise.resolve()
      };
    }
  }

  async removeAllListeners(): Promise<void> {
    if (!this.nativePluginAvailable) {
      return Promise.resolve();
    }

    try {
      return await NotificationListenerPlugin.removeAllListeners();
    } catch (error) {
      console.log('Failed to remove listeners:', error);
      return Promise.resolve();
    }
  }
}

const NotificationListener = new NotificationListenerWrapper();
export default NotificationListener;
