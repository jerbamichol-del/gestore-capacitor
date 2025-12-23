// src/plugins/sms-reader.ts

import { registerPlugin } from '@capacitor/core';

export interface SMSMessage {
  id: string;
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
}

const SMSReader = registerPlugin<SMSReaderPlugin>('SMSReader', {
  web: () => import('./sms-reader-web').then(m => new m.SMSReaderWeb()),
});

export default SMSReader;
