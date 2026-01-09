import React from 'react';
import { PhotoIcon } from './icons/PhotoIcon';
import { ArrowDownOnSquareIcon } from './icons/ArrowDownOnSquareIcon';
import { LockClosedIcon } from './icons/LockClosedIcon';
import { QrCodeIcon } from './icons/QrCodeIcon';
import { NotificationSettingsButton } from './NotificationSettingsButton';
import { useTheme } from '../context/ThemeContext';
import { SunIcon, MoonIcon } from 'lucide-react';

interface HeaderProps {
  pendingSyncs: number;
  isOnline: boolean;
  onInstallClick: () => void;
  installPromptEvent: any;
  onLogout: () => void;
  onShowQr: () => void;
  isNotificationListenerEnabled?: boolean;
  requestNotificationPermission?: () => void;
}

const Header: React.FC<HeaderProps> = ({
  pendingSyncs,
  isOnline,
  onInstallClick,
  installPromptEvent,
  onLogout,
  onShowQr,
  isNotificationListenerEnabled = false,
  requestNotificationPermission = () => { }
}) => {
  const { isDarkMode, toggleTheme } = useTheme();

  return (
    <header className="bg-white dark:bg-slate-900 shadow-md sticky top-0 z-20 transition-colors">
      <div className="mx-auto">
        <div className="py-2 flex items-center justify-between gap-3 px-4 md:px-8 h-[58px]">
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Gestore Spese</h1>
          <div className="flex items-center gap-2 sm:gap-4">
            {!isOnline && (
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 px-3 py-1.5 rounded-full">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
                <span className="hidden sm:inline">Offline</span>
              </div>
            )}
            {pendingSyncs > 0 && isOnline && (
              <div className="flex items-center gap-2 text-sm font-semibold text-indigo-600 bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 px-3 py-1.5 rounded-full">
                <PhotoIcon className="w-5 h-5" />
                <span>{pendingSyncs}</span>
                <span className="hidden sm:inline md:inline">in sync</span>
              </div>
            )}

            {installPromptEvent && (
              <button
                onClick={onInstallClick}
                className="flex items-center gap-2 text-sm font-semibold text-indigo-600 bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 px-3 py-1.5 rounded-full hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors"
                aria-label="Installa App"
                title="Installa App"
              >
                <ArrowDownOnSquareIcon className="w-5 h-5" />
                <span className="hidden sm:inline">Installa</span>
              </button>
            )}

            <NotificationSettingsButton
              isEnabled={isNotificationListenerEnabled}
              requestPermission={requestNotificationPermission}
            />

            <button
              onClick={toggleTheme}
              className="p-2 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-amber-400 hover:bg-indigo-100 dark:hover:bg-slate-800 rounded-full transition-colors"
              aria-label="Cambia Tema"
              title={isDarkMode ? "Attiva Tema Chiaro" : "Attiva Tema Scuro"}
            >
              {isDarkMode ? <SunIcon className="w-6 h-6" /> : <MoonIcon className="w-6 h-6" />}
            </button>

            <button
              onClick={onShowQr}
              className="p-2 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-slate-800 rounded-full transition-colors"
              aria-label="Mostra QR Code"
              title="Condividi via QR"
            >
              <QrCodeIcon className="w-6 h-6" />
            </button>

            <button
              onClick={onLogout}
              className="p-2 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-rose-400 hover:bg-indigo-100 dark:hover:bg-slate-800 rounded-full transition-colors"
              aria-label="Logout"
              title="Logout"
            >
              <LockClosedIcon className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;