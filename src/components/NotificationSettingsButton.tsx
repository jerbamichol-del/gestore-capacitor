// src/components/NotificationSettingsButton.tsx

import React, { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { NotificationPermissionModal } from './NotificationPermissionModal';

interface NotificationSettingsButtonProps {
  isEnabled: boolean;
  requestPermission: () => Promise<{ enabled: boolean }> | void;
}

export function NotificationSettingsButton({
  isEnabled,
  requestPermission,
}: NotificationSettingsButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [localIsEnabled, setLocalIsEnabled] = useState(isEnabled);

  // Only show on Android
  if (Capacitor.getPlatform() !== 'android') {
    return null;
  }

  // Update local state when prop changes
  useEffect(() => {
    setLocalIsEnabled(isEnabled);
  }, [isEnabled]);

  // Listen for app state changes to recheck permission
  useEffect(() => {
    const listener = App.addListener('appStateChange', async ({ isActive }) => {
      if (isActive && isModalOpen) {
        // App came back to foreground while modal was open
        // Recheck permission status
        try {
          const result = await requestPermission();
          if (result && typeof result === 'object' && 'enabled' in result) {
            setLocalIsEnabled(result.enabled);
            if (result.enabled) {
              // Permission granted! Close modal
              setIsModalOpen(false);
            }
          }
        } catch (e) {
          console.error('Error rechecking permission:', e);
        }
      }
    });

    return () => {
      listener.then(l => l.remove());
    };
  }, [isModalOpen, requestPermission]);

  const handleEnableClick = async () => {
    try {
      const result = await requestPermission();
      // Don't close modal immediately - let the App listener handle it
      // This way the modal stays open until user actually grants permission
    } catch (e) {
      console.error('Error requesting permission:', e);
      setIsModalOpen(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="relative p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-100 rounded-full transition-colors"
        aria-label="Impostazioni rilevamento transazioni"
        title={localIsEnabled ? 'Rilevamento attivo' : 'Abilita rilevamento notifiche'}
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {!localIsEnabled && (
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full" />
        )}
      </button>

      <NotificationPermissionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onEnableClick={handleEnableClick}
      />
    </>
  );
}
