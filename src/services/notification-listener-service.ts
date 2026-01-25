import NotificationListener, { BankNotification } from '../plugins/notification-listener';
import { NotificationTransactionParser } from './notification-transaction-parser';
import { AutoTransactionService } from './auto-transaction-service';
import { Capacitor } from '@capacitor/core';
import type { AutoTransaction } from '../types/transaction';

// Re-export type for consumers
export type PendingTransaction = AutoTransaction;

import { md5 } from '../utils/hash';

// Key for storage
const PROCESSED_CACHE_KEY = 'processed_raw_notifications';
const MAX_CACHE_SIZE = 100;

export class NotificationListenerService {
  private static isListening = false;
  private static listenerHandle: { remove: () => void } | null = null;
  private static initialized = false;

  // Cache for raw notification hashes (appName + title + text)
  // Used to prevent re-processing the same notification from the native queue
  private static processedCache: string[] = [];

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

    // Load cache
    this.loadProcessedCache();

    try {
      // Check if already enabled
      const { enabled } = await NotificationListener.isEnabled();

      if (!enabled) {
        console.log('🔔 Notification listener not enabled');
        return false;
      }

      // Start listening
      await this.startListening();

      // ✅ Sync pending on init
      await this.checkPendingNotifications();

      this.initialized = true;
      return true;

    } catch (error) {
      console.error('Error initializing notification listener:', error);
      return false;
    }
  }

  /**
   * ✅ NEW: Public method to manually trigger pending check
   * Useful on app resume
   */
  static async checkPendingNotifications(): Promise<void> {
    try {
      console.log('🔄 Checking for pending notifications from native queue...');
      const pendingNative = await NotificationListener.getPendingNotifications();

      if (pendingNative.length > 0) {
        console.log(`📥 Processing ${pendingNative.length} pending native notifications...`);
        for (const notification of pendingNative) {
          await this.handleNotification(notification);
        }
      }
    } catch (error) {
      console.error('Error checking pending notifications:', error);
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
   * Load processed cache from storage
   */
  private static loadProcessedCache() {
    try {
      const stored = localStorage.getItem(PROCESSED_CACHE_KEY);
      if (stored) {
        this.processedCache = JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to load processed cache', e);
      this.processedCache = [];
    }
  }

  /**
   * Add hash to processed cache and save
   */
  private static markAsProcessed(hash: string) {
    if (this.processedCache.includes(hash)) return;

    this.processedCache.push(hash);

    // Trim cache
    if (this.processedCache.length > MAX_CACHE_SIZE) {
      this.processedCache = this.processedCache.slice(-MAX_CACHE_SIZE);
    }

    try {
      localStorage.setItem(PROCESSED_CACHE_KEY, JSON.stringify(this.processedCache));
    } catch (e) {
      console.error('Failed to save processed cache', e);
    }
  }

  /**
   * Handle incoming notification
   */
  private static async handleNotification(notification: BankNotification): Promise<void> {
    console.log('🔔 Bank notification received:', notification.appName);

    // ✅ CRITICAL FIX: Robust De-duplication using Raw Hash
    // This ignores timestamp variations and ensures we only process unique TEXT content once.
    const rawData = `${notification.appName}|${notification.title}|${notification.text}`;
    const rawHash = md5(rawData);

    if (this.processedCache.includes(rawHash)) {
      console.log(`⏭️ Notification already processed (Raw Match): ${rawHash.substring(0, 8)}`);
      return;
    }

    // 1. Save Raw Data (Offline-First / Re-parsing Support)
    let rawEventId: string | null = null;
    try {
      const { RawDataService } = await import('./raw-data-service');
      rawEventId = await RawDataService.saveRawNotification(notification);
    } catch (e) {
      console.error('Failed to save raw event (continuing processing anyway):', e);
    }

    try {
      // Parser handles logic: parsing -> checking transfer -> saving to DB -> dispatching events
      const transaction = await NotificationTransactionParser.parseNotification(
        notification.appName,
        notification.title,
        notification.text,
        notification.timestamp
      );

      // Always mark as processed if we attempted to parse it (to avoid endless retry loops on same content)
      // Even if it returned null (no regex match), we don't want to retry it endlessly.
      this.markAsProcessed(rawHash);

      if (rawEventId) {
        const { RawDataService } = await import('./raw-data-service');
        if (transaction) {
          await RawDataService.markAsProcessed(rawEventId, transaction.id);
          console.log('✅ Transaction processed & Raw Event linked:', transaction.id);
        } else {
          // Parsed but no regex match -> Ignored/Invalid content
          await RawDataService.markAsIgnored(rawEventId, 'No regex match found');
        }
      }

    } catch (error: any) {
      console.error('Error handling notification:', error);
      if (rawEventId) {
        const { RawDataService } = await import('./raw-data-service');
        await RawDataService.markAsError(rawEventId, error.message || 'Unknown error');
      }
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

