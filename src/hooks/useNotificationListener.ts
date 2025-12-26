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
        const pending = await notificationListenerService.getPendingTransactions();
        setPendingTransactions(pending);
      }
    } catch (error) {
      console.error('Error checking notification permission:', error);
      // Don't crash the app, just log the error
      setIsEnabled(false);
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
    await notificationListenerService.confirmTransaction(id);
    // Refresh pending transactions
    const pending = await notificationListenerService.getPendingTransactions();
    setPendingTransactions(pending);
  }, []);

  // Ignore a pending transaction
  const ignoreTransaction = useCallback(async (id: string) => {
    await notificationListenerService.ignoreTransaction(id);
    // Refresh pending transactions
    const pending = await notificationListenerService.getPendingTransactions();
    setPendingTransactions(pending);
  }, []);

  // Initial check on mount
  useEffect(() => {
    if (!isAndroid) return;

    // Check permission on mount
    checkPermissionStatus();

    // ✅ CRITICAL FIX: Listen for app state changes
    // When user returns from Android settings, recheck permission
    const appStateListener = CapApp.addListener('appStateChange', async ({ isActive }) => {
      if (isActive) {
        // App returned to foreground - recheck permission
        console.log('App returned to foreground, rechecking permission...');
        
        // Small delay to ensure Android has updated the permission
        setTimeout(() => {
          checkPermissionStatus();
        }, 500);
      }
    });

    // ✅ CRITICAL FIX: Listen for resume event (alternative to appStateChange)
    const resumeListener = CapApp.addListener('resume', async () => {
      console.log('App resumed, rechecking permission...');
      setTimeout(() => {
        checkPermissionStatus();
      }, 500);
    });

    // Cleanup listeners
    return () => {
      appStateListener.then(listener => listener.remove());
      resumeListener.then(listener => listener.remove());
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
