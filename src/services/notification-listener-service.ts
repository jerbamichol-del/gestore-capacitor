// src/services/notification-listener-service.ts

import NotificationListener, { BankNotification } from '../plugins/notification-listener';
import { 
  parseNotificationTransaction, 
  generateTransactionHash,
  ParsedTransaction 
} from './notification-transaction-parser';

export interface PendingTransaction {
  id: string;
  hash: string;
  appName: string;
  amount: number;
  description: string;
  currency: string;
  type: 'expense' | 'income';
  timestamp: number;
  rawNotification: BankNotification;
  confirmed: boolean;
}

const STORAGE_KEY = 'pending_transactions';
const MAX_AGE_DAYS = 30;

class NotificationListenerService {
  private isInitialized = false;
  private listenerRemove: (() => void) | null = null;
  private eventTarget = new EventTarget();

  /**
   * Initialize the notification listener service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('NotificationListenerService already initialized');
      return;
    }

    try {
      // Check if enabled
      const { enabled } = await NotificationListener.isEnabled();
      
      if (!enabled) {
        console.warn('Notification listener not enabled');
        return;
      }

      // Start listening
      await NotificationListener.startListening();

      // Add listener for notifications
      const result = await NotificationListener.addListener(
        'notificationReceived',
        (notification) => this.handleNotification(notification)
      );

      this.listenerRemove = result.remove;
      this.isInitialized = true;

      // Clean old transactions
      this.cleanOldTransactions();

      console.log('NotificationListenerService initialized successfully');
    } catch (error) {
      console.error('Failed to initialize NotificationListenerService:', error);
    }
  }

  /**
   * Request notification listener permission
   * Opens Android settings and returns current status
   */
  async requestPermission(): Promise<{ enabled: boolean }> {
    try {
      // This opens settings and returns the current status
      const result = await NotificationListener.requestPermission();
      return result;
    } catch (error) {
      console.error('Failed to request permission:', error);
      return { enabled: false };
    }
  }

  /**
   * Check if permission is granted
   */
  async isEnabled(): Promise<boolean> {
    try {
      const { enabled } = await NotificationListener.isEnabled();
      return enabled;
    } catch (error) {
      console.error('Failed to check if enabled:', error);
      return false;
    }
  }
  
