// src/hooks/useNotificationListener.ts

import { useState, useEffect, useCallback, useRef } from 'react';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import notificationListenerService from '../services/notification-listener-service';
import type { PendingTransaction } from '../services/notification-listener-service';

export function useNotificationListener() {
  const [pendingTransactions, setPendingTransactions] = useState<PendingTransaction[]>([]);
  // ✅✅✅ CRITICAL FIX: Start with null to prevent flash
  // null = not checked yet, true = enabled, false = disabled
  const [isEnabled, setIsEnabled] = useState<boolean | null>(null);
  const isCheckingRef = useRef(false);
  const hasCheckedOnceRef = useRef(false);
  const resumeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

      // ✅✅✅ CRITICAL FIX: Initialize service if enabled
      // This registers the 'notificationReceived' event listener!
      if (enabled) {
        try {
          console.log('🚀 Initializing notification listener service...');
          await notificationListenerService.initialize();
          console.log('✅ Notification listener service initialized');

          // Load pending transactions
          const pending = await notificationListenerService.getPendingTransactions();
          setPendingTransactions(pending);
        } catch (initError) {
          console.error('❌ Error initializing service:', initError);
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
      throw error; // RETHROW so UI knows it failed
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

  // Initial check on mount ONLY ONCE + SAFE resume listener
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

    // ✅✅✅ SAFE resume listener with 3000ms delay
    // This gives Android enough time to update Settings.Secure after user returns
    const resumeListener = CapApp.addListener('resume', () => {
      console.log('📱 App resumed - scheduling SAFE permission check in 3000ms...');

      // Clear any existing timeout
      if (resumeTimeoutRef.current) {
        clearTimeout(resumeTimeoutRef.current);
      }

      // Schedule check with 3 second delay (SAFE)
      resumeTimeoutRef.current = setTimeout(async () => {
        console.log('⏰ 3 seconds elapsed - checking permission now (SAFE)');
        try {
          await checkPermissionStatus();
        } catch (error) {
          console.error('❌ Error in resume permission check:', error);
          // Swallow error - don't crash
        }
      }, 3000); // ✅ 3 SECONDS - enough time for Android to update Settings.Secure
    });

    console.log('✅ SAFE resume listener registered (3s delay)');

    // Cleanup
    return () => {
      console.log('🧹 useNotificationListener unmounting');
      resumeListener.then(listener => listener.remove());
      if (resumeTimeoutRef.current) {
        clearTimeout(resumeTimeoutRef.current);
      }
      // ✅ Cleanup service on unmount
      notificationListenerService.destroy();
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
    // ✅✅✅ CRITICAL: Return false when null to prevent showing button during initial check
    isEnabled: isEnabled === null ? false : isEnabled,
    requestPermission,
    confirmTransaction,
    ignoreTransaction,
    manualCheckPermission, // ✅ Still exposed for manual refresh if needed
  };
}
