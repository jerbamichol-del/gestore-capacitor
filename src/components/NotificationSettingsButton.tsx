// src/components/NotificationSettingsButton.tsx

import React, { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { NotificationPermissionModal } from './NotificationPermissionModal';

interface NotificationSettingsButtonProps {
  isEnabled: boolean;
  requestPermission: () => Promise<void> | void;
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

  const handleEnableClick = async () => {
    // Call requestPermission and wait for it to complete
    await requestPermission();
    // Close modal after permission request is done
    setIsModalOpen(false);
  };

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="relative p-2 text-white hover:bg-indigo-700 rounded-full transition-colors"
        aria-label="Impostazioni rilevamento transazioni"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {!isEnabled && (
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
