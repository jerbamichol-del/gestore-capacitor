// services/notification-listener-service.ts

import NotificationListener, { BankNotification } from '../plugins/notification-listener';
import { NotificationTransactionParser } from './notification-transaction-parser';
import { Capacitor } from '@capacitor/core';

export class NotificationListenerService {
  private static isListening = false;
  private static listenerHandle: { remove: () => void } | null = null;

  /**
   * Inizializza e avvia il listener
   */
  static async init(): Promise<boolean> {
    // Solo su Android
    if (Capacitor.getPlatform() !== 'android') {
      console.log('⚠️ NotificationListener only available on Android');
      return false;
    }

    try {
      // Controlla se già abilitato
      const { enabled } = await NotificationListener.isEnabled();
      
      if (!enabled) {
        console.log('🔔 Notification listener not enabled, requesting permission...');
        await NotificationListener.requestPermission();
        return false;
      }

      // Avvia listener
      await this.startListening();
      return true;

    } catch (error) {
      console.error('Error initializing notification listener:', error);
      return false;
    }
  }

  /**
   * Avvia ascolto notifiche
   */
  static async startListening(): Promise<void> {
    if (this.isListening) {
      console.log('⚠️ Already listening to notifications');
      return;
    }

    try {
      // Registra listener
      this.listenerHandle = await NotificationListener.addListener(
        'notificationReceived',
        this.handleNotification.bind(this)
      );

      // Avvia servizio Android
      await NotificationListener.startListening();
      
      this.isListening = true;
      console.log('✅ Notification listener started');

    } catch (error) {
      console.error('Error starting notification listener:', error);
      throw error;
    }
  }

  /**
   * Ferma ascolto notifiche
   */
  static async stopListening(): Promise<void> {
    if (!this.isListening) {
      return;
    }

    try {
      // Rimuovi listener JavaScript
      if (this.listenerHandle) {
        this.listenerHandle.remove();
        this.listenerHandle = null;
      }

      // Nota: il servizio Android continuerà a girare
      // fino a quando l'utente lo disabilita dalle impostazioni
      
      this.isListening = false;
      console.log('✅ Notification listener stopped');

    } catch (error) {
      console.error('Error stopping notification listener:', error);
    }
  }

  /**
   * Gestisce notifica ricevuta
   */
  private static async handleNotification(notification: BankNotification): Promise<void> {
    console.log('🔔 Bank notification received:', {
      app: notification.appName,
      title: notification.title,
      timestamp: new Date(notification.timestamp).toISOString()
    });

    try {
      // Parse e aggiungi transazione
      const transaction = await NotificationTransactionParser.parseNotification(
        notification.appName,
        notification.title,
        notification.text,
        notification.timestamp
      );

      if (transaction) {
        console.log('✅ Transaction added from notification:', transaction.id);
        
        // Dispatch evento custom per l'UI
        window.dispatchEvent(
          new CustomEvent('auto-transaction-added', {
            detail: { transaction, source: 'notification' }
          })
        );
      }

    } catch (error) {
      console.error('Error handling notification:', error);
    }
  }

  /**
   * Controlla se il listener è attivo
   */
  static isActive(): boolean {
    return this.isListening;
  }

  /**
   * Controlla permesso notification listener
   */
  static async checkPermission(): Promise<boolean> {
    try {
      const { enabled } = await NotificationListener.isEnabled();
      return enabled;
    } catch (error) {
      console.error('Error checking notification permission:', error);
      return false;
    }
  }

  /**
   * Apri impostazioni per abilitare listener
   */
  static async openSettings(): Promise<void> {
    try {
      await NotificationListener.requestPermission();
    } catch (error) {
      console.error('Error opening settings:', error);
    }
  }
}
