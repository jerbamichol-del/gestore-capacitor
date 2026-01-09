
import React from 'react';
import { SpinnerIcon } from './icons/SpinnerIcon';

interface LoadingOverlayProps {
    isVisible: boolean;
    message?: string;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ isVisible, message = 'Elaborazione...' }) => {
    if (!isVisible) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 transition-colors backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-2xl flex flex-col items-center gap-4 max-w-sm mx-4 animate-scale-in transition-colors">
                <div className="relative">
                    <div className="absolute inset-0 bg-indigo-100 dark:bg-indigo-900/30 rounded-full animate-ping opacity-75 transition-colors"></div>
                    <div className="relative bg-white dark:bg-slate-800 p-4 rounded-full shadow-md transition-colors">
                        <SpinnerIcon className="w-10 h-10 text-indigo-600 dark:text-indigo-400 animate-spin" />
                    </div>
                </div>
                <div className="text-center">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 transition-colors">Attendere prego</h3>
                    <p className="text-slate-500 dark:text-slate-400 mt-1 transition-colors">{message}</p>
                </div>
            </div>
        </div>
    );
};

export default LoadingOverlay;
