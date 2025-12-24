// src/plugins/notification-listener-web.ts

import { WebPlugin } from '@capacitor/core';
import type { NotificationListenerPlugin, NotificationData, PluginListenerHandle } from './notification-listener';

export class NotificationListenerWeb extends WebPlugin implements NotificationListenerPlugin {
  constructor() {
    super();
    console.log('NotificationListenerWeb initialized (web platform does not support notification listening)');
  }

  async isEnabled(): Promise<{ enabled: boolean }> {
    console.log('isEnabled called on web - returning false');
    return { enabled: false };
  }

  async requestPermission(): Promise<{ enabled: boolean }> {
    console.log('requestPermission called on web - not supported');
    return { enabled: false };
  }

  async startListening(): Promise<void> {
    console.log('startListening called on web - not supported');
    return Promise.resolve();
  }

  async addListener(
    eventName: 'notificationReceived',
    listenerFunc: (data: NotificationData) => void
  ): Promise<PluginListenerHandle> {
    console.log('addListener called on web - not supported');
    // Return a no-op handle
    return {
      remove: async () => {
        console.log('Listener removed on web');
      }
    };
  }

  async removeAllListeners(): Promise<void> {
    console.log('removeAllListeners called on web');
    return Promise.resolve();
  }
}
