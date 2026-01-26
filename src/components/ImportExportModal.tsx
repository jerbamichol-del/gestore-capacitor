import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Expense } from '../types';
import { exportExpenses } from '../utils/fileHelper';
import { ArrowPathIcon } from './icons/ArrowPathIcon';
import { ArrowDownTrayIcon } from './icons/ArrowDownTrayIcon';
import { ArrowUpTrayIcon } from './icons/ArrowUpTrayIcon';
import { XMarkIcon } from './icons/XMarkIcon';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon';

interface ImportExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImportFile: (file: File) => void;
    onSync: () => Promise<void> | void;
    onOpenBankSyncSettings: () => void;
    expenses: Expense[];
    showToast: (msg: { message: string; type: 'success' | 'info' | 'error' }) => void;
}

const ImportExportModal: React.FC<ImportExportModalProps> = ({
    isOpen,
    onClose,
    onImportFile,
    onSync,
    onOpenBankSyncSettings,
    expenses,
    showToast
}) => {
    const [showExportOptions, setShowExportOptions] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const handleImportClick = () => {
        // Trigger file input
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            onImportFile(e.target.files[0]);
            onClose();
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleExportClick = async (format: 'excel' | 'json') => {
        setIsExporting(true);
        try {
            const result = await exportExpenses(expenses, format);
            onClose();
            // Show toast after close
            setTimeout(() => {
                showToast({
                    message: result.message,
                    type: result.success ? 'success' : 'error'
                });
            }, 300);
        } catch (error) {
            console.error('Export error:', error);
            showToast({ message: 'Errore imprevisto durante l\'export.', type: 'error' });
        } finally {
            setIsExporting(false);
        }
    };

    const handleSyncClick = async () => {
        onClose();
        await onSync();
    };



    return createPortal(
        <div className="fixed inset-0 z-[6000] flex justify-center items-end md:items-center p-0 md:p-4 bg-midnight/60 backdrop-blur-md animate-fade-in" onClick={onClose}>
            <div
                className="midnight-card rounded-t-3xl md:rounded-2xl shadow-2xl w-full max-w-lg border border-transparent dark:border-electric-violet/30 overflow-hidden animate-slide-up md:animate-scale-in"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 flex items-center justify-between border-b dark:border-slate-800">
                    <div className="flex items-center gap-3">
                        {showExportOptions && (
                            <button
                                onClick={() => setShowExportOptions(false)}
                                className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                <ArrowLeftIcon className="w-6 h-6 text-slate-500" />
                            </button>
                        )}
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white">
                            {showExportOptions ? 'Seleziona Formato' : 'Importa / Esporta'}
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        <XMarkIcon className="w-6 h-6 text-slate-500" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    {!showExportOptions ? (
                        <div className="grid grid-cols-1 gap-4">
                            <button
                                onClick={handleSyncClick}
                                className="flex items-center gap-4 p-4 rounded-xl border-2 border-slate-100 dark:border-slate-800 hover:border-cyan-500 dark:hover:border-cyan-500/50 hover:bg-cyan-50 dark:hover:bg-cyan-950/20 transition-all text-left group"
                            >
                                <div className="w-12 h-12 flex items-center justify-center bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 rounded-lg group-hover:scale-110 transition-transform">
                                    <ArrowPathIcon className="w-7 h-7" />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-800 dark:text-white text-lg">Sincronizza Cloud</p>
                                    <p className="text-sm text-slate-500">Scarica gli ultimi dati dal cloud.</p>
                                </div>
                            </button>

                            <button
                                onClick={handleImportClick}
                                className="flex items-center gap-4 p-4 rounded-xl border-2 border-slate-100 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-electric-violet hover:bg-indigo-50 dark:hover:bg-indigo-950/20 transition-all text-left group"
                            >
                                <div className="w-12 h-12 flex items-center justify-center bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg group-hover:scale-110 transition-transform">
                                    <ArrowDownTrayIcon className="w-7 h-7" />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-800 dark:text-white text-lg">Importa (CSV/Excel/JSON)</p>
                                    <p className="text-sm text-slate-500">Ripristina da un file precedentemente esportato.</p>
                                </div>
                            </button>

                            <button
                                onClick={() => setShowExportOptions(true)}
                                className="flex items-center gap-4 p-4 rounded-xl border-2 border-slate-100 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500/50 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-all text-left group"
                            >
                                <div className="w-12 h-12 flex items-center justify-center bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-lg group-hover:scale-110 transition-transform">
                                    <ArrowUpTrayIcon className="w-7 h-7" />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-800 dark:text-white text-lg">Esporta (Excel/JSON)</p>
                                    <p className="text-sm text-slate-500">Salva tutte le tue spese in locale.</p>
                                </div>
                            </button>


                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <button
                                onClick={() => handleExportClick('excel')}
                                disabled={isExporting}
                                className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-slate-100 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500/50 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-all group disabled:opacity-50"
                            >
                                <div className="w-16 h-16 flex items-center justify-center bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-full mb-3 group-hover:scale-110 transition-transform">
                                    <svg className="w-8 h-8 font-black" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16h-8v-2h8v2zm0-4h-8v-2h8v2zm-3-5V3.5L18.5 9H13z" /></svg>
                                </div>
                                <p className="font-bold text-slate-800 dark:text-white">Excel (.xlsx)</p>
                                <p className="text-xs text-slate-500 mt-1">Leggibile con Excel/Drive</p>
                            </button>

                            <button
                                onClick={() => handleExportClick('json')}
                                disabled={isExporting}
                                className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-slate-100 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500/50 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 transition-all group disabled:opacity-50"
                            >
                                <div className="w-16 h-16 flex items-center justify-center bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-full mb-3 group-hover:scale-110 transition-transform">
                                    <svg className="w-8 h-8 font-black" viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zM4 18V6h16v12H4z" /><path d="M6 10h2v2H6zm0 4h2v2H6zm4-4h2v2h-2zm0 4h2v2h-2zm4-4h4v2h-4zm0 4h4v2h-4z" /></svg>
                                </div>
                                <p className="font-bold text-slate-800 dark:text-white">JSON (.json)</p>
                                <p className="text-xs text-slate-500 mt-1">Backup completo dati</p>
                            </button>
                        </div>
                    )}

                    {isExporting && (
                        <div className="mt-6 flex flex-col items-center">
                            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3" />
                            <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 animate-pulse">Generazione file in corso...</p>
                        </div>
                    )}
                </div>
            </div>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".json" />
        </div>,
        document.body
    );
};

export default ImportExportModal;
