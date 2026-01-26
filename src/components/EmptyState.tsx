import React from 'react';
import { PlusIcon } from './icons/PlusIcon';

interface EmptyStateProps {
    title: string;
    description: string;
    icon?: React.ElementType; // Componente Icona
    actionLabel?: string;
    onAction?: () => void;
    compact?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
    title,
    description,
    icon: Icon,
    actionLabel,
    onAction,
    compact = false
}) => {
    return (
        <div className={`flex flex-col items-center justify-center text-center p-8 animate-fade-in-up ${compact ? 'py-12' : 'py-20'}`}>
            <div className="relative mb-6 group">
                <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-full blur-xl opacity-20 dark:opacity-30 group-hover:opacity-40 transition-opacity duration-500 animate-pulse-slow"></div>
                <div className="relative bg-white dark:bg-midnight-card p-6 rounded-full shadow-xl border border-slate-100 dark:border-electric-violet/20 group-hover:scale-110 transition-transform duration-300">
                    {Icon ? (
                        <Icon className="w-12 h-12 text-indigo-500 dark:text-electric-violet" />
                    ) : (
                        <div className="w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-full" />
                    )}
                </div>

                {/* Decorative floating elements */}
                <div className="absolute -top-2 -right-2 w-4 h-4 bg-sunset-coral rounded-full blur-[1px] animate-bounce delay-75 opacity-80" />
                <div className="absolute -bottom-1 -left-2 w-3 h-3 bg-electric-violet rounded-full blur-[1px] animate-bounce delay-150 opacity-80" />
            </div>

            <h3 className="text-xl font-black text-slate-800 dark:text-white mb-2 tracking-tight">
                {title}
            </h3>

            <p className="text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed mb-8">
                {description}
            </p>

            {actionLabel && onAction && (
                <button
                    onClick={onAction}
                    className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-midnight-card border-2 border-indigo-100 dark:border-electric-violet/30 hover:border-indigo-500 dark:hover:border-electric-violet text-indigo-700 dark:text-electric-violet font-bold rounded-2xl shadow-sm hover:shadow-md transition-all active:scale-95"
                >
                    <PlusIcon className="w-5 h-5" strokeWidth={2.5} />
                    <span>{actionLabel}</span>
                </button>
            )}
        </div>
    );
};
