import React from 'react';
import { PhotoIcon } from './icons/PhotoIcon';
import { ArrowDownOnSquareIcon } from './icons/ArrowDownOnSquareIcon';
import { Cog6ToothIcon } from './icons/Cog6ToothIcon';
import { NotificationSettingsButton } from './NotificationSettingsButton';
import { useTheme } from '../hooks/useTheme';
import { LockClosedIcon } from './icons/LockClosedIcon';

const ThemeToggle = () => {
  const { toggleTheme, isDark } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="p-2 text-slate-500 hover:text-sunset-coral hover:bg-sunset-peach/50 rounded-full transition-colors dark:text-slate-400 dark:hover:text-electric-violet dark:hover:bg-midnight-card"
      aria-label="Cambia Tema"
      title={isDark ? 'Passa a Chiaro' : 'Passa a Scuro'}
    >
      {isDark ? (
        // Sun Icon
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
        </svg>
      ) : (
        // Moon Icon
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
        </svg>
      )}
    </button>
  );
};

interface HeaderProps {
  pendingSyncs: number;
  isOnline: boolean;
  onInstallClick: () => void;
  installPromptEvent: any;
  onOpenSettings: () => void;
  onLogout?: () => void;
  isNotificationListenerEnabled?: boolean;
  requestNotificationPermission?: () => void;
}

const Header: React.FC<HeaderProps> = ({
  pendingSyncs,
  isOnline,
  onInstallClick,
  installPromptEvent,
  onOpenSettings,
  onLogout,
  isNotificationListenerEnabled = false,
  requestNotificationPermission = () => { }
}) => {
  return (
    <header className="bg-[var(--accent-bg,var(--sunset-cream,#F2F4F2))] dark:bg-[var(--accent-bg,#0F172A)] shadow-md sticky top-0 z-20 transition-colors duration-300">
      <div className="mx-auto">
        <div className="py-2 flex items-center justify-between gap-3 px-4 md:px-8 h-[58px]">
          {/* Left: Settings + Title */}
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenSettings}
              className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-100 rounded-full transition-colors dark:text-slate-400 dark:hover:text-electric-violet dark:hover:bg-midnight-card"
              aria-label="Impostazioni"
              title="Impostazioni"
            >
              <Cog6ToothIcon className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-bold text-slate-800 dark:text-white transition-colors">Gestore Spese</h1>
          </div>

          {/* Right: Status indicators and controls */}
          <div className="flex items-center gap-2 sm:gap-4">
            {!isOnline && (
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-600 bg-amber-100 px-3 py-1.5 rounded-full">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
                <span className="hidden sm:inline">Offline</span>
              </div>
            )}
            {pendingSyncs > 0 && isOnline && (
              <div className="flex items-center gap-2 text-sm font-semibold text-sunset-coral dark:text-electric-violet bg-sunset-peach/50 dark:bg-electric-violet/20 px-3 py-1.5 rounded-full">
                <PhotoIcon className="w-5 h-5" />
                <span>{pendingSyncs}</span>
                <span className="hidden sm:inline md:inline">in sync</span>
              </div>
            )}

            {installPromptEvent && (
              <button
                onClick={onInstallClick}
                className="flex items-center gap-2 text-sm font-semibold text-sunset-coral dark:text-electric-violet bg-sunset-peach/50 dark:bg-electric-violet/20 px-3 py-1.5 rounded-full hover:bg-sunset-peach dark:hover:bg-electric-violet/30 transition-colors"
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

            <ThemeToggle />

            {onLogout && (
              <button
                onClick={onLogout}
                className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-100 rounded-full transition-colors dark:text-slate-400 dark:hover:text-electric-violet dark:hover:bg-midnight-card"
                aria-label="Logout"
                title="Logout"
              >
                <LockClosedIcon className="w-6 h-6" />
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
