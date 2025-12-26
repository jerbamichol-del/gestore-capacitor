import { registerPlugin } from '@capacitor/core';
import type { NotificationListenerPlugin, SMSReaderPlugin } from './definitions';

const NotificationListener = registerPlugin<NotificationListenerPlugin>(
  'NotificationListener',
  {
    web: () => import('./web').then(m => new m.NotificationListenerWeb()),
  }
);

const SMSReader = registerPlugin<SMSReaderPlugin>('SMSReader', {
  web: () => import('./web').then(m => new m.SMSReaderWeb()),
});

export * from './definitions';
export { NotificationListener, SMSReader };
