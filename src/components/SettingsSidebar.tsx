import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon } from './icons/XMarkIcon';
import { ChevronRightIcon } from './icons/ChevronRightIcon';
import { QrCodeIcon } from './icons/QrCodeIcon';
import { ArrowsUpDownIcon } from './icons/ArrowsUpDownIcon';
import { LockClosedIcon } from './icons/LockClosedIcon';
import { useTheme } from '../hooks/useTheme';

// Icons for menu items
const PaletteIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.098 19.902a3.75 3.75 0 0 0 5.304 0l6.401-6.402M6.75 21A3.75 3.75 0 0 1 3 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 0 0 3.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008Z" />
    </svg>
);

const ChartBarIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
    </svg>
);

const ShieldCheckIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
    </svg>
);

const ArrowRightOnRectangleIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
    </svg>
);

interface SettingsSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    email: string;
    onShowQr: () => void;
    onOpenImportExport: () => void;
    onOpenCardManager: () => void;
    onOpenThemePicker: () => void;
    onOpenSecurity: () => void;
    onOpenBudgetSettings: () => void;
    onOpenEventBudgets: () => void;
    onOpenCategories: () => void; // ✅ New prop
    onOpenBankSync: () => void;
    onLogout: () => void;
    isSwiping?: boolean;
    openProgress?: number; // 0 to ~300 (pixels dragged)
}

interface MenuItemProps {
    icon: React.ReactNode;
    label: string;
    description?: string;
    onClick: () => void;
    variant?: 'default' | 'danger';
}

const MenuItem: React.FC<MenuItemProps> = ({ icon, label, description, onClick, variant = 'default' }) => {
    const colorClasses = variant === 'danger'
        ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20'
        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50';

    return (
        <button
            onClick={onClick}
            className={`w-full flex items-center gap-4 p-4 rounded-xl transition-all ${colorClasses}`}
        >
            <div className={`w-10 h-10 flex items-center justify-center rounded-xl ${variant === 'danger' ? 'bg-red-100 dark:bg-red-900/30' : 'bg-slate-100 dark:bg-slate-800'}`}>
                {icon}
            </div>
            <div className="flex-1 text-left">
                <p className="font-semibold">{label}</p>
                {description && <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>}
            </div>
            <ChevronRightIcon className="w-5 h-5 text-slate-400" />
        </button>
    );
};

