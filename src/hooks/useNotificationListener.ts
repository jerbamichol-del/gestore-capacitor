// src/hooks/useNotificationListener.ts

import { useState, useEffect } from 'react';
import { App } from '@capacitor/app';
import notificationListenerService, { PendingTransaction } from '../services/notification-listener-service';

export interface UseNotificationListenerReturn {
  pendingTransactions: PendingTransaction[];
  pendingCount: number;
  isEnabled: boolean;
  isLoading: boolean;
  requestPermission: () => Promise<void>;
  confirmTransaction: (id: string) => Promise<void>;
  ignoreTransaction: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * React hook for managing notification listener and pending transactions
 */
export function useNotificationListener(): UseNotificationListenerReturn {
  const [pendingTransactions, setPendingTransactions] = useState<PendingTransaction[]>([]);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load initial state
  useEffect(() => {
    loadInitialState();
  }, []);

  // Listen to app state changes (to detect returning from settings)
  useEffect(() => {
    const appStateListener = App.addListener('appStateChange', async (state) => {
      if (state.isActive) {
        // App came to foreground, recheck permission
        try {
          const enabled = await notificationListenerService.isEnabled();
          setIsEnabled(enabled);
          
          if (enabled) {
            // If just enabled, initialize and refresh
            await notificationListenerService.initialize();
            await refresh();
          }
        } catch (error) {
          console.error('Failed to check permission on app resume:', error);
        }
      }
    });

    return () => {
      appStateListener.then(listener => listener.remove());
    };
  }, []);

  // Listen to service events
  useEffect(() => {
    const unsubscribeAdded = notificationListenerService.addEventListener(
      'transactionAdded',
      () => refresh()
    );

    const unsubscribeConfirmed = notificationListenerService.addEventListener(
      'transactionConfirmed',
      () => refresh()
    );

    const unsubscribeIgnored = notificationListenerService.addEventListener(
      'transactionIgnored',
      () => refresh()
    );

    return () => {
      unsubscribeAdded();
      unsubscribeConfirmed();
      unsubscribeIgnored();
    };
  }, []);

  const loadInitialState = async () => {
    try {
      setIsLoading(true);
      
      // Check if enabled
      const enabled = await notificationListenerService.isEnabled();
      setIsEnabled(enabled);

      // Initialize if enabled
      if (enabled) {
        await notificationListenerService.initialize();
      }

      // Load pending transactions
      const transactions = await notificationListenerService.getPendingTransactions();
      setPendingTransactions(transactions);
    } catch (error) {
      console.error('Failed to load notification listener state:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const requestPermission = async () => {
    try {
      // This will open Android settings
      await notificationListenerService.requestPermission();
      
      // Note: The actual permission check will happen when app resumes
      // via the appStateChange listener above
    } catch (error) {
      console.error('Failed to request permission:', error);
    }
  };

  const confirmTransaction = async (id: string) => {
    try {
      await notificationListenerService.confirmTransaction(id);
      await refresh();
    } catch (error) {
      console.error('Failed to confirm transaction:', error);
    }
  };

  const ignoreTransaction = async (id: string) => {
    try {
      await notificationListenerService.ignoreTransaction(id);
      await refresh();
    } catch (error) {
      console.error('Failed to ignore transaction:', error);
    }
  };

  const refresh = async () => {
    try {
      const transactions = await notificationListenerService.getPendingTransactions();
      setPendingTransactions(transactions);
    } catch (error) {
      console.error('Failed to refresh transactions:', error);
    }
  };

  return {
    pendingTransactions,
    pendingCount: pendingTransactions.length,
    isEnabled,
    isLoading,
    requestPermission,
    confirmTransaction,
    ignoreTransaction,
    refresh,
  };
}
