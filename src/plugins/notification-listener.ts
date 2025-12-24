// src/plugins/notification-listener.ts

import { registerPlugin } from '@capacitor/core';

export interface NotificationListenerPlugin {
  /**
   * Check if notification listener is enabled
   */
  isEnabled(): Promise<{ enabled: boolean }>;

  /**
   * Request notification listener permission
   * Opens Android settings
   */
  requestPermission(): Promise<void>;

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

const NotificationListener = registerPlugin<NotificationListenerPlugin>('NotificationListener', {
  web: () => import('./notification-listener-web').then(m => new m.NotificationListenerWeb()),
});

export default NotificationListener;
