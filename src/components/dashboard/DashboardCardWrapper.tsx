import React from 'react';
import { XMarkIcon } from '../icons/XMarkIcon';

interface DashboardCardWrapperProps {
    children: React.ReactNode;
    onRemove?: () => void;
    className?: string;
}

export const DashboardCardWrapper: React.FC<DashboardCardWrapperProps> = ({ children, onRemove, className = "" }) => {
    return (
        <div className={`relative group ${className}`}>
            {onRemove && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemove();
                    }}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-slate-100/80 dark:bg-slate-800/80 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow-sm backdrop-blur-sm"
                    title="Rimuovi dalla Home"
                >
                    <XMarkIcon className="w-4 h-4" />
                </button>
            )}
            {children}
        </div>
    );
};
