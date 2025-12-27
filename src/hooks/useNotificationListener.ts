// src/hooks/useNotificationListener.ts

import { useState, useEffect, useCallback, useRef } from 'react';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import notificationListenerService from '../services/notification-listener-service';
import type { PendingTransaction } from '../services/notification-listener-service';

export function useNotificationListener() {
  const [pendingTransactions, setPendingTransactions] = useState<PendingTransaction[]>([]);
  const [isEnabled, setIsEnabled] = useState(false);
  const isCheckingRef = useRef(false);

  // Check if running on Android
  const isAndroid = Capacitor.getPlatform() === 'android';

  // Function to check permission status
  const checkPermissionStatus = useCallback(async () => {
    if (!isAndroid) return;
    if (isCheckingRef.current) return; // Prevent concurrent checks
    
    isCheckingRef.current = true;
    
    try {
      const enabled = await notificationListenerService.isEnabled();
      setIsEnabled(enabled);
      
      // If enabled, load pending transactions
      if (enabled) {
        try {
          const pending = await notificationListenerService.getPendingTransactions();
          setPendingTransactions(pending);
        } catch (transError) {
          console.error('Error loading pending transactions:', transError);
          // Don't crash, just set empty array
          setPendingTransactions([]);
        }
      }
    } catch (error) {
      console.error('Error checking notification permission:', error);
      // CRITICAL: Don't crash the app, just set safe defaults
      setIsEnabled(false);
      setPendingTransactions([]);
    } finally {
      isCheckingRef.current = false;
    }
  }, [isAndroid]);

  // Request notification listener permission
  const requestPermission = useCallback(async () => {
    if (!isAndroid) {
      return { enabled: false };
    }

    try {
      const result = await notificationListenerService.requestPermission();
      // Permission request opens Android settings - don't update state here
      // State will be updated when app returns to foreground
      return result;
    } catch (error) {
      console.error('Error requesting permission:', error);
      return { enabled: false };
    }
  }, [isAndroid]);

  // Confirm a pending transaction
  const confirmTransaction = useCallback(async (id: string) => {
    try {
      await notificationListenerService.confirmTransaction(id);
      // Refresh pending transactions
      const pending = await notificationListenerService.getPendingTransactions();
      setPendingTransactions(pending);
    } catch (error) {
      console.error('Error confirming transaction:', error);
      // Try to refresh anyway
      try {
        const pending = await notificationListenerService.getPendingTransactions();
        setPendingTransactions(pending);
      } catch (refreshError) {
        console.error('Error refreshing transactions:', refreshError);
      }
    }
  }, []);

  // Ignore a pending transaction
  const ignoreTransaction = useCallback(async (id: string) => {
    try {
      await notificationListenerService.ignoreTransaction(id);
      // Refresh pending transactions
      const pending = await notificationListenerService.getPendingTransactions();
      setPendingTransactions(pending);
    } catch (error) {
      console.error('Error ignoring transaction:', error);
      // Try to refresh anyway
      try {
        const pending = await notificationListenerService.getPendingTransactions();
        setPendingTransactions(pending);
      } catch (refreshError) {
        console.error('Error refreshing transactions:', refreshError);
      }
    }
  }, []);

  // Initial check on mount
  useEffect(() => {
    if (!isAndroid) return;

    // Check permission on mount with error handling
    (async () => {
      try {
        await checkPermissionStatus();
      } catch (error) {
        console.error('Error in initial permission check:', error);
      }
    })();

    // ✅ CRITICAL FIX: Listen for app state changes with error handling
    const setupListeners = async () => {
      try {
        const appStateListener = await CapApp.addListener('appStateChange', async ({ isActive }) => {
          if (isActive) {
            // App returned to foreground - recheck permission
            console.log('App returned to foreground, rechecking permission...');
            
            // Small delay to ensure Android has updated the permission
            setTimeout(async () => {
              try {
                await checkPermissionStatus();
              } catch (error) {
                console.error('Error rechecking permission on resume:', error);
              }
            }, 500);
          }
        });

        // ✅ CRITICAL FIX: Listen for resume event with error handling
        const resumeListener = await CapApp.addListener('resume', async () => {
          console.log('App resumed, rechecking permission...');
          setTimeout(async () => {
            try {
              await checkPermissionStatus();
            } catch (error) {
              console.error('Error rechecking permission on app resume:', error);
            }
          }, 500);
        });

        // Return cleanup function
        return () => {
          appStateListener.remove();
          resumeListener.remove();
        };
      } catch (error) {
        console.error('Error setting up app listeners:', error);
        return () => {}; // Return empty cleanup
      }
    };

    // Setup listeners and store cleanup
    let cleanup: (() => void) | undefined;
    setupListeners().then(cleanupFn => {
      cleanup = cleanupFn;
    });

    // Cleanup on unmount
    return () => {
      if (cleanup) cleanup();
    };
  }, [isAndroid, checkPermissionStatus]);

  // Poll for new transactions every 10 seconds if enabled
  useEffect(() => {
    if (!isAndroid || !isEnabled) return;

    const interval = setInterval(async () => {
      try {
        const pending = await notificationListenerService.getPendingTransactions();
        setPendingTransactions(pending);
      } catch (error) {
        console.error('Error polling transactions:', error);
        // Don't crash, just log
      }
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
  }, [isAndroid, isEnabled]);

  return {
    pendingTransactions,
    pendingCount: pendingTransactions.length,
    isEnabled,
    requestPermission,
    confirmTransaction,
    ignoreTransaction,
  };
}
