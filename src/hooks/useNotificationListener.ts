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
  const lastCheckTimeRef = useRef(0);

  // Check if running on Android
  const isAndroid = Capacitor.getPlatform() === 'android';

  // Function to check permission status with retry logic
  const checkPermissionStatus = useCallback(async (retryCount = 0): Promise<void> => {
    if (!isAndroid) return;
    if (isCheckingRef.current) {
      console.log('⏭️ Permission check already in progress, skipping');
      return; // Prevent concurrent checks
    }
    
    // ✅ CRITICAL: Prevent multiple rapid checks (debounce)
    const now = Date.now();
    if (now - lastCheckTimeRef.current < 2000) {
      console.log('⏭️ Permission check too soon after last one, skipping');
      return;
    }
    lastCheckTimeRef.current = now;
    
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
          // Don't crash, just set empty array
          setPendingTransactions([]);
        }
      }
    } catch (error) {
      console.error(`❌ Error checking notification permission (attempt ${retryCount + 1}):`, error);
      
      // ✅ CRITICAL: Retry up to 3 times with LONGER delays
      if (retryCount < 3) {
        const nextDelay = (retryCount + 1) * 1000; // 1s, 2s, 3s
        console.log(`🔄 Retrying permission check in ${nextDelay}ms...`);
        setTimeout(() => {
          isCheckingRef.current = false;
          checkPermissionStatus(retryCount + 1);
        }, nextDelay);
        return;
      }
      
      // After 3 retries, give up gracefully
      console.warn('⚠️ Failed to check permission after 3 retries, setting safe defaults');
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
      // Refresh pending transactions
      const pending = await notificationListenerService.getPendingTransactions();
      setPendingTransactions(pending);
    } catch (error) {
      console.error('❌ Error confirming transaction:', error);
      // Try to refresh anyway
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
      // Refresh pending transactions
      const pending = await notificationListenerService.getPendingTransactions();
      setPendingTransactions(pending);
    } catch (error) {
      console.error('❌ Error ignoring transaction:', error);
      // Try to refresh anyway
      try {
        const pending = await notificationListenerService.getPendingTransactions();
        setPendingTransactions(pending);
      } catch (refreshError) {
        console.error('❌ Error refreshing transactions:', refreshError);
      }
    }
  }, []);

  // Initial check on mount
  useEffect(() => {
    if (!isAndroid) return;

    console.log('🚀 useNotificationListener mounted');

    // Check permission on mount with error handling
    (async () => {
      try {
        await checkPermissionStatus();
      } catch (error) {
        console.error('❌ Error in initial permission check:', error);
      }
    })();

    // ✅✅✅ CRITICAL FIX: Use ONLY 'resume' event (appStateChange is BUGGY on Android!)
    // Based on: https://github.com/ionic-team/capacitor-plugins/issues/479
    const setupListeners = async () => {
      try {
        // ⚠️ REMOVED: appStateChange (buggy on Android)
        // Only listen to 'resume' which fires reliably when returning from Settings
        
        const resumeListener = await CapApp.addListener('resume', async () => {
          console.log('🔄 ===== APP RESUMED (returning from background) =====');
          
          // ✅ CRITICAL: LONGER delay (2000ms = 2 seconds)
          // Why? Android needs time to:
          // 1. Update Settings.Secure database (300-500ms)
          // 2. Restart NotificationListenerService if crashed (500-1000ms)
          // 3. Bind the service to the system (300-500ms)
          // Total: ~1300-2000ms
          setTimeout(async () => {
            console.log('🔍 Starting permission check after 2s delay...');
            try {
              await checkPermissionStatus();
            } catch (error) {
              console.error('❌ Error rechecking permission on resume:', error);
              // Don't crash - app continues working
            }
          }, 2000); // ⚠️⚠️⚠️ CRITICAL: 2000ms (2 seconds)
        });

        console.log('✅ Resume listener registered');

        // Return cleanup function
        return () => {
          console.log('🧹 Cleaning up listeners');
          resumeListener.remove();
        };
      } catch (error) {
        console.error('❌ Error setting up app listeners:', error);
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
      console.log('🚫 useNotificationListener unmounting');
      if (cleanup) cleanup();
    };
  }, [isAndroid, checkPermissionStatus]);

  // Poll for new transactions every 10 seconds if enabled
  useEffect(() => {
    if (!isAndroid || !isEnabled) return;

    console.log('🔍 Starting transaction polling (10s interval)');

    const interval = setInterval(async () => {
      try {
        const pending = await notificationListenerService.getPendingTransactions();
        setPendingTransactions(pending);
      } catch (error) {
        console.error('❌ Error polling transactions:', error);
        // Don't crash, just log
      }
    }, 10000); // 10 seconds

    return () => {
      console.log('🚨 Stopping transaction polling');
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
  };
}