const SettingsSidebar: React.FC<SettingsSidebarProps> = ({
    isOpen,
    onClose,
    email,
    onShowQr,
    onOpenImportExport,
    onOpenCardManager,
    onOpenThemePicker,
    onOpenSecurity,
    onOpenBudgetSettings,
    onOpenEventBudgets,
    onOpenCategories, // ✅ Destructure new prop
    onOpenBankSync,
    onLogout,
    isSwiping: isExternalSwiping = false,
    openProgress: externalOpenProgress = 0,
}) => {
    const { isDark } = useTheme();
    const sidebarRef = useRef<HTMLDivElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);

    // Internal state for closing animation
    const [isVisible, setIsVisible] = useState(false);

    // Local swipe state (for closing gesture)
    const [localSwipeX, setLocalSwipeX] = useState(0);
    const [isLocalSwiping, setIsLocalSwiping] = useState(false);

    // Combined state interpretation
    // We are "active" if props.isOpen is true OR if we have valid local content to show (closing animation)
    // or if an external swipe is pushing us into view.

    useEffect(() => {
        if (isOpen || isExternalSwiping) {
            setIsVisible(true);
        } else {
            // Delay unmounting to allow close animation
            const timer = setTimeout(() => {
                if (!isOpen && !isExternalSwiping) setIsVisible(false);
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [isOpen, isExternalSwiping]);

    // Handle internal closing swipe
    useEffect(() => {
        if (!isOpen) return;
        const sidebar = sidebarRef.current;
        if (!sidebar) return;

        let startX = 0;
        let startY = 0;
        let currentX = 0;
        let directionLock: 'horizontal' | 'vertical' | null = null;

        const handleTouchStart = (e: TouchEvent) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            currentX = e.touches[0].clientX;
            directionLock = null; // Reset lock
            setLocalSwipeX(0);
        };

        const handleTouchMove = (e: TouchEvent) => {
            currentX = e.touches[0].clientX;
            const currentY = e.touches[0].clientY;

            const diffX = startX - currentX;
            const absDiffX = Math.abs(diffX);
            const absDiffY = Math.abs(startY - currentY);

            // Determine direction if not yet locked
            if (!directionLock) {
                if (absDiffX > 5 || absDiffY > 5) {
                    if (absDiffY > absDiffX) {
                        directionLock = 'vertical';
                    } else {
                        directionLock = 'horizontal';
                        setIsLocalSwiping(true);
                    }
                }
            }

            // Perform action based on lock
            if (directionLock === 'vertical') {
                // Allow native vertical scroll, do not update swipe
                return;
            }

            if (directionLock === 'horizontal') {
                // Prevent vertical scroll if needed (though sidebar has overflow-y-auto, 
                // preventing default might block scroll but here we want to block scroll so swipe works cleanly)
                if (e.cancelable) e.preventDefault();

                // Only allow dragging left (closing)
                if (diffX > 0) { // Dragging left means currentX < startX
                    setLocalSwipeX(-diffX);
                }
            }
        };

        const handleTouchEnd = () => {
            setIsLocalSwiping(false);
            if (directionLock === 'horizontal') {
                const rawDiff = currentX - startX;
                // If dragged left significantly (rawDiff is negative)
                if (rawDiff < -80) {
                    onClose();
                } else {
                    setLocalSwipeX(0); // Snap back
                }
            } else {
                setLocalSwipeX(0);
            }
            directionLock = null;
        };

        sidebar.addEventListener('touchstart', handleTouchStart, { passive: true });
        // Active listener to allow preventDefault
        sidebar.addEventListener('touchmove', handleTouchMove, { passive: false });
        sidebar.addEventListener('touchend', handleTouchEnd, { passive: true });

        return () => {
            sidebar.removeEventListener('touchstart', handleTouchStart);
            sidebar.removeEventListener('touchmove', handleTouchMove);
            sidebar.removeEventListener('touchend', handleTouchEnd);
        };
    }, [isOpen, onClose]);

    // --- CALCULATION OF TRANSFORM AND OPACITY ---
    const SIDEBAR_WIDTH = 320; // Must match CSS max-w
    let translateX = -100; // Default closed (percentage)
    let opacity = 0;
    let transition = 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.3s ease';

    if (isOpen) {
        if (isLocalSwiping) {
            // Dragging to close
            // localSwipeX is negative pixels (e.g. -50).
            const px = Math.max(localSwipeX, -SIDEBAR_WIDTH);
            const pct = (px / SIDEBAR_WIDTH) * 100; // e.g. -50 / 320 * 100 = -15%
            translateX = pct;
            opacity = 1 + (pct / 100);
            transition = 'none';
        } else {
            // Fully open
            translateX = 0;
            opacity = 1;
            // Uses default transition
        }
    } else {
        if (isExternalSwiping) {
            // Dragging to open
            let px = externalOpenProgress;
            // Handle normalized progress (0-1) from useSwipe
            if (px <= 1 && px >= 0) {
                px = px * (typeof window !== 'undefined' ? window.innerWidth : 360);
            }

            const clampedPx = Math.min(px, SIDEBAR_WIDTH);
            const pct = (clampedPx / SIDEBAR_WIDTH) * 100; // 0 to 100%

            translateX = -100 + pct; // -100% to 0%
            opacity = pct / 100;
            transition = 'none';
        } else {
            // Fully closed
            translateX = -100;
            opacity = 0;
            // Uses default transition
        }
    }

    // Force render if external swipe is active, bypassing the effect delay
    const shouldRender = isOpen || isVisible || isExternalSwiping;

    if (!shouldRender) return null;

    const handleInstantClose = (action: () => void) => {
        onClose(); // Trigger close animation
        setTimeout(action, 300); // Execute action after animation
    };

    return createPortal(
        <div className="fixed inset-0 z-[8000] pointer-events-none">
            {/* Backdrop - pointer-events-auto ensures clicks on backdrop close it */}
            <div
                ref={overlayRef}
                className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto"
                style={{
                    opacity: opacity,
                    transition: transition.includes('none') ? 'none' : 'opacity 0.3s ease',
                    pointerEvents: opacity > 0 ? 'auto' : 'none'
                }}
                onClick={() => { if (isOpen) onClose(); }}
            />

            {/* Sidebar */}
            <div
                ref={sidebarRef}
                className="absolute left-0 top-0 bottom-0 w-[85%] max-w-[320px] bg-white dark:bg-midnight backdrop-blur-xl shadow-2xl flex flex-col pointer-events-auto"
                style={{
                    paddingTop: 'env(safe-area-inset-top, 0px)',
                    transform: `translateX(${translateX}%)`,
                    transition: transition
                }}
            >
                {/* Header */}
                <div className="p-6 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white">Impostazioni</h2>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                            <XMarkIcon className="w-6 h-6 text-slate-500" />
                        </button>
                    </div>
                    {/* User Info */}
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 dark:from-electric-violet dark:to-electric-pink flex items-center justify-center text-white font-bold text-lg shadow-lg">
                            {email.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-slate-800 dark:text-white truncate">{email}</p>
                            <p className="text-xs text-green-600 dark:text-green-400 font-medium">● Online</p>
                        </div>
                    </div>
                </div>

                {/* Menu Items */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {/* Dashboard Section */}
                    <div className="mb-4">
                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 px-4">Dashboard</p>
                        <MenuItem
                            icon={<ChartBarIcon className="w-5 h-5" />}
                            label="Statistiche"
                            description="Report statistiche"
                            onClick={() => handleInstantClose(onOpenCardManager)}
                        />
                    </div>

                    {/* Finance Section */}
                    <div className="mb-4">
                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 px-4">Finanze</p>
                        <MenuItem
                            icon={
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                                </svg>
                            }
                            label="Budget Mensili"
                            description="Imposta limiti per categoria"
                            onClick={() => handleInstantClose(onOpenBudgetSettings)}
                        />
                        <MenuItem
                            icon={
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
                                </svg>
                            }
                            label="Categorie"
                            description="Gestisci categorie personalizzate"
                            onClick={() => handleInstantClose(onOpenCategories)}
                        />
                        <MenuItem
                            icon={
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                                </svg>
                            }
                            label="Pianificazione Eventi"
                            description="Viaggi, progetti e budget extra"
                            onClick={() => handleInstantClose(onOpenEventBudgets)}
                        />
                        <MenuItem
                            icon={
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                                </svg>
                            }
                            label="Sincronizzazione Banca"
                            description="Connetti conti correnti"
                            onClick={() => handleInstantClose(onOpenBankSync)}
                        />
                    </div>

                    {/* Appearance Section */}
                    <div className="mb-4">
                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 px-4">Aspetto</p>
                        <MenuItem
                            icon={<PaletteIcon className="w-5 h-5" />}
                            label="Tema"
                            description={isDark ? 'Midnight Electric' : 'Mint Garden'}
                            onClick={() => handleInstantClose(onOpenThemePicker)}
                        />
                    </div>

                    {/* Security Section */}
                    <div className="mb-4">
                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 px-4">Sicurezza</p>
                        <MenuItem
                            icon={<ShieldCheckIcon className="w-5 h-5" />}
                            label="PIN & Mail"
                            description="Cambia PIN o Email"
                            onClick={() => handleInstantClose(onOpenSecurity)}
                        />
                    </div>

                    {/* Data Section */}
                    <div className="mb-4">
                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 px-4">Dati</p>
                        <MenuItem
                            icon={<ArrowsUpDownIcon className="w-5 h-5" />}
                            label="Importa / Esporta"
                            description="Backup, sync, banche"
                            onClick={() => handleInstantClose(onOpenImportExport)}
                        />
                    </div>

                    {/* Share Section */}
                    <div className="mb-4">
                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 px-4">Condivisione</p>
                        <MenuItem
                            icon={<QrCodeIcon className="w-5 h-5" />}
                            label="Mostra QR"
                            description="Condividi l'app con altri"
                            onClick={() => handleInstantClose(onShowQr)}
                        />
                    </div>
                </div>

                {/* Footer - Logout */}
                <div className="p-4 border-t border-slate-200 dark:border-slate-800">
                    <MenuItem
                        icon={<ArrowRightOnRectangleIcon className="w-5 h-5" />}
                        label="Esci"
                        onClick={() => handleInstantClose(onLogout)}
                        variant="danger"
                    />
                </div>
            </div>
        </div>,
        document.body
    );
};

export default SettingsSidebar;
