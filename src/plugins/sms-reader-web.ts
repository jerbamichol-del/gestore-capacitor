// src/plugins/sms-reader-web.ts

import { WebPlugin } from '@capacitor/core';
import type { SMSReaderPlugin, SMSMessage } from './sms-reader';

export class SMSReaderWeb extends WebPlugin implements SMSReaderPlugin {
  async checkPermission(): Promise<{ granted: boolean }> {
    console.log('SMS Reader not available on web');
    return { granted: false };
  }

  async requestPermission(): Promise<{ granted: boolean }> {
    console.log('SMS Reader not available on web');
    return { granted: false };
  }

  async getRecentSMS(): Promise<{ messages: SMSMessage[]; count: number }> {
    console.log('SMS Reader not available on web');
    return { messages: [], count: 0 };
  }
}
