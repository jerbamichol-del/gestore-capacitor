import React from 'react';
import { XMarkIcon } from '../icons/XMarkIcon';

interface DashboardCardWrapperProps {
    children: React.ReactNode;
    onRemove?: () => void;
    className?: string;
}

export const DashboardCardWrapper: React.FC<DashboardCardWrapperProps> = ({ children, onRemove, className = "" }) => {
    return (
        <div className={`midnight-card p-6 md:rounded-2xl shadow-xl transition-all duration-300 relative group ${className}`}>
            {onRemove && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemove();
                    }}
                    className="absolute top-3 right-3 p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow-sm"
                    title="Rimuovi dalla Home"
                >
                    <XMarkIcon className="w-4 h-4" />
                </button>
            )}
            {children}
        </div>
    );
};
