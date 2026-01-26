import React, { useState, useMemo } from 'react';
import { EventBudget, Expense } from '../types';
import { createPortal } from 'react-dom';
import { XMarkIcon } from './icons/XMarkIcon';
import { PlusIcon } from './icons/PlusIcon';
import { CalendarIcon } from './icons/CalendarIcon';
import { TrashIcon } from './icons/TrashIcon';
import { formatCurrency } from './icons/formatters';
import { parseLocalYYYYMMDD, toYYYYMMDD } from '../utils/date';
import ConfirmationModal from './ConfirmationModal';
import { EmptyState } from './EmptyState';
import { CalendarDaysIcon } from './icons/CalendarDaysIcon';

interface EventBudgetsModalProps {
    isOpen: boolean;
    onClose: () => void;
    eventBudgets: EventBudget[];
    onSaveEventBudget: (budget: EventBudget) => void;
    onDeleteEventBudget: (id: string) => void;
    expenses: Expense[];
}

export const EventBudgetsModal: React.FC<EventBudgetsModalProps> = ({
    isOpen,
    onClose,
    eventBudgets,
    onSaveEventBudget,
    onDeleteEventBudget,
    expenses
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editingBudget, setEditingBudget] = useState<Partial<EventBudget>>({});
    const [deleteId, setDeleteId] = useState<string | null>(null);

    // Calculate progress for each budget
    const budgetsWithProgress = useMemo(() => {
        return eventBudgets.map(budget => {
            const start = parseLocalYYYYMMDD(budget.startDate);
            const end = parseLocalYYYYMMDD(budget.endDate);
            // End date should include the full day
            end.setHours(23, 59, 59, 999);

            const totalSpent = expenses.reduce((acc, expense) => {
                if (expense.type !== 'expense') return acc;
                const d = parseLocalYYYYMMDD(expense.date);
                if (d >= start && d <= end) {
                    // Optional category filter logic here if implemented
                    return acc + Math.abs(Number(expense.amount));
                }
                return acc;
            }, 0);

            return { ...budget, totalSpent, progress: Math.min((totalSpent / budget.totalBudget) * 100, 100) };
        }).sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
    }, [eventBudgets, expenses]);

    const handleSave = () => {
        if (!editingBudget.name || !editingBudget.startDate || !editingBudget.endDate || !editingBudget.totalBudget) return;

        onSaveEventBudget({
            id: editingBudget.id || crypto.randomUUID(),
            name: editingBudget.name,
            totalBudget: Number(editingBudget.totalBudget),
            startDate: editingBudget.startDate,
            endDate: editingBudget.endDate,
            color: editingBudget.color || 'indigo',
            categories: []
        });
        setIsEditing(false);
        setEditingBudget({});
    };

    const handleNew = () => {
        setEditingBudget({
            startDate: toYYYYMMDD(new Date()),
            endDate: toYYYYMMDD(new Date()),
            color: 'indigo'
        });
        setIsEditing(true);
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9000] flex flex-col bg-slate-50 dark:bg-midnight transition-colors">
            <header className="px-4 py-3 bg-white dark:bg-midnight-card border-b border-slate-200 dark:border-electric-violet/20 flex items-center justify-between shadow-sm sticky top-0 z-10" style={{ paddingTop: 'env(safe-area-inset-top, 12px)' }}>
                <div className="flex items-center gap-3">
                    <button onClick={isEditing ? () => setIsEditing(false) : onClose} className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300 transition-colors">
                        {isEditing ? <span className="text-sm font-bold text-slate-500">Annulla</span> : <XMarkIcon className="w-6 h-6" />}
                    </button>
                    <h1 className="text-xl font-bold text-slate-800 dark:text-white">
                        {isEditing ? (editingBudget.id ? 'Modifica Evento' : 'Nuovo Evento') : 'Budget Eventi'}
                    </h1>
                </div>
                {!isEditing && (
                    <button onClick={handleNew} className="p-2 rounded-full bg-indigo-50 dark:bg-electric-violet/20 text-indigo-600 dark:text-electric-violet hover:bg-indigo-100 dark:hover:bg-electric-violet/30 transition-colors">
                        <PlusIcon className="w-6 h-6" strokeWidth={2.5} />
                    </button>
                )}
            </header>

            <main className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {isEditing ? (
                    <div className="space-y-6 max-w-lg mx-auto animate-fade-in-up">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Nome Evento/Viaggio</label>
                            <input
                                autoFocus
                                type="text"
                                value={editingBudget.name || ''}
                                onChange={e => setEditingBudget(p => ({ ...p, name: e.target.value }))}
                                placeholder="Es. Vacanza a Roma"
                                className="w-full p-3 rounded-xl border border-slate-300 dark:border-electric-violet/30 bg-white dark:bg-midnight-card text-lg focus:ring-2 focus:ring-indigo-500 dark:focus:ring-electric-violet focus:border-transparent outline-none dark:text-white"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Dal</label>
                                <div className="relative">
                                    <input
                                        type="date"
                                        value={editingBudget.startDate || ''}
                                        onChange={e => setEditingBudget(p => ({ ...p, startDate: e.target.value }))}
                                        className="w-full p-3 pl-10 rounded-xl border border-slate-300 dark:border-electric-violet/30 bg-white dark:bg-midnight-card text-base focus:ring-2 focus:ring-indigo-500 dark:focus:ring-electric-violet outline-none dark:text-white [color-scheme:light] dark:[color-scheme:dark]"
                                    />
                                    <CalendarIcon className="w-5 h-5 absolute left-3 top-3.5 text-slate-400 pointer-events-none" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Al</label>
                                <div className="relative">
                                    <input
                                        type="date"
                                        value={editingBudget.endDate || ''}
                                        onChange={e => setEditingBudget(p => ({ ...p, endDate: e.target.value }))}
                                        className="w-full p-3 pl-10 rounded-xl border border-slate-300 dark:border-electric-violet/30 bg-white dark:bg-midnight-card text-base focus:ring-2 focus:ring-indigo-500 dark:focus:ring-electric-violet outline-none dark:text-white [color-scheme:light] dark:[color-scheme:dark]"
                                    />
                                    <CalendarIcon className="w-5 h-5 absolute left-3 top-3.5 text-slate-400 pointer-events-none" />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Budget Totale (€)</label>
                            <input
                                type="number"
                                value={editingBudget.totalBudget || ''}
                                onChange={e => setEditingBudget(p => ({ ...p, totalBudget: parseFloat(e.target.value) }))}
                                placeholder="0.00"
                                className="w-full p-3 rounded-xl border border-slate-300 dark:border-electric-violet/30 bg-white dark:bg-midnight-card text-2xl font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 dark:focus:ring-electric-violet outline-none"
                            />
                        </div>

                        <button
                            disabled={!editingBudget.name || !editingBudget.totalBudget}
                            onClick={handleSave}
                            className="w-full py-4 bg-indigo-600 dark:btn-electric text-white rounded-xl font-bold text-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed mt-8 hover:brightness-110 active:scale-[0.98] transition-all"
                        >
                            Salva Evento
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4 max-w-2xl mx-auto">
                        {budgetsWithProgress.length > 0 ? (
                            budgetsWithProgress.map(budget => {
                                const isOver = budget.totalSpent > budget.totalBudget;
                                const percent = Math.min((budget.totalSpent / budget.totalBudget) * 100, 100);

                                return (
                                    <div key={budget.id} onClick={() => { setEditingBudget(budget); setIsEditing(true); }} className="midnight-card bg-white dark:bg-midnight-card p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-electric-violet/20 active:scale-[0.99] transition-transform cursor-pointer group">
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <h3 className="font-bold text-lg text-slate-800 dark:text-white">{budget.name}</h3>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                                    {parseLocalYYYYMMDD(budget.startDate).toLocaleDateString()} - {parseLocalYYYYMMDD(budget.endDate).toLocaleDateString()}
                                                </p>
                                            </div>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setDeleteId(budget.id); }}
                                                className="p-2 text-slate-400 hover:text-red-500 dark:hover:text-rose-400 transition-colors"
                                            >
                                                <TrashIcon className="w-5 h-5" />
                                            </button>
                                        </div>

                                        <div className="flex items-end justify-between mb-2">
                                            <div>
                                                <span className={`text-2xl font-black ${isOver ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-white'}`}>
                                                    {formatCurrency(budget.totalSpent)}
                                                </span>
                                                <span className="text-sm text-slate-500 dark:text-slate-400 font-medium ml-1">
                                                    / {formatCurrency(budget.totalBudget)}
                                                </span>
                                            </div>
                                            <span className={`text-sm font-bold ${isOver ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                                {percent.toFixed(0)}%
                                            </span>
                                        </div>

                                        <div className="h-3 w-full bg-slate-100 dark:bg-black/40 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-500 ${isOver ? 'bg-rose-500' : 'bg-gradient-to-r from-indigo-500 to-purple-500 dark:from-electric-violet dark:to-fuchsia-500'}`}
                                                style={{ width: `${percent}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <EmptyState
                                title="Nessun evento attivo"
                                description="Crea un budget temporaneo per viaggi, weekend o progetti speciali per tenere traccia delle spese in un periodo specifico."
                                icon={CalendarDaysIcon}
                                actionLabel="Crea Nuovo Evento"
                                onAction={handleNew}
                            />
                        )}
                    </div>
                )}
            </main>

            <ConfirmationModal
                isOpen={!!deleteId}
                onClose={() => setDeleteId(null)}
                onConfirm={() => { if (deleteId) onDeleteEventBudget(deleteId); setDeleteId(null); }}
                title="Elimina Budget Evento"
                message="Sei sicuro? Le spese associate NON verranno eliminate, ma perderai il tracciamento del budget per questo evento."
                variant="danger"
            />
        </div>,
        document.body
    );
};
