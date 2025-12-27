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
  const hasCheckedOnceRef = useRef(false);

  // Check if running on Android
  const isAndroid = Capacitor.getPlatform() === 'android';

  // Function to check permission status with retry logic
  const checkPermissionStatus = useCallback(async (retryCount = 0): Promise<void> => {
    if (!isAndroid) return;
    if (isCheckingRef.current) {
      console.log('⏭️ Permission check already in progress, skipping');
      return;
    }
    
    isCheckingRef.current = true;
    console.log(`🔍 Checking permission status (attempt ${retryCount + 1})...`);
    
    try {
      const enabled = await notificationListenerService.isEnabled();
      console.log(`✅ Permission check result: ${enabled}`);
      setIsEnabled(enabled);
      
      // If enabled, load pending transactions
      if (enabled) {
        try {
          const pending = await notificationListenerService.getPendingTransactions();
          setPendingTransactions(pending);
        } catch (transError) {
          console.error('❌ Error loading pending transactions:', transError);
          setPendingTransactions([]);
        }
      }
    } catch (error) {
      console.error(`❌ Error checking notification permission (attempt ${retryCount + 1}):`, error);
      
      // ✅ Retry up to 2 times with delays
      if (retryCount < 2) {
        const nextDelay = (retryCount + 1) * 1000; // 1s, 2s
        console.log(`🔄 Retrying permission check in ${nextDelay}ms...`);
        setTimeout(() => {
          isCheckingRef.current = false;
          checkPermissionStatus(retryCount + 1);
        }, nextDelay);
        return;
      }
      
      // After 2 retries, give up gracefully
      console.warn('⚠️ Failed to check permission after retries, setting safe defaults');
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
      console.error('❌ Error requesting permission:', error);
      return { enabled: false };
    }
  }, [isAndroid]);

  // Confirm a pending transaction
  const confirmTransaction = useCallback(async (id: string) => {
    try {
      await notificationListenerService.confirmTransaction(id);
      const pending = await notificationListenerService.getPendingTransactions();
      setPendingTransactions(pending);
    } catch (error) {
      console.error('❌ Error confirming transaction:', error);
      try {
        const pending = await notificationListenerService.getPendingTransactions();
        setPendingTransactions(pending);
      } catch (refreshError) {
        console.error('❌ Error refreshing transactions:', refreshError);
      }
    }
  }, []);

  // Ignore a pending transaction
  const ignoreTransaction = useCallback(async (id: string) => {
    try {
      await notificationListenerService.ignoreTransaction(id);
      const pending = await notificationListenerService.getPendingTransactions();
      setPendingTransactions(pending);
    } catch (error) {
      console.error('❌ Error ignoring transaction:', error);
      try {
        const pending = await notificationListenerService.getPendingTransactions();
        setPendingTransactions(pending);
      } catch (refreshError) {
        console.error('❌ Error refreshing transactions:', refreshError);
      }
    }
  }, []);

  // ✅✅✅ MANUAL check permission - called only by user action
  const manualCheckPermission = useCallback(async () => {
    console.log('🔄 Manual permission check triggered by user');
    await checkPermissionStatus();
  }, [checkPermissionStatus]);

  // Initial check on mount ONLY ONCE
  useEffect(() => {
    if (!isAndroid) return;
    if (hasCheckedOnceRef.current) return; // ✅ CRITICAL: Check only ONCE

    console.log('🚀 useNotificationListener mounted - initial check');
    hasCheckedOnceRef.current = true;

    // Check permission on mount with error handling
    (async () => {
      try {
        await checkPermissionStatus();
      } catch (error) {
        console.error('❌ Error in initial permission check:', error);
      }
    })();

    // ❌❌❌ REMOVED: NO automatic check on resume!
    // The resume listener is completely REMOVED to prevent white screen crash.
    // The app will only check permission when:
    // 1. Component mounts (once)
    // 2. User manually triggers check (e.g., closing modal)
    // 3. User performs an action that requires permission check

    console.log('✅ No resume listener registered (prevents crash)');
    
    // No cleanup needed since no listeners
    return () => {
      console.log('🧹 useNotificationListener unmounting');
    };
  }, [isAndroid, checkPermissionStatus]);

  // Poll for new transactions every 30 seconds if enabled
  // ✅ Increased to 30 seconds to reduce checks
  useEffect(() => {
    if (!isAndroid || !isEnabled) return;

    console.log('🔍 Starting transaction polling (30s interval)');

    const interval = setInterval(async () => {
      try {
        const pending = await notificationListenerService.getPendingTransactions();
        setPendingTransactions(pending);
      } catch (error) {
        console.error('❌ Error polling transactions:', error);
      }
    }, 30000); // 30 seconds

    return () => {
      console.log('🛑 Stopping transaction polling');
      clearInterval(interval);
    };
  }, [isAndroid, isEnabled]);

  return {
    pendingTransactions,
    pendingCount: pendingTransactions.length,
    isEnabled,
    requestPermission,
    confirmTransaction,
    ignoreTransaction,
    manualCheckPermission, // ✅ NEW: Expose manual check for user-triggered updates
  };
}
