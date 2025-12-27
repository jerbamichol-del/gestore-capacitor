// src/components/NotificationSettingsButton.tsx

import React, { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { NotificationPermissionModal } from './NotificationPermissionModal';

interface NotificationSettingsButtonProps {
  isEnabled: boolean;
  requestPermission: () => Promise<{ enabled: boolean }> | void;
  manualCheckPermission?: () => Promise<void>; // ✅ NEW: Manual check callback
}

export function NotificationSettingsButton({
  isEnabled,
  requestPermission,
  manualCheckPermission,
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

  // ❌❌❌ REMOVED: appStateChange listener that caused white screen crash!
  // The listener was calling requestPermission() immediately when app returned
  // from Settings, which triggered isEnabled() before Android Settings were ready.
  // This caused the white screen crash.
  //
  // NEW APPROACH: User must manually close the modal or trigger a refresh.
  // The modal will stay open after returning from Settings, with a new
  // "Refresh" button that the user can tap to check if permission was granted.

  const handleEnableClick = async () => {
    try {
      await requestPermission();
      // ✅ Modal stays open - user will close it manually after enabling
      // or use the "Refresh" button to check status
    } catch (e) {
      console.error('❌ Error requesting permission:', e);
      setIsModalOpen(false);
    }
  };

  const handleRefreshPermission = async () => {
    // ✅ NEW: Manual refresh triggered by user clicking button in modal
    console.log('🔄 User manually refreshing permission status...');
    try {
      if (manualCheckPermission) {
        await manualCheckPermission();
      }
      // If permission is now enabled, the button will disappear and modal will close
      // because isEnabled will become true
      setIsModalOpen(false);
    } catch (e) {
      console.error('❌ Error refreshing permission:', e);
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

      <NotificationPermissionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onEnableClick={handleEnableClick}
        onRefreshClick={handleRefreshPermission} // ✅ NEW: Pass refresh handler
      />
    </>
  );
}
