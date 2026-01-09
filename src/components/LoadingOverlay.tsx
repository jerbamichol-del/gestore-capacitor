
import React from 'react';
import { SpinnerIcon } from './icons/SpinnerIcon';

interface LoadingOverlayProps {
    isVisible: boolean;
    message?: string;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ isVisible, message = 'Elaborazione...' }) => {
    if (!isVisible) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl p-6 shadow-2xl flex flex-col items-center gap-4 max-w-sm mx-4 animate-scale-in">
                <div className="relative">
                    <div className="absolute inset-0 bg-indigo-100 rounded-full animate-ping opacity-75"></div>
                    <div className="relative bg-white p-4 rounded-full shadow-md">
                        <SpinnerIcon className="w-10 h-10 text-indigo-600 animate-spin" />
                    </div>
                </div>
                <div className="text-center">
                    <h3 className="text-lg font-bold text-slate-800">Attendere prego</h3>
                    <p className="text-slate-500 mt-1">{message}</p>
                </div>
            </div>
        </div>
    );
};

export default LoadingOverlay;
