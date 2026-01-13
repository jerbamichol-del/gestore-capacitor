// src/hooks/useSMSListener.ts

import { useState, useEffect, useCallback, useRef } from 'react';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import smsListenerService from '../services/sms-listener-service';
import type { PendingSMSTransaction } from '../services/sms-listener-service';

export function useSMSListener() {
  const [pendingTransactions, setPendingTransactions] = useState<PendingSMSTransaction[]>([]);
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
      console.log('⏭️ SMS permission check already in progress, skipping');
      return;
    }

    isCheckingRef.current = true;
    console.log(`🔍 Checking SMS permission status (attempt ${retryCount + 1})...`);

    try {
      const enabled = await smsListenerService.isEnabled();
      console.log(`✅ SMS permission check result: ${enabled}`);
      setIsEnabled(enabled);

      // Initialize service if enabled
      if (enabled) {
        try {
          console.log('🚀 Initializing SMS listener service...');
          await smsListenerService.initialize();
          console.log('✅ SMS listener service initialized');

          // Load pending transactions
          const pending = await smsListenerService.getPendingTransactions();
          setPendingTransactions(pending);
        } catch (initError) {
          console.error('❌ Error initializing SMS service:', initError);
          setPendingTransactions([]);
        }
      }
    } catch (error) {
      console.error(`❌ Error checking SMS permission (attempt ${retryCount + 1}):`, error);

      // Retry up to 2 times with delays
      if (retryCount < 2) {
        const nextDelay = (retryCount + 1) * 1000; // 1s, 2s
        console.log(`🔄 Retrying SMS permission check in ${nextDelay}ms...`);
        setTimeout(() => {
          isCheckingRef.current = false;
          checkPermissionStatus(retryCount + 1);
        }, nextDelay);
        return;
      }

      // After 2 retries, give up gracefully
      console.warn('⚠️ Failed to check SMS permission after retries, setting safe defaults');
      setIsEnabled(false);
      setPendingTransactions([]);
    } finally {
      isCheckingRef.current = false;
    }
  }, [isAndroid]);

  // Request SMS permission
  const requestPermission = useCallback(async () => {
    if (!isAndroid) {
      return { enabled: false };
    }

    try {
      const result = await smsListenerService.requestPermission();
      // Permission request opens Android settings - don't update state here
      // State will be updated when app returns to foreground
      return result;
    } catch (error) {
      console.error('❌ Error requesting SMS permission:', error);
      return { enabled: false };
    }
  }, [isAndroid]);

  // Confirm a pending transaction
  const confirmTransaction = useCallback(async (id: string) => {
    try {
      await smsListenerService.confirmTransaction(id);
      const pending = await smsListenerService.getPendingTransactions();
      setPendingTransactions(pending);
    } catch (error) {
      console.error('❌ Error confirming SMS transaction:', error);
      try {
        const pending = await smsListenerService.getPendingTransactions();
        setPendingTransactions(pending);
      } catch (refreshError) {
        console.error('❌ Error refreshing SMS transactions:', refreshError);
      }
    }
  }, []);

  // Ignore a pending transaction
  const ignoreTransaction = useCallback(async (id: string) => {
    try {
      await smsListenerService.ignoreTransaction(id);
      const pending = await smsListenerService.getPendingTransactions();
      setPendingTransactions(pending);
    } catch (error) {
      console.error('❌ Error ignoring SMS transaction:', error);
      try {
        const pending = await smsListenerService.getPendingTransactions();
        setPendingTransactions(pending);
      } catch (refreshError) {
        console.error('❌ Error refreshing SMS transactions:', refreshError);
      }
    }
  }, []);

  // Manual check permission - called only by user action
  const manualCheckPermission = useCallback(async () => {
    console.log('🔄 Manual SMS permission check triggered by user');
    await checkPermissionStatus();
  }, [checkPermissionStatus]);

  // Initial check on mount ONLY ONCE + SAFE resume listener
  useEffect(() => {
    if (!isAndroid) return;
    if (hasCheckedOnceRef.current) return; // Check only ONCE

    console.log('🚀 useSMSListener mounted - initial check');
    hasCheckedOnceRef.current = true;

    // Check permission on mount with error handling
    (async () => {
      try {
        await checkPermissionStatus();
      } catch (error) {
        console.error('❌ Error in initial SMS permission check:', error);
      }
    })();

    // SAFE resume listener with 3000ms delay
    const resumeListener = CapApp.addListener('resume', () => {
      console.log('📱 App resumed - scheduling SAFE SMS permission check in 3000ms...');

      // Clear any existing timeout
      if (resumeTimeoutRef.current) {
        clearTimeout(resumeTimeoutRef.current);
      }

      // Schedule check with 3 second delay (SAFE)
      resumeTimeoutRef.current = setTimeout(async () => {
        console.log('⏰ 3 seconds elapsed - checking SMS permission now (SAFE)');
        try {
          await checkPermissionStatus();
        } catch (error) {
          console.error('❌ Error in resume SMS permission check:', error);
          // Swallow error - don't crash
        }
      }, 1000); // 1 SECOND - enough time for Android to update
    });

    console.log('✅ SAFE SMS resume listener registered (1s delay)');

    // Cleanup
    return () => {
      console.log('🧹 useSMSListener unmounting');
      resumeListener.then(listener => listener.remove());
      if (resumeTimeoutRef.current) {
        clearTimeout(resumeTimeoutRef.current);
      }
      // Cleanup service on unmount
      smsListenerService.destroy();
    };
  }, [isAndroid, checkPermissionStatus]);

  // ✅ NEW: Listen for global updates (e.g. from AutoService)
  useEffect(() => {
    const handleUpdate = async () => {
      console.log('🔄 Received SMS auto-transactions-updated event - refreshing list');
      try {
        const pending = await smsListenerService.getPendingTransactions();
        setPendingTransactions(pending);
      } catch (e) { console.error(e); }
    };

    window.addEventListener('auto-transactions-updated', handleUpdate);
    return () => window.removeEventListener('auto-transactions-updated', handleUpdate);
  }, []);


  return {
    pendingTransactions,
    pendingCount: pendingTransactions.length,
    // Return false when null to prevent showing button during initial check
    isEnabled: isEnabled === null ? false : isEnabled,
    requestPermission,
    confirmTransaction,
    ignoreTransaction,
    manualCheckPermission,
  };
}
