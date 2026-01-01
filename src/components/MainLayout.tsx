import React from 'react';

interface MainLayoutProps {
    header: React.ReactNode;
    children: React.ReactNode;
    fab?: React.ReactNode;
    modals?: React.ReactNode;
    badges?: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ header, children, fab, modals, badges }) => {
    return (
        <div className="h-full w-full bg-slate-100 flex flex-col font-sans" style={{ touchAction: 'pan-y' }}>
            <div className="flex-shrink-0 z-20">
                {header}
            </div>

            {badges && (
                <div className="fixed top-20 right-4 z-30">
                    {badges}
                </div>
            )}

            <main className="flex-grow bg-slate-100">
                <div className="w-full h-full overflow-y-auto space-y-6" style={{ touchAction: 'pan-y' }}>
                    {children}
                </div>
            </main>

            {fab}

            {/* Global Modals/Overlays */}
            {modals}
        </div>
    );
};
