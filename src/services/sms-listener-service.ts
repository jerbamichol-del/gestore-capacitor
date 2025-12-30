// src/services/sms-listener-service.ts

import { Capacitor } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
import SMSReader from '../plugins/sms-reader';
import { SMSTransactionParser } from './sms-transaction-parser';
import { AutoTransactionService } from './auto-transaction-service';
import type { SMSMessage } from '../plugins/sms-reader';
import type { AutoTransaction } from '../types/transaction';

export interface PendingSMSTransaction {
  id: string;
  sms: SMSMessage;
  transaction: Omit<AutoTransaction, 'id' | 'createdAt' | 'sourceHash' | 'status'>;
  timestamp: number;
}

class SMSListenerService {
  private listener: PluginListenerHandle | null = null;
  private isInitialized = false;
  private pendingTransactions: PendingSMSTransaction[] = [];
  private readonly STORAGE_KEY = 'pending_sms_transactions';

  /**
   * Check if SMS permission is granted
   */
  async isEnabled(): Promise<boolean> {
    if (Capacitor.getPlatform() !== 'android') {
      return false;
    }

    try {
      const result = await SMSReader.checkPermission();
      console.log('✅ SMSReader.checkPermission() result:', result);
      return result.granted;
    } catch (error) {
      console.error('❌ Error checking SMS permission:', error);
      return false;
    }
  }

  /**
   * Request SMS permission
   */
  async requestPermission(): Promise<{ enabled: boolean }> {
    if (Capacitor.getPlatform() !== 'android') {
      return { enabled: false };
    }

    try {
      console.log('📱 Requesting SMS permission...');
      const result = await SMSReader.requestPermission();
      console.log('✅ SMS permission request result:', result);
      return { enabled: result.granted };
    } catch (error) {
      console.error('❌ Error requesting SMS permission:', error);
      return { enabled: false };
    }
  }

  /**
   * Initialize SMS listener - starts listening for incoming SMS
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('⚠️ SMS listener already initialized');
      return;
    }

    if (Capacitor.getPlatform() !== 'android') {
      console.log('⚠️ SMS listener only available on Android');
      return;
    }

    try {
      // Check permission first
      const enabled = await this.isEnabled();
      if (!enabled) {
        console.log('⚠️ SMS permission not granted - cannot initialize listener');
        return;
      }

      console.log('🚀 Initializing SMS listener...');

      // Load any pending transactions from storage
      await this.loadPendingTransactions();

      // Register real-time SMS listener
      await this.startListener();

      // Scan recent SMS (last 24 hours)
      console.log('📱 Scanning recent SMS (last 24 hours)...');
      await SMSTransactionParser.scanRecentSMS(24);

      this.isInitialized = true;
      console.log('✅ SMS listener initialized successfully');

    } catch (error) {
      console.error('❌ Error initializing SMS listener:', error);
      throw error;
    }
  }

  /**
   * Start listening for incoming SMS
   */
  private async startListener(): Promise<void> {
    if (this.listener) {
      console.log('⚠️ SMS listener already started');
      return;
    }

    console.log('🎧 Starting SMS real-time listener...');
    console.log('👂 Adding SMS listener...');

    try {
      this.listener = await SMSReader.addListener('smsReceived', async (sms: SMSMessage) => {
        console.log('📨 SMS received in listener!');
        console.log('📨 Sender:', sms.sender);
        console.log('📨 Body:', sms.body);
        console.log('📨 Timestamp:', sms.timestamp);

        await this.handleIncomingSMS(sms);
      });

      console.log('✅ SMS listener registered successfully');
    } catch (error) {
      console.error('❌ Error starting SMS listener:', error);
      throw error;
    }
  }

  /**
   * Handle incoming SMS message
   */
  private async handleIncomingSMS(sms: SMSMessage): Promise<void> {
    try {
      console.log('🔍 Processing incoming SMS...');

      // Parse SMS to transaction
      const transaction = SMSTransactionParser.parseSMS(
        sms.sender,
        sms.body,
        sms.timestamp
      );

      if (!transaction) {
        console.log('⚠️ SMS not recognized as transaction');
        return;
      }

      console.log('✅ Transaction detected:', transaction);

      // Check if duplicate
      const hash = AutoTransactionService.generateTransactionHash(
        transaction.amount,
        transaction.date,
        transaction.account,
        transaction.description
      );

      const isDuplicate = await AutoTransactionService.isDuplicate(hash);

      if (isDuplicate) {
        console.log('⚠️ Duplicate transaction - skipping');
        return;
      }

      // Add to pending queue
      const pending: PendingSMSTransaction = {
        id: Date.now().toString(),
        sms,
        transaction,
        timestamp: Date.now()
      };

      this.pendingTransactions.push(pending);
      await this.savePendingTransactions();

      console.log('✅ Transaction added to pending queue');
      console.log('📊 Pending transactions:', this.pendingTransactions.length);

    } catch (error) {
      console.error('❌ Error handling incoming SMS:', error);
    }
  }

  /**
   * Get pending transactions
   */
  async getPendingTransactions(): Promise<PendingSMSTransaction[]> {
    console.log('📬 Retrieving pending SMS transactions...');
    console.log('✅ Found', this.pendingTransactions.length, 'pending SMS transactions');
    return this.pendingTransactions;
  }

  /**
   * Confirm a pending transaction
   */
  async confirmTransaction(id: string): Promise<void> {
    console.log('✅ Confirming SMS transaction:', id);

    const pending = this.pendingTransactions.find(t => t.id === id);
    if (!pending) {
      console.error('❌ Transaction not found:', id);
      return;
    }

    try {
      // Add to database
      await AutoTransactionService.addAutoTransaction(pending.transaction);

      // Remove from pending
      this.pendingTransactions = this.pendingTransactions.filter(t => t.id !== id);
      await this.savePendingTransactions();

      console.log('✅ SMS transaction confirmed and saved');
    } catch (error) {
      console.error('❌ Error confirming SMS transaction:', error);
      throw error;
    }
  }

  /**
   * Ignore a pending transaction
   */
  async ignoreTransaction(id: string): Promise<void> {
    console.log('🚫 Ignoring SMS transaction:', id);

    // Remove from pending
    this.pendingTransactions = this.pendingTransactions.filter(t => t.id !== id);
    await this.savePendingTransactions();

    console.log('✅ SMS transaction ignored');
  }

  /**
   * Save pending transactions to storage
   */
  private async savePendingTransactions(): Promise<void> {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.pendingTransactions));
    } catch (error) {
      console.error('❌ Error saving pending SMS transactions:', error);
    }
  }

  /**
   * Load pending transactions from storage
   */
  private async loadPendingTransactions(): Promise<void> {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.pendingTransactions = JSON.parse(stored);
        console.log('📬 Loaded', this.pendingTransactions.length, 'pending SMS transactions from storage');
      }
    } catch (error) {
      console.error('❌ Error loading pending SMS transactions:', error);
      this.pendingTransactions = [];
    }
  }

  /**
   * Cleanup - stop listener and clear resources
   */
  async destroy(): Promise<void> {
    console.log('🧹 Destroying SMS listener service...');

    if (this.listener) {
      try {
        await this.listener.remove();
        console.log('✅ SMS listener removed');
      } catch (error) {
        console.error('❌ Error removing SMS listener:', error);
      }
      this.listener = null;
    }

    this.isInitialized = false;
    console.log('✅ SMS listener service destroyed');
  }
}

// Export singleton instance
const smsListenerService = new SMSListenerService();
export default smsListenerService;