  /**
   * 🆕 NEW: Check for missed notifications while app was closed
   * Scans active notifications from last 24 hours and adds them to pending
   */
  async checkAndRecoverMissedNotifications(): Promise<number> {
    try {
      console.log('📬 Checking for missed notifications...');
      
      // Call plugin method to get missed notifications
      const missedNotifications = await NotificationListener.checkMissedNotifications();
      
      if (missedNotifications.length === 0) {
        console.log('✅ No missed notifications found');
        return 0;
      }
      
      console.log(`📬 Found ${missedNotifications.length} missed notifications`);
      
      let recoveredCount = 0;
      const existing = await this.getPendingTransactions();
      
      // Process each missed notification
      for (const notification of missedNotifications) {
        // Parse transaction
        const parsed = parseNotificationTransaction(
          notification.appName,
          notification.title,
          notification.text
        );
        
        if (!parsed) {
          console.warn('⚠️ Could not parse missed notification:', notification);
          continue;
        }
        
        // Generate hash for deduplication
        const hash = generateTransactionHash(
          notification.appName,
          parsed.amount,
          notification.timestamp
        );
        
        // Check if already exists
        if (existing.some(t => t.hash === hash)) {
          console.log('⏭️ Transaction already exists, skipping:', hash);
          continue;
        }
        
        // Create pending transaction
        const pending: PendingTransaction = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          hash,
          appName: notification.appName,
          amount: parsed.amount,
          description: parsed.description,
          currency: parsed.currency,
          type: parsed.type,
          timestamp: notification.timestamp,
          rawNotification: notification,
          confirmed: false,
        };
        
        // Add to existing list
        existing.push(pending);
        recoveredCount++;
        
        console.log('✅ Recovered transaction:', pending);
      }
      
      // Save all at once if we recovered any
      if (recoveredCount > 0) {
        await this.savePendingTransactions(existing);
        console.log(`✅ Successfully recovered ${recoveredCount} transactions!`);
        
        // Emit event for each recovered transaction
        for (const transaction of existing.slice(-recoveredCount)) {
          this.emitTransactionAdded(transaction);
        }
      }
      
      return recoveredCount;
    } catch (error) {
      console.error('❌ Failed to check missed notifications:', error);
      return 0;
    }
  }

  /**
   * Handle incoming bank notification
   */
  private async handleNotification(notification: BankNotification): Promise<void> {
    console.log('Received bank notification:', notification);

    // Parse transaction
    const parsed = parseNotificationTransaction(
      notification.appName,
      notification.title,
      notification.text
    );

    if (!parsed) {
      console.warn('Could not parse notification:', notification);
      return;
    }

    // Generate hash for deduplication
    const hash = generateTransactionHash(
      notification.appName,
      parsed.amount,
      notification.timestamp
    );

    // Check if already exists
    const existing = await this.getPendingTransactions();
    if (existing.some(t => t.hash === hash)) {
      console.log('Transaction already exists, skipping');
      return;
    }

    // Create pending transaction
    const pending: PendingTransaction = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      hash,
      appName: notification.appName,
      amount: parsed.amount,
      description: parsed.description,
      currency: parsed.currency,
      type: parsed.type,
      timestamp: notification.timestamp,
      rawNotification: notification,
      confirmed: false,
    };

    // Add to storage
    const transactions = [...existing, pending];
    await this.savePendingTransactions(transactions);

    // Emit event
    this.emitTransactionAdded(pending);

    console.log('Pending transaction added:', pending);
  }

  /**
   * Get all pending transactions
   */
  async getPendingTransactions(): Promise<PendingTransaction[]> {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];

      const transactions: PendingTransaction[] = JSON.parse(stored);
      return transactions.filter(t => !t.confirmed);
    } catch (error) {
      console.error('Failed to get pending transactions:', error);
      return [];
    }
  }

  /**
   * Save pending transactions to storage
   */
  private async savePendingTransactions(transactions: PendingTransaction[]): Promise<void> {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    } catch (error) {
      console.error('Failed to save pending transactions:', error);
    }
  }

  /**
   * Confirm a pending transaction
   */
  async confirmTransaction(id: string): Promise<void> {
    const transactions = await this.getAllTransactions();
    const transaction = transactions.find(t => t.id === id);
    
    if (transaction) {
      transaction.confirmed = true;
      await this.savePendingTransactions(transactions);
      this.emitTransactionConfirmed(transaction);
    }
  }

  /**
   * Ignore/delete a pending transaction
   */
  async ignoreTransaction(id: string): Promise<void> {
    const transactions = await this.getAllTransactions();
    const filtered = transactions.filter(t => t.id !== id);
    await this.savePendingTransactions(filtered);
    this.emitTransactionIgnored(id);
  }

  /**
   * Get all transactions (including confirmed)
   */
  private async getAllTransactions(): Promise<PendingTransaction[]> {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];
      return JSON.parse(stored);
    } catch (error) {
      console.error('Failed to get all transactions:', error);
      return [];
    }
  }

  /**
   * Clean old transactions (> MAX_AGE_DAYS)
   */
  private async cleanOldTransactions(): Promise<void> {
    const transactions = await this.getAllTransactions();
    const cutoff = Date.now() - (MAX_AGE_DAYS * 24 * 60 * 60 * 1000);
    
    const filtered = transactions.filter(t => t.timestamp > cutoff);
    
    if (filtered.length !== transactions.length) {
      await this.savePendingTransactions(filtered);
      console.log(`Cleaned ${transactions.length - filtered.length} old transactions`);
    }
  }

  /**
   * Get pending count
   */
  async getPendingCount(): Promise<number> {
    const transactions = await this.getPendingTransactions();
    return transactions.length;
  }

  /**
   * Event emitters
   */
  private emitTransactionAdded(transaction: PendingTransaction): void {
    this.eventTarget.dispatchEvent(
      new CustomEvent('transactionAdded', { detail: transaction })
    );
  }

  private emitTransactionConfirmed(transaction: PendingTransaction): void {
    this.eventTarget.dispatchEvent(
      new CustomEvent('transactionConfirmed', { detail: transaction })
    );
  }

  private emitTransactionIgnored(id: string): void {
    this.eventTarget.dispatchEvent(
      new CustomEvent('transactionIgnored', { detail: id })
    );
  }

  /**
   * Add event listener
   */
  addEventListener(
    event: 'transactionAdded' | 'transactionConfirmed' | 'transactionIgnored',
    callback: (data: any) => void
  ): () => void {
    const listener = (e: Event) => callback((e as CustomEvent).detail);
    this.eventTarget.addEventListener(event, listener);
    return () => this.eventTarget.removeEventListener(event, listener);
  }

  /**
   * Cleanup
   */
  async destroy(): Promise<void> {
    if (this.listenerRemove) {
      this.listenerRemove();
      this.listenerRemove = null;
    }
    this.isInitialized = false;
  }
}

// Singleton instance
const notificationListenerService = new NotificationListenerService();
export default notificationListenerService;
