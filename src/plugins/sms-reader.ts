// src/plugins/sms-reader.ts

import { registerPlugin } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';

export interface SMSMessage {
  sender: string;
  body: string;
  timestamp: number;
}

export interface SMSReaderPlugin {
  /**
   * Check if SMS read permission is granted
   */
  checkPermission(): Promise<{ granted: boolean }>;

  /**
   * Request SMS read permission from user
   */
  requestPermission(): Promise<{ granted: boolean }>;

  /**
   * Get recent SMS messages
   * @param options.hours - How many hours back to scan (default: 24)
   */
  getRecentSMS(options: { hours: number }): Promise<{ messages: SMSMessage[]; count: number }>;

  /**
   * Listen for incoming SMS messages in real-time
   * @param eventName - Event name (always 'smsReceived')
   * @param listenerFunc - Callback function that receives SMS data
   */
  addListener(
    eventName: 'smsReceived',
    listenerFunc: (message: SMSMessage) => void
  ): Promise<PluginListenerHandle>;

  /**
   * Remove all listeners for this plugin
   */
  removeAllListeners(): Promise<void>;
}

const SMSReader = registerPlugin<SMSReaderPlugin>('SMSReader', {
  web: () => import('./sms-reader-web').then(m => new m.SMSReaderWeb()),
});

export default SMSReader;
