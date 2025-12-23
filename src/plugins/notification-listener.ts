// src/plugins/notification-listener.ts

import { registerPlugin } from '@capacitor/core';

export interface NotificationListenerPlugin {
  /**
   * Check if notification listener is enabled
   */
  isEnabled(): Promise<{ enabled: boolean }>;

  /**
   * Request notification listener permission (opens settings)
   */
  requestPermission(): Promise<{ opened?: boolean; enabled?: boolean }>;

  /**
   * Start listening to notifications
   */
  startListening(): Promise<{ listening: boolean }>;

  /**
   * Stop listening to notifications
   */
  stopListening(): Promise<{ message: string }>;

  /**
   * Add listener for bank notifications
   */
  addListener(
    eventName: 'notificationReceived',
    listenerFunc: (data: BankNotification) => void
  ): Promise<{ remove: () => void }>;
}

export interface BankNotification {
  packageName: string;
  appName: string;
  title: string;
  text: string;
  timestamp: number;
}

const NotificationListener = registerPlugin<NotificationListenerPlugin>(
  'NotificationListener',
  {
    web: () => {
      // Mock implementation for web/dev
      return {
        isEnabled: async () => ({ enabled: false }),
        requestPermission: async () => ({ enabled: false }),
        startListening: async () => ({ listening: false }),
        stopListening: async () => ({ message: 'Not available on web' }),
        addListener: async () => ({ remove: () => {} })
      } as any;
    }
  }
);

export default NotificationListener;
