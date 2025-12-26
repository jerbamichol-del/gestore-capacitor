import { WebPlugin } from '@capacitor/core';
import type { NotificationListenerPlugin, SMSReaderPlugin } from './definitions';

export class NotificationListenerWeb
  extends WebPlugin
  implements NotificationListenerPlugin
{
  async isEnabled(): Promise<{ enabled: boolean }> {
    console.warn('NotificationListener not available on web');
    return { enabled: false };
  }

  async requestPermission(): Promise<{ enabled: boolean }> {
    console.warn('NotificationListener not available on web');
    return { enabled: false };
  }

  async startListening(): Promise<{ listening: boolean }> {
    console.warn('NotificationListener not available on web');
    return { listening: false };
  }

  async stopListening(): Promise<{ message: string }> {
    console.warn('NotificationListener not available on web');
    return { message: 'Not available on web' };
  }
}

export class SMSReaderWeb extends WebPlugin implements SMSReaderPlugin {
  async checkPermission(): Promise<{ granted: boolean }> {
    console.warn('SMSReader not available on web');
    return { granted: false };
  }

  async requestPermission(): Promise<{ granted: boolean }> {
    console.warn('SMSReader not available on web');
    return { granted: false };
  }

  async getRecentSMS(): Promise<{
    messages: Array<{
      id: string;
      sender: string;
      body: string;
      timestamp: number;
    }>;
    count: number;
  }> {
    console.warn('SMSReader not available on web');
    return { messages: [], count: 0 };
  }
}
