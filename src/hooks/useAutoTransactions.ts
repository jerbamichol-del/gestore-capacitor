// hooks/useAutoTransactions.ts

import { useState, useEffect, useCallback } from 'react';
import { AutoTransaction } from '../types/transaction';
import { AutoTransactionService } from '../services/auto-transaction-service';
import { SMSTransactionParser } from '../services/sms-transaction-parser';
import { NotificationListenerService } from '../services/notification-listener-service';
import { SmartNotifications } from '../services/smart-notifications';
import { Capacitor } from '@capacitor/core';

export const useAutoTransactions = () => {
  const [pendingTransactions, setPendingTransactions] = useState<AutoTransaction[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const [notificationListenerEnabled, setNotificationListenerEnabled] = useState(false);
  const [smsPermissionGranted, setSmsPermissionGranted] = useState(false);

  // Load pending transactions
  const loadPending = useCallback(async () => {
    try {
      const pending = await AutoTransactionService.getPendingTransactions();
      setPendingTransactions(pending);
      setPendingCount(pending.length);
    } catch (error) {
      console.error('Error loading pending transactions:', error);
    }
  }, []);

  // Initialize services
  useEffect(() => {
    const init = async () => {
      if (isInitialized) return;

      try {
        console.log('🚀 Initializing auto-transaction detection...');

        // 1. Init smart notifications
        await SmartNotifications.init();

        // 2. Init notification listener (Android only)
        if (Capacitor.getPlatform() === 'android') {
          const enabled = await NotificationListenerService.init();
          setNotificationListenerEnabled(enabled);
          
          if (!enabled) {
            console.log('⚠️ Notification listener not enabled.');
            console.log('ℹ️ User needs to grant notification access in Settings.');
          } else {
            console.log('✅ Notification listener active - monitoring banking apps');
          }
        }

        // 3. Check SMS permission (Android only)
        if (Capacitor.getPlatform() === 'android') {
          const smsPermission = await SMSTransactionParser.checkPermission();
          setSmsPermissionGranted(smsPermission);

          if (smsPermission) {
            console.log('✅ SMS permission granted - scanning recent messages...');
            // Scan SMS ultimi 24h
            try {
              const transactions = await SMSTransactionParser.scanRecentSMS(24);
              console.log(`📱 SMS Scan complete: ${transactions.length} transactions found`);
            } catch (error) {
              console.error('Error scanning SMS:', error);
            }
          } else {
            console.log('⚠️ SMS permission not granted.');
            console.log('ℹ️ Call requestSMSPermission() to ask user.');
          }
        }

        // 4. Load existing pending
        await loadPending();

        // 5. Cleanup old transactions (30+ days)
        const deleted = await AutoTransactionService.cleanupOldTransactions();
        if (deleted > 0) {
          console.log(`🧹 Cleaned up ${deleted} old transactions`);
        }

        setIsInitialized(true);
        console.log('✅ Auto-transaction detection initialized');

      } catch (error) {
        console.error('Error initializing auto-transactions:', error);
      }
    };

    init();
  }, [isInitialized, loadPending]);

  // Listen for new auto-transactions
  useEffect(() => {
    const handleNewTransaction = (event: any) => {
      console.log('🆕 New auto-transaction detected:', event.detail);
      loadPending();
      
      // Optional: Show toast notification
      const { transaction, source } = event.detail;
      if (transaction) {
        console.log(`✨ ${source}: ${transaction.description} - €${transaction.amount}`);
      }
    };

    window.addEventListener('auto-transaction-added', handleNewTransaction);

    return () => {
      window.removeEventListener('auto-transaction-added', handleNewTransaction);
    };
  }, [loadPending]);

  // Get stats
  const getStats = useCallback(async () => {
    return await AutoTransactionService.getStats();
  }, []);

  // Request notification listener permission
  const requestNotificationPermission = useCallback(async () => {
    try {
      await NotificationListenerService.openSettings();
      // Check dopo 2 secondi (tempo per l'utente di abilitare)
      setTimeout(async () => {
        const enabled = await NotificationListenerService.checkPermission();
        setNotificationListenerEnabled(enabled);
        if (enabled) {
          console.log('✅ Notification listener enabled successfully!');
        }
      }, 2000);
    } catch (error) {
      console.error('Error requesting notification permission:', error);
    }
  }, []);

  // Request SMS permission
  const requestSMSPermission = useCallback(async () => {
    try {
      const granted = await SMSTransactionParser.requestPermission();
      setSmsPermissionGranted(granted);
      
      if (granted) {
        console.log('✅ SMS permission granted!');
        // Auto-scan dopo aver ottenuto il permesso
        const transactions = await SMSTransactionParser.scanRecentSMS(24);
        await loadPending();
        console.log(`📱 Scanned ${transactions.length} transactions from SMS`);
      } else {
        console.log('⚠️ SMS permission denied');
      }

      return granted;
    } catch (error) {
      console.error('Error requesting SMS permission:', error);
      return false;
    }
  }, [loadPending]);

  // Manually scan SMS
  const scanSMS = useCallback(async (hours: number = 24) => {
    try {
      if (!smsPermissionGranted) {
        console.log('⚠️ SMS permission not granted. Call requestSMSPermission() first.');
        return [];
      }

      const transactions = await SMSTransactionParser.scanRecentSMS(hours);
      await loadPending();
      return transactions;
    } catch (error) {
      console.error('Error scanning SMS:', error);
      return [];
    }
  }, [smsPermissionGranted, loadPending]);

  return {
    pendingTransactions,
    pendingCount,
    isInitialized,
    notificationListenerEnabled,
    smsPermissionGranted,
    loadPending,
    getStats,
    requestNotificationPermission,
    requestSMSPermission,
    scanSMS
  };
};
