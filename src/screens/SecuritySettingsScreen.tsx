import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon } from '../components/icons/XMarkIcon';
import { ChevronRightIcon } from '../components/icons/ChevronRightIcon';
import ChangePinScreen from './ChangePinScreen';

// Icons
const KeyIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
    </svg>
);

const QuestionMarkCircleIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
    </svg>
);

interface SecuritySettingsScreenProps {
    isOpen: boolean;
    onClose: () => void;
    email: string;
    onForgotPassword: () => void;
}

interface MenuItemProps {
    icon: React.ReactNode;
    label: string;
    description?: string;
    onClick: () => void;
}

const MenuItem: React.FC<MenuItemProps> = ({ icon, label, description, onClick }) => {
    return (
        <button
            onClick={onClick}
            className="w-full flex items-center gap-4 p-4 rounded-xl bg-white dark:bg-midnight-card border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-electric-violet/50 transition-all text-left group"
        >
            <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">
                {icon}
            </div>
            <div className="flex-1">
                <p className="font-bold text-slate-800 dark:text-white">{label}</p>
                {description && <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>}
            </div>
            <ChevronRightIcon className="w-5 h-5 text-slate-400" />
        </button>
    );
};

const SecuritySettingsScreen: React.FC<SecuritySettingsScreenProps> = ({
    isOpen,
    onClose,
    email,
    onForgotPassword,
}) => {
    const [showChangePinScreen, setShowChangePinScreen] = useState(false);

    if (!isOpen) return null;

    // Show ChangePinScreen if active
    if (showChangePinScreen) {
        return (
            <ChangePinScreen
                email={email}
                onSuccess={() => {
                    setShowChangePinScreen(false);
                    onClose();
                }}
                onCancel={() => setShowChangePinScreen(false)}
            />
        );
    }

    const handleForgotPassword = () => {
        onClose();
        setTimeout(onForgotPassword, 150);
    };

    return createPortal(
        <div className="fixed inset-0 z-[8500] flex flex-col bg-sunset-cream dark:bg-midnight transition-colors">
            {/* Header */}
            <div
                className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-midnight"
                style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
            >
                <h2 className="text-xl font-bold text-slate-800 dark:text-white">Sicurezza</h2>
                <button
                    onClick={onClose}
                    className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                    <XMarkIcon className="w-6 h-6 text-slate-500" />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Info Card */}
                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-500/20">
                    <p className="text-sm font-medium text-indigo-800 dark:text-indigo-200">
                        🔐 La tua sicurezza è importante. Cambia regolarmente il PIN e usa una password forte.
                    </p>
                </div>

                {/* Menu Items */}
                <MenuItem
                    icon={<KeyIcon className="w-6 h-6" />}
                    label="Cambia PIN"
                    description="Modifica il PIN di accesso all'app"
                    onClick={() => setShowChangePinScreen(true)}
                />

                <MenuItem
                    icon={<QuestionMarkCircleIcon className="w-6 h-6" />}
                    label="Password Dimenticata"
                    description="Recupera l'accesso al tuo account"
                    onClick={handleForgotPassword}
                />
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800">
                <p className="text-xs text-center text-slate-400 dark:text-slate-500">
                    Account: {email}
                </p>
            </div>
        </div>,
        document.body
    );
};

export default SecuritySettingsScreen;
