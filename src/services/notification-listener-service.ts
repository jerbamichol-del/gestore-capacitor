import NotificationListener, { BankNotification } from '../plugins/notification-listener';
import { NotificationTransactionParser } from './notification-transaction-parser';
import { AutoTransactionService } from './auto-transaction-service';
import { Capacitor } from '@capacitor/core';
import type { AutoTransaction } from '../types/transaction';

// Re-export type for consumers
export type PendingTransaction = AutoTransaction;

export class NotificationListenerService {
  private static isListening = false;
  private static listenerHandle: { remove: () => void } | null = null;
  private static initialized = false;

  /**
   * Initialize the service
   * Alias for init() to match hook expectation
   */
  static async initialize(): Promise<boolean> {
    return this.init();
  }

  /**
   * Main initialization logic
   */
  static async init(): Promise<boolean> {
    // Only on Android
    if (Capacitor.getPlatform() !== 'android') {
      console.log('⚠️ NotificationListener only available on Android');
      return false;
    }

    if (this.initialized) return true;

    try {
      // Check if already enabled
      const { enabled } = await NotificationListener.isEnabled();

      if (!enabled) {
        console.log('🔔 Notification listener not enabled');
        return false;
      }

      // Start listening
      await this.startListening();
      this.initialized = true;
      return true;

    } catch (error) {
      console.error('Error initializing notification listener:', error);
      return false;
    }
  }

  /**
   * Start listening for notifications
   */
  static async startListening(): Promise<void> {
    if (this.isListening) {
      return;
    }

    try {
      // Remove existing listener if any
      if (this.listenerHandle) {
        this.listenerHandle.remove();
      }

      // Register JS listener
      this.listenerHandle = await NotificationListener.addListener(
        'notificationReceived',
        this.handleNotification.bind(this)
      );

      // Start Android Service
      await NotificationListener.startListening();

      this.isListening = true;
      console.log('✅ Notification listener started');

    } catch (error) {
      console.error('Error starting notification listener:', error);
      throw error;
    }
  }

  /**
   * Handle incoming notification
   */
  private static async handleNotification(notification: BankNotification): Promise<void> {
    console.log('🔔 Bank notification received:', notification.appName);

    try {
      // Parser handles logic: parsing -> checking transfer -> saving to DB -> dispatching events
      const transaction = await NotificationTransactionParser.parseNotification(
        notification.appName,
        notification.title,
        notification.text,
        notification.timestamp
      );

      if (transaction) {
        console.log('✅ Transaction processed:', transaction.id);
        // Note: NotificationTransactionParser already dispatches 'auto-transaction-added' 
        // or 'auto-transaction-confirmation-needed' via AutoTransactionService/Parser
      }

    } catch (error) {
      console.error('Error handling notification:', error);
    }
  }

  /**
   * Stop listening
   */
  static async stopListening(): Promise<void> {
    if (!this.isListening) return;

    try {
      if (this.listenerHandle) {
        this.listenerHandle.remove();
        this.listenerHandle = null;
      }
      this.isListening = false;
      console.log('✅ Notification listener stopped');
    } catch (error) {
      console.error('Error stopping notification listener:', error);
    }
  }

  /**
   * Cleanup method called by hook on unmount
   */
  static destroy(): void {
    this.stopListening();
  }

  // --- Permission/Status Methods ---

  static async isEnabled(): Promise<boolean> {
    try {
      const { enabled } = await NotificationListener.isEnabled();
      return enabled;
    } catch (error) {
      console.error('Error checking permission:', error);
      return false;
    }
  }

  static async requestPermission(): Promise<{ enabled: boolean }> {
    try {
      console.log('📱 Requesting Android Notification Permission...');
      await NotificationListener.requestPermission();
      // On Android, this opens settings. user needs to come back.
      // We return current state (likely false until they come back)
      return NotificationListener.isEnabled();
    } catch (error) {
      console.error('Error requesting permission:', error);
      return { enabled: false };
    }
  }

  // --- Transaction Management (Delegates to AutoTransactionService) ---

  static async getPendingTransactions(): Promise<PendingTransaction[]> {
    return AutoTransactionService.getPendingTransactions();
  }

  static async confirmTransaction(id: string): Promise<void> {
    // Determine if it's a transfer logic? 
    // For simple confirmation from list:
    return AutoTransactionService.confirmTransaction(id);
  }

  static async ignoreTransaction(id: string): Promise<void> {
    return AutoTransactionService.ignoreTransaction(id);
  }
}

export default NotificationListenerService;

