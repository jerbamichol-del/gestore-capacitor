// src/components/NotificationSettingsButton.tsx

import React, { useState } from 'react';
import { Capacitor } from '@capacitor/core';
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

  // Only show on Android
  if (Capacitor.getPlatform() !== 'android') {
    return null;
  }

  // ✅ FIX: Hide button completely when permission is granted
  if (isEnabled) {
    return null;
  }

  const handleEnableClick = async () => {
    try {
      await requestPermission();
      // ✅✅✅ Modal will show SUCCESS state when isEnabled becomes true (after 3s)
      // User will see green checkmark and success message
      // Then can close modal with "Chiudi" button
    } catch (e) {
      console.error('❌ Error requesting permission:', e);
      setIsModalOpen(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="relative p-2 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors animate-pulse"
        aria-label="Abilita rilevamento notifiche"
        title="Abilita rilevamento notifiche bancarie"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full" />
      </button>

      {/* ✅✅✅ PASS isEnabled to modal so it can show success state */}
      <NotificationPermissionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onEnableClick={handleEnableClick}
        isEnabled={isEnabled}
      />
    </>
  );
}
