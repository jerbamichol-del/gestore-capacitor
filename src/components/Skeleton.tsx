import React from 'react';

interface SkeletonProps {
    className?: string;
    variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
    width?: string | number;
    height?: string | number;
    animation?: 'pulse' | 'wave' | 'none';
}

/**
 * Skeleton component for loading states.
 * Creates a shimmering placeholder that mimics content structure.
 */
const Skeleton: React.FC<SkeletonProps> = ({
    className = '',
    variant = 'rectangular',
    width,
    height,
    animation = 'wave',
}) => {
    const baseClasses = 'bg-slate-200 dark:bg-slate-700';

    const variantClasses = {
        text: 'rounded',
        circular: 'rounded-full',
        rectangular: '',
        rounded: 'rounded-lg',
    };

    const animationClasses = {
        pulse: 'animate-pulse',
        wave: 'skeleton-wave',
        none: '',
    };

    const style: React.CSSProperties = {
        width: width ?? '100%',
        height: height ?? (variant === 'text' ? '1em' : '100%'),
    };

    return (
        <>
            {animation === 'wave' && (
                <style>{`
          @keyframes skeleton-shimmer {
            0% {
              background-position: -200% 0;
            }
            100% {
              background-position: 200% 0;
            }
          }
          .skeleton-wave {
            background: linear-gradient(
              90deg,
              rgba(148, 163, 184, 0.1) 25%,
              rgba(148, 163, 184, 0.3) 50%,
              rgba(148, 163, 184, 0.1) 75%
            );
            background-size: 200% 100%;
            animation: skeleton-shimmer 1.5s ease-in-out infinite;
          }
          .dark .skeleton-wave {
            background: linear-gradient(
              90deg,
              rgba(100, 116, 139, 0.2) 25%,
              rgba(100, 116, 139, 0.4) 50%,
              rgba(100, 116, 139, 0.2) 75%
            );
            background-size: 200% 100%;
          }
        `}</style>
            )}
            <div
                className={`${baseClasses} ${variantClasses[variant]} ${animationClasses[animation]} ${className}`}
                style={style}
                aria-hidden="true"
            />
        </>
    );
};

// Pre-built skeleton patterns for common UI elements
export const SkeletonCard: React.FC<{ lines?: number }> = ({ lines = 3 }) => (
    <div className="midnight-card p-6 md:rounded-2xl shadow-xl space-y-4">
        <Skeleton variant="text" height={24} width="60%" />
        <Skeleton variant="text" height={16} width="40%" />
        <div className="space-y-3 mt-4">
            {Array.from({ length: lines }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                    <Skeleton variant="circular" width={40} height={40} />
                    <div className="flex-1 space-y-2">
                        <Skeleton variant="text" height={14} width="70%" />
                        <Skeleton variant="rounded" height={8} width="100%" />
                    </div>
                </div>
            ))}
        </div>
    </div>
);

export const SkeletonChart: React.FC = () => (
    <div className="midnight-card p-6 md:rounded-2xl shadow-xl">
        <Skeleton variant="text" height={24} width="50%" className="mb-2" />
        <Skeleton variant="text" height={14} width="70%" className="mb-6" />
        <Skeleton variant="rounded" height={220} />
    </div>
);

export const SkeletonListItem: React.FC = () => (
    <div className="flex items-center gap-4 p-4">
        <Skeleton variant="circular" width={48} height={48} />
        <div className="flex-1 space-y-2">
            <Skeleton variant="text" height={16} width="60%" />
            <Skeleton variant="text" height={12} width="40%" />
        </div>
        <Skeleton variant="text" height={20} width={80} />
    </div>
);

export default Skeleton;
