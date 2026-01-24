import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Expense, Account } from '../types';
import { MagnifyingGlassIcon } from './icons/MagnifyingGlassIcon';
import { XMarkIcon } from './icons/XMarkIcon';
import { formatCurrency } from './icons/formatters';
import { getCategoryStyle } from '../utils/categoryStyles';
import { parseLocalYYYYMMDD } from '../utils/date';

interface GlobalSearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    expenses: Expense[];
    accounts: Account[];
    onSelectExpense: (expense: Expense) => void;
}

const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
    isOpen,
    onClose,
    expenses,
    accounts,
    onSelectExpense,
}) => {
    const [query, setQuery] = useState('');
    const [isAnimating, setIsAnimating] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            const t = setTimeout(() => {
                setIsAnimating(true);
                inputRef.current?.focus();
            }, 10);
            return () => clearTimeout(t);
        } else {
            setIsAnimating(false);
            setQuery('');
        }
    }, [isOpen]);

    const getAccountName = (accountId: string) => {
        return accounts.find(a => a.id === accountId)?.name || 'Conto';
    };

    const formatDate = (dateString: string) => {
        const date = parseLocalYYYYMMDD(dateString);
        if (!date) return dateString;
        return date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: '2-digit' });
    };

    const results = useMemo(() => {
        if (!query.trim() || query.length < 2) return [];

        const lowerQuery = query.toLowerCase();

        return expenses
            .filter(e => {
                const description = (e.description || '').toLowerCase();
                const category = (e.category || '').toLowerCase();
                const subcategory = (e.subcategory || '').toLowerCase();
                const accountName = getAccountName(e.accountId).toLowerCase();
                const amount = formatCurrency(e.amount).toLowerCase();
                const date = e.date || '';

                return (
                    description.includes(lowerQuery) ||
                    category.includes(lowerQuery) ||
                    subcategory.includes(lowerQuery) ||
                    accountName.includes(lowerQuery) ||
                    amount.includes(lowerQuery) ||
                    date.includes(lowerQuery)
                );
            })
            .sort((a, b) => {
                // Sort by date descending
                if (a.date && b.date) {
                    return b.date.localeCompare(a.date);
                }
                return 0;
            })
            .slice(0, 20); // Limit to 20 results
    }, [query, expenses, accounts]);

    const handleSelect = (expense: Expense) => {
        onSelectExpense(expense);
        onClose();
    };

    const getTypeLabel = (type?: string) => {
        switch (type) {
            case 'income': return 'Entrata';
            case 'transfer': return 'Trasferimento';
            case 'adjustment': return 'Rettifica';
            default: return 'Spesa';
        }
    };

    const getTypeColor = (type?: string) => {
        switch (type) {
            case 'income': return 'text-emerald-600 dark:text-emerald-400';
            case 'transfer': return 'text-sky-600 dark:text-sky-400';
            case 'adjustment': return 'text-slate-600 dark:text-slate-400';
            default: return 'text-rose-600 dark:text-rose-400';
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div
            className={`fixed inset-0 z-[6000] flex flex-col bg-sunset-cream dark:bg-midnight transition-opacity duration-300 ${isAnimating ? 'opacity-100' : 'opacity-0'}`}
        >
            {/* Header */}
            <div className="p-4 border-b border-slate-200 dark:border-electric-violet/20">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-midnight-card transition-colors"
                        aria-label="Chiudi ricerca"
                    >
                        <XMarkIcon className="w-6 h-6 text-slate-500 dark:text-slate-400" />
                    </button>
                    <div className="flex-1 relative">
                        <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                            <MagnifyingGlassIcon className="w-5 h-5 text-slate-400" />
                        </div>
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Cerca spese, entrate, categorie, note..."
                            className="w-full py-3 pl-12 pr-4 text-base rounded-xl border border-slate-300 dark:border-electric-violet/30 bg-white dark:bg-midnight-card text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 dark:focus:border-electric-violet focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-electric-violet/20"
                            autoComplete="off"
                            autoCorrect="off"
                            spellCheck="false"
                        />
                    </div>
                </div>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto">
                {query.length < 2 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center p-8">
                        <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                            <MagnifyingGlassIcon className="w-10 h-10 text-slate-400 dark:text-slate-500" />
                        </div>
                        <p className="text-slate-500 dark:text-slate-400 text-lg font-medium">
                            Digita almeno 2 caratteri per cercare
                        </p>
                        <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">
                            Cerca per descrizione, categoria, importo o data
                        </p>
                    </div>
                ) : results.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center p-8">
                        <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                            <span className="text-4xl">🔍</span>
                        </div>
                        <p className="text-slate-500 dark:text-slate-400 text-lg font-medium">
                            Nessun risultato per "{query}"
                        </p>
                        <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">
                            Prova con termini diversi
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        <div className="p-4 bg-slate-50 dark:bg-midnight-card/50">
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                                {results.length} risultat{results.length === 1 ? 'o' : 'i'} trovato{results.length === 1 ? '' : 'i'}
                            </p>
                        </div>
                        {results.map((expense) => {
                            const categoryStyle = getCategoryStyle(expense.category || 'Altro');
                            const Icon = categoryStyle.Icon;

                            return (
                                <button
                                    key={expense.id}
                                    onClick={() => handleSelect(expense)}
                                    className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-midnight-card/50 transition-colors text-left"
                                >
                                    <div className="flex-shrink-0">
                                        <Icon className="w-12 h-12" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${expense.type === 'income' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' :
                                                    expense.type === 'transfer' ? 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400' :
                                                        expense.type === 'adjustment' ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-400' :
                                                            'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400'
                                                }`}>
                                                {getTypeLabel(expense.type)}
                                            </span>
                                            <span className="text-xs text-slate-400 dark:text-slate-500">
                                                {formatDate(expense.date)}
                                            </span>
                                        </div>
                                        <p className="font-semibold text-slate-800 dark:text-white truncate">
                                            {expense.description || categoryStyle.label}
                                        </p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                                            {categoryStyle.label} • {getAccountName(expense.accountId)}
                                        </p>
                                    </div>
                                    <div className="flex-shrink-0 text-right">
                                        <p className={`text-lg font-bold ${getTypeColor(expense.type)}`}>
                                            {expense.type === 'income' ? '+' : expense.type === 'expense' ? '-' : ''}
                                            {formatCurrency(expense.amount)}
                                        </p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Quick tip footer */}
            <div className="p-4 border-t border-slate-200 dark:border-electric-violet/20 bg-slate-50 dark:bg-midnight-card/50">
                <p className="text-xs text-center text-slate-400 dark:text-slate-500">
                    💡 Suggerimento: cerca importi come "50€" o date come "2024-01"
                </p>
            </div>
        </div>,
        document.body
    );
};

export default GlobalSearchModal;
