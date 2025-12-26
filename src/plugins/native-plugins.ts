/**
 * Wrapper per i plugin nativi custom
 * Importa questo file invece di usare Plugins da @capacitor/core
 */

import { registerPlugin } from '@capacitor/core';

export interface NotificationListenerPlugin {
  isEnabled(): Promise<{ enabled: boolean }>;
  requestPermission(): Promise<{ enabled: boolean }>;
  startListening(): Promise<{ listening: boolean }>;
  stopListening(): Promise<{ message: string }>;
  addListener(
    eventName: 'notificationReceived',
    listenerFunc: (data: {
      packageName: string;
      appName: string;
      title: string;
      text: string;
      timestamp: number;
    }) => void
  ): Promise<{ remove: () => Promise<void> }>;
}

export interface SMSReaderPlugin {
  checkPermission(): Promise<{ granted: boolean }>;
  requestPermission(): Promise<{ granted: boolean }>;
  getRecentSMS(options: { hours: number }): Promise<{
    messages: Array<{
      id: string;
      sender: string;
      body: string;
      timestamp: number;
    }>;
    count: number;
  }>;
}

// Registra i plugin - QUESTI NOMI DEVONO MATCHARE ESATTAMENTE @CapacitorPlugin(name = "...")
export const NotificationListener = registerPlugin<NotificationListenerPlugin>('NotificationListener');
export const SMSReader = registerPlugin<SMSReaderPlugin>('SMSReader');
