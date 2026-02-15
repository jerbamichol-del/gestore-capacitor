import React, { useState, useEffect, useMemo } from 'react';
import { Subscription, Account, Expense } from '../types';
import { SubscriptionService } from '../services/subscription-service';
import { getCategoryColor, getCategoryIcon } from '../utils/categoryStyles';
import { formatCurrency, formatDate } from '../components/icons/formatters';
import { ArrowLeftIcon } from '../components/icons/ArrowLeftIcon';
import { PlusIcon } from '../components/icons/PlusIcon';
import { TrashIcon } from '../components/icons/TrashIcon';
import { ChevronDownIcon } from '../components/icons/ChevronDownIcon';
import { CalendarIcon } from '../components/icons/CalendarIcon';
import { parseLocalYYYYMMDD, toYYYYMMDD } from '../utils/date';
import { EmptyState } from '../components/EmptyState';
import { CalendarDaysIcon } from '../components/icons/CalendarDaysIcon';
import { useTapBridge } from '../hooks/useTapBridge';

// --- Recurrence Helpers (mirrored from ExpenseForm) ---
const recurrenceLabels: Record<'daily' | 'weekly' | 'monthly' | 'yearly', string> = { daily: 'Giornaliera', weekly: 'Settimanale', monthly: 'Mensile', yearly: 'Annuale' };
const daysOfWeekLabels: Record<number, string> = { 0: 'Dom', 1: 'Lun', 2: 'Mar', 3: 'Mer', 4: 'Gio', 5: 'Ven', 6: 'Sab' };
const dayOfWeekNames = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
const ordinalSuffixes = ['primo', 'secondo', 'terzo', 'quarto', 'ultimo'];
const daysOfWeekForPicker = [{ label: 'Lun', value: 1 }, { label: 'Mar', value: 2 }, { label: 'Mer', value: 3 }, { label: 'Gio', value: 4 }, { label: 'Ven', value: 5 }, { label: 'Sab', value: 6 }, { label: 'Dom', value: 0 }];

const getIntervalLabel = (recurrence?: string, interval?: number) => {
    const count = interval || 1;
    switch (recurrence) {
        case 'daily': return count === 1 ? 'giorno' : 'giorni';
        case 'weekly': return count === 1 ? 'settimana' : 'settimane';
        case 'monthly': return count === 1 ? 'mese' : 'mesi';
        case 'yearly': return count === 1 ? 'anno' : 'anni';
        default: return 'mese';
    }
};

interface SubscriptionManagerScreenProps {
    accounts: Account[];
    recurringExpenses: any[];
    onClose: () => void;
    onCloseStart?: () => void;
    initialSubscription?: Partial<Subscription>;
    onAddRecurringExpense?: (expense: Expense) => void;
}

const SubscriptionManagerScreen: React.FC<SubscriptionManagerScreenProps> = ({
    accounts,
    recurringExpenses,
    onClose,
    onCloseStart,
    initialSubscription,
    onAddRecurringExpense
}) => {
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [isAnimatingIn, setIsAnimatingIn] = useState(false);
    const [isFormOpen, setIsFormOpen] = useState(!!initialSubscription);
    const [editingSub, setEditingSub] = useState<Partial<Subscription> | null>(initialSubscription || null);
    const tapBridge = useTapBridge();
    const [failedLogoIds, setFailedLogoIds] = useState<Set<string>>(new Set());

    // --- Recurrence Creation State ---
    const [isCreatingRecurrence, setIsCreatingRecurrence] = useState(false);
    const [recurrence, setRecurrence] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
    const [recurrenceInterval, setRecurrenceInterval] = useState<number>(1);
    const [recurrenceDays, setRecurrenceDays] = useState<number[]>([]);
    const [monthlyRecurrenceType, setMonthlyRecurrenceType] = useState<'dayOfMonth' | 'dayOfWeek'>('dayOfMonth');
    const [recurrenceEndType, setRecurrenceEndType] = useState<'forever' | 'date' | 'count'>('forever');
    const [recurrenceEndDate, setRecurrenceEndDate] = useState<string>('');
    const [recurrenceCount, setRecurrenceCount] = useState<number | undefined>(undefined);
    const [isRecurrenceTypeOpen, setIsRecurrenceTypeOpen] = useState(false);
    const [isRecurrenceEndOpen, setIsRecurrenceEndOpen] = useState(false);

    useEffect(() => {
        loadSubscriptions();
        const timer = setTimeout(() => setIsAnimatingIn(true), 10);
        return () => clearTimeout(timer);
    }, []);

    const loadSubscriptions = async () => {
        const data = await SubscriptionService.getSubscriptions();
        setSubscriptions(data);
    };

    const handleClose = () => {
        if (onCloseStart) onCloseStart();
        setIsAnimatingIn(false);
        setTimeout(onClose, 300);
    };

    const resetRecurrenceState = () => {
        setIsCreatingRecurrence(false);
        setRecurrence('monthly');
        setRecurrenceInterval(1);
        setRecurrenceDays([]);
        setMonthlyRecurrenceType('dayOfMonth');
        setRecurrenceEndType('forever');
        setRecurrenceEndDate('');
        setRecurrenceCount(undefined);
        setIsRecurrenceTypeOpen(false);
        setIsRecurrenceEndOpen(false);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingSub?.name || !editingSub?.amount) return;

        let linkedId = editingSub.linkedRecurringExpenseId;

        // If creating a new recurrence, create the recurring expense template first
        if (isCreatingRecurrence && onAddRecurringExpense) {
            const newRecurringId = crypto.randomUUID();
            const newRecurringExpense: Expense = {
                id: newRecurringId,
                type: 'expense',
                description: editingSub.name || '',
                amount: Number(editingSub.amount),
                date: editingSub.nextRenewalDate || toYYYYMMDD(new Date()),
                category: editingSub.category || 'Altro',
                accountId: accounts.length > 0 ? accounts[0].id : '',
                frequency: 'recurring',
                recurrence: recurrence,
                recurrenceInterval: recurrenceInterval,
                recurrenceDays: recurrence === 'weekly' ? recurrenceDays : undefined,
                monthlyRecurrenceType: recurrence === 'monthly' ? monthlyRecurrenceType : undefined,
                recurrenceEndType: recurrenceEndType,
                recurrenceEndDate: recurrenceEndType === 'date' ? recurrenceEndDate : undefined,
                recurrenceCount: recurrenceEndType === 'count' ? recurrenceCount : undefined,
            };
            onAddRecurringExpense(newRecurringExpense);
            linkedId = newRecurringId;
        }

        // Must have a linked recurring expense
        if (!linkedId && !isCreatingRecurrence) return;

        const newSub: Subscription = {
            id: editingSub.id || crypto.randomUUID(),
            name: editingSub.name,
            amount: Number(editingSub.amount),
            currency: editingSub.currency || '€',
            frequency: editingSub.frequency || 'monthly',
            nextRenewalDate: editingSub.nextRenewalDate || toYYYYMMDD(new Date()),
            category: editingSub.category || 'Altro',
            iconUrl: SubscriptionService.getLogoUrl(editingSub.name),
            linkedRecurringExpenseId: linkedId,
        };

        // Reset failed state for this ID if updating
        if (failedLogoIds.has(newSub.id)) {
            const newFailed = new Set(failedLogoIds);
            newFailed.delete(newSub.id);
            setFailedLogoIds(newFailed);
        }

        await SubscriptionService.saveSubscription(newSub);
        await loadSubscriptions();
        setIsFormOpen(false);
        setEditingSub(null);
        resetRecurrenceState();
    };

    const handleDelete = async (id: string) => {
        await SubscriptionService.deleteSubscription(id);
        await loadSubscriptions();
    };

    const handleImageError = (subId: string) => {
        setFailedLogoIds(prev => {
            const newSet = new Set(prev);
            newSet.add(subId);
            return newSet;
        });
    };

    const totalMonthly = useMemo(() => {
        return subscriptions.reduce((acc, sub) => {
            const amount = Number(sub.amount) || 0;
            return acc + (sub.frequency === 'yearly' ? amount / 12 : amount);
        }, 0);
    }, [subscriptions]);

    const sortedSubscriptions = useMemo(() => {
        return [...subscriptions].sort((a, b) => {
            const dateA = parseLocalYYYYMMDD(a.nextRenewalDate)?.getTime() || 0;
            const dateB = parseLocalYYYYMMDD(b.nextRenewalDate)?.getTime() || 0;
            return dateA - dateB;
        });
    }, [subscriptions]);

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(word => word[0])
            .join('')
            .substring(0, 2)
            .toUpperCase();
    };

    const handleToggleDay = (dayValue: number) => {
        setRecurrenceDays(prev => {
            const newDays = prev.includes(dayValue)
                ? prev.filter(d => d !== dayValue)
                : [...prev, dayValue];
            return newDays.sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b));
        });
    };

    const dynamicMonthlyDayOfWeekLabel = useMemo(() => {
        const dateString = editingSub?.nextRenewalDate;
        if (!dateString) return "Seleziona una data di rinnovo valida";
        const date = parseLocalYYYYMMDD(dateString);
        if (!date) return "Data non valida";
        const dayOfMonth = date.getDate();
        const dayOfWeek = date.getDay();
        const weekOfMonth = Math.floor((dayOfMonth - 1) / 7);
        return `Ogni ${ordinalSuffixes[weekOfMonth]} ${dayOfWeekNames[dayOfWeek]} del mese`;
    }, [editingSub?.nextRenewalDate]);

    // Check if save is allowed: must have linked recurring or be creating one
    const isLinkValid = !!(editingSub?.linkedRecurringExpenseId) || isCreatingRecurrence;
    const canSave = !!(editingSub?.name && editingSub?.amount && isLinkValid);

    return (
        <div className={`fixed inset-0 z-50 bg-sunset-cream dark:bg-midnight transform transition-transform duration-300 ease-in-out ${isAnimatingIn ? 'translate-y-0' : 'translate-y-full'}`} {...tapBridge}>
            <header className="sticky top-0 z-20 flex items-center gap-4 p-4 midnight-card shadow-sm dark:shadow-electric-violet/5 h-[60px] border-b border-transparent dark:border-electric-violet/10">
                <button onClick={handleClose} className="p-2 -ml-2 rounded-full hover:bg-slate-200 dark:hover:bg-midnight-card transition-colors">
                    <ArrowLeftIcon className="w-6 h-6 text-slate-700 dark:text-slate-200" />
                </button>
                <h1 className="text-xl font-bold text-slate-800 dark:text-white flex-1">Gestore Abbonamenti</h1>
                <button
                    onClick={() => { setEditingSub({}); resetRecurrenceState(); setIsFormOpen(true); }}
                    className="p-2 rounded-full bg-indigo-600 text-white shadow-lg active:scale-95 transition-transform"
                >
                    <PlusIcon className="w-6 h-6" />
                </button>
            </header>

            <main className="overflow-y-auto h-[calc(100%-60px)] p-4 pb-24">
                {/* Hero Section - Total Spending */}
                <div className="relative mb-8 p-6 rounded-3xl overflow-hidden shadow-xl transition-all duration-500 bg-white/70 dark:bg-midnight-card backdrop-blur-xl border border-white/20 dark:border-electric-violet/20">
                    <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-indigo-500/10 dark:bg-electric-violet/20 rounded-full blur-3xl animate-pulse"></div>
                    <div className="relative z-10">
                        <p className="text-indigo-600 dark:text-electric-violet font-bold uppercase tracking-widest text-[10px] mb-2">Spesa Totale Mensile</p>
                        <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">{formatCurrency(totalMonthly)}</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-xs mt-2 flex items-center gap-1.5 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                            Basato su {subscriptions.length} abbonamenti attivi
                        </p>
                    </div>
                </div>

                {subscriptions.length > 0 ? (
                    <div className="space-y-4">
                        {sortedSubscriptions.map((sub) => {
                            const CategoryIcon = getCategoryIcon(sub.category);
                            const color = getCategoryColor(sub.category);
                            const nextDate = parseLocalYYYYMMDD(sub.nextRenewalDate);
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            const diffDays = nextDate ? Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : 0;
                            const hasLogo = sub.iconUrl && !failedLogoIds.has(sub.id);

                            return (
                                <div key={sub.id} className="relative group p-4 rounded-2xl bg-white dark:bg-midnight-card shadow-sm border border-slate-100 dark:border-electric-violet/10 transition-all hover:shadow-md">
                                    <div className="flex items-center gap-4">
                                        <div className="relative w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                                            {hasLogo ? (
                                                <img
                                                    src={sub.iconUrl}
                                                    alt={sub.name}
                                                    className="w-full h-full object-contain"
                                                    onError={() => handleImageError(sub.id)}
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
                                                    <span className="text-sm font-bold" style={{ color: color }}>
                                                        {getInitials(sub.name)}
                                                    </span>
                                                </div>
                                            )}

                                            {/* Tiny category icon badge on bottom right */}
                                            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white dark:bg-midnight-card border border-slate-100 dark:border-slate-700 flex items-center justify-center shadow-sm z-10">
                                                <CategoryIcon className="w-3 h-3" style={{ color }} />
                                            </div>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-bold text-slate-900 dark:text-white truncate">{sub.name}</h3>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                {sub.frequency === 'monthly' ? 'Mensile' : 'Annuale'} • Prossimo: {formatDate(nextDate)}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-slate-900 dark:text-white uppercase">{formatCurrency(sub.amount)}</p>
                                            <p className={`text-[10px] font-bold uppercase tracking-widest ${diffDays < 0 ? 'text-red-500' : diffDays <= 3 ? 'text-orange-500 animate-pulse' : 'text-slate-400'}`}>
                                                {diffDays < 0 ? 'Scaduto' : diffDays === 0 ? 'Oggi' : diffDays === 1 ? 'Domani' : `Tra ${diffDays} gg`}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Progress Bar for Renewal */}
                                    <div className="mt-3 h-1 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-indigo-500 dark:bg-electric-violet transition-all duration-1000"
                                            style={{ width: `${Math.max(0, Math.min(100, (30 - diffDays) / 30 * 100))}%` }}
                                        ></div>
                                    </div>

                                    {/* Actions (Hidden by default, reveal on selection or hover) */}
                                    <div className="mt-3 flex gap-2">
                                        <button
                                            onClick={() => {
                                                if (sub.managementUrl) {
                                                    window.open(sub.managementUrl, '_blank');
                                                } else {
                                                    // Default search for cancellation page
                                                    window.open(`https://www.google.com/search?q=come+disdire+${sub.name}`, '_blank');
                                                }
                                            }}
                                            className="flex-1 py-1 px-3 rounded-lg bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-bold transition-all active:scale-95"
                                        >
                                            Disdici
                                        </button>
                                        <button
                                            onClick={() => handleDelete(sub.id)}
                                            className="p-1 px-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-red-500 transition-colors"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <EmptyState
                        title="Nessun abbonamento"
                        description="Collega le tue spese ricorrenti o aggiungi manualmente i tuoi abbonamenti (Netflix, Spotify, ecc.)"
                        icon={CalendarDaysIcon}
                    />
                )}
            </main>

            {/* Manual Add/Edit Form Overlay */}
            {isFormOpen && (
                <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
                    <div className="w-full max-w-md bg-white dark:bg-midnight-card rounded-3xl p-6 shadow-2xl animate-fade-in-up max-h-[85vh] overflow-y-auto">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
                            {editingSub?.id ? 'Modifica Abbonamento' : 'Nuovo Abbonamento'}
                        </h2>
                        <form onSubmit={handleSave} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome Servizio</label>
                                <input
                                    autoFocus
                                    type="text"
                                    value={editingSub?.name || ''}
                                    onChange={e => setEditingSub({ ...editingSub, name: e.target.value })}
                                    className="w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                                    placeholder="es. Netflix, Spotify..."
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Importo</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={editingSub?.amount || ''}
                                    onChange={e => setEditingSub({ ...editingSub, amount: Number(e.target.value) })}
                                    className="w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                                    required
                                />
                            </div>

                            {/* Data di Rinnovo */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Prossimo Rinnovo</label>
                                <input
                                    type="date"
                                    value={editingSub?.nextRenewalDate || toYYYYMMDD(new Date())}
                                    onChange={e => setEditingSub({ ...editingSub, nextRenewalDate: e.target.value })}
                                    className="w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                                />
                            </div>

                            {/* --- Collega/Crea Spesa Ricorrente (MANDATORY) --- */}
                            <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                                <label className="block text-xs font-bold text-indigo-600 dark:text-electric-violet uppercase mb-2 flex items-center gap-1.5">
                                    <CalendarDaysIcon className="w-4 h-4" />
                                    Collega/Crea Spesa Ricorrente
                                </label>
                                <select
                                    value={isCreatingRecurrence ? '__CREATE_NEW__' : (editingSub?.linkedRecurringExpenseId || '')}
                                    onChange={e => {
                                        const val = e.target.value;
                                        if (val === '__CREATE_NEW__') {
                                            setIsCreatingRecurrence(true);
                                            setEditingSub({ ...editingSub, linkedRecurringExpenseId: undefined });
                                            // Default recurrence from subscription frequency
                                            setRecurrence(editingSub?.frequency === 'yearly' ? 'yearly' : 'monthly');
                                        } else if (val) {
                                            setIsCreatingRecurrence(false);
                                            const expense = recurringExpenses.find(ex => ex.id === val);
                                            if (expense) {
                                                setEditingSub({
                                                    ...editingSub,
                                                    linkedRecurringExpenseId: expense.id,
                                                    name: editingSub?.name || expense.description || expense.subcategory,
                                                    amount: Number(expense.amount),
                                                    category: expense.category,
                                                    frequency: expense.recurrence === 'yearly' ? 'yearly' : 'monthly'
                                                });
                                            }
                                        } else {
                                            setIsCreatingRecurrence(false);
                                            setEditingSub({ ...editingSub, linkedRecurringExpenseId: undefined });
                                        }
                                    }}
                                    className="w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white text-sm"
                                >
                                    <option value="">-- Seleziona --</option>
                                    <option value="__CREATE_NEW__">➕ Crea nuova ricorrenza</option>
                                    {recurringExpenses
                                        .filter(ex => !subscriptions.some(s => s.linkedRecurringExpenseId === ex.id) || ex.id === editingSub?.linkedRecurringExpenseId)
                                        .map(ex => (
                                            <option key={ex.id} value={ex.id}>
                                                {ex.description || ex.subcategory} ({formatCurrency(ex.amount)})
                                            </option>
                                        ))
                                    }
                                </select>

                                {/* Validation hint */}
                                {!isLinkValid && (
                                    <p className="text-xs text-red-500 mt-1 font-medium">⚠️ Devi collegare o creare una spesa ricorrente</p>
                                )}

                                {/* --- Inline Recurrence Creator --- */}
                                {isCreatingRecurrence && (
                                    <div className="mt-3 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-200 dark:border-indigo-500/30 space-y-4 animate-fade-in-down">
                                        <p className="text-xs font-bold text-indigo-600 dark:text-electric-violet uppercase tracking-wider">Configura Ricorrenza</p>

                                        {/* Recurrence Type Selector */}
                                        <div className="relative">
                                            <button
                                                type="button"
                                                onClick={() => { setIsRecurrenceTypeOpen(prev => !prev); setIsRecurrenceEndOpen(false); }}
                                                className="w-full flex items-center justify-between text-left gap-2 px-3 py-2.5 text-sm rounded-lg border shadow-sm transition-colors bg-white dark:bg-midnight-card border-slate-300 dark:border-electric-violet/30 text-slate-800 dark:text-white hover:bg-slate-50 dark:hover:bg-midnight-card/80"
                                            >
                                                <span className="truncate flex-1 capitalize">{recurrenceLabels[recurrence]}</span>
                                                <ChevronDownIcon className={`w-4 h-4 text-slate-500 dark:text-slate-400 transition-transform ${isRecurrenceTypeOpen ? 'rotate-180' : ''}`} />
                                            </button>
                                            {isRecurrenceTypeOpen && (
                                                <div className="absolute top-full mt-1 w-full bg-white dark:bg-midnight-card border border-slate-200 dark:border-electric-violet/30 shadow-lg rounded-lg z-20 p-1.5 space-y-0.5 animate-fade-in-down">
                                                    {(Object.keys(recurrenceLabels) as Array<keyof typeof recurrenceLabels>).map((key) => (
                                                        <button
                                                            type="button"
                                                            key={key}
                                                            onClick={() => { setRecurrence(key); setIsRecurrenceTypeOpen(false); }}
                                                            className={`w-full text-left px-3 py-2 text-sm font-semibold rounded-lg transition-colors ${recurrence === key ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300' : 'text-slate-800 dark:text-white hover:bg-slate-100 dark:hover:bg-indigo-900/30'}`}
                                                        >
                                                            {recurrenceLabels[key]}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Interval */}
                                        <div className="flex items-center justify-center gap-2 bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Ogni</span>
                                            <input
                                                type="number"
                                                value={recurrenceInterval || ''}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (val === '') { setRecurrenceInterval(1); }
                                                    else { const num = parseInt(val, 10); if (!isNaN(num) && num > 0) setRecurrenceInterval(num); }
                                                }}
                                                onFocus={(e) => e.currentTarget.select()}
                                                className="w-16 text-center text-lg font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-700 rounded-md border-0 py-1 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-electric-violet"
                                                min="1"
                                            />
                                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{getIntervalLabel(recurrence, recurrenceInterval)}</span>
                                        </div>

                                        {/* Weekly Days Picker */}
                                        {recurrence === 'weekly' && (
                                            <div className="pt-1">
                                                <div className="flex flex-wrap justify-center gap-2">
                                                    {daysOfWeekForPicker.map(day => (
                                                        <button
                                                            type="button"
                                                            key={day.value}
                                                            onClick={() => handleToggleDay(day.value)}
                                                            className={`w-11 h-11 rounded-full text-xs font-semibold transition-colors focus:outline-none border-2 ${recurrenceDays.includes(day.value)
                                                                ? 'bg-indigo-600 text-white border-indigo-600'
                                                                : 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white border-slate-300 dark:border-indigo-600 hover:bg-slate-50 dark:hover:bg-slate-600'
                                                                }`}
                                                        >
                                                            {day.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Monthly Type */}
                                        {recurrence === 'monthly' && (
                                            <div className="pt-2 space-y-2 border-t border-indigo-200 dark:border-indigo-500/30">
                                                <div
                                                    role="radio"
                                                    aria-checked={monthlyRecurrenceType === 'dayOfMonth'}
                                                    onClick={() => setMonthlyRecurrenceType('dayOfMonth')}
                                                    className="flex items-center gap-3 p-2 cursor-pointer rounded-lg hover:bg-white/50 dark:hover:bg-slate-700/50"
                                                >
                                                    <div className="w-4 h-4 rounded-full border-2 border-slate-400 flex items-center justify-center flex-shrink-0">
                                                        {monthlyRecurrenceType === 'dayOfMonth' && <div className="w-2 h-2 bg-indigo-600 rounded-full" />}
                                                    </div>
                                                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">Lo stesso giorno di ogni mese</label>
                                                </div>
                                                <div
                                                    role="radio"
                                                    aria-checked={monthlyRecurrenceType === 'dayOfWeek'}
                                                    onClick={() => setMonthlyRecurrenceType('dayOfWeek')}
                                                    className="flex items-center gap-3 p-2 cursor-pointer rounded-lg hover:bg-white/50 dark:hover:bg-slate-700/50"
                                                >
                                                    <div className="w-4 h-4 rounded-full border-2 border-slate-400 flex items-center justify-center flex-shrink-0">
                                                        {monthlyRecurrenceType === 'dayOfWeek' && <div className="w-2 h-2 bg-indigo-600 rounded-full" />}
                                                    </div>
                                                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">{dynamicMonthlyDayOfWeekLabel}</label>
                                                </div>
                                            </div>
                                        )}

                                        {/* End Condition */}
                                        <div className="pt-2 border-t border-indigo-200 dark:border-indigo-500/30">
                                            <div className="grid grid-cols-2 gap-3 items-end">
                                                <div className={`relative ${recurrenceEndType === 'forever' ? 'col-span-2' : ''}`}>
                                                    <button
                                                        type="button"
                                                        onClick={() => { setIsRecurrenceEndOpen(prev => !prev); setIsRecurrenceTypeOpen(false); }}
                                                        className="w-full flex items-center justify-between text-left gap-2 px-3 py-2.5 text-sm rounded-lg border shadow-sm transition-colors bg-white dark:bg-midnight-card border-slate-300 dark:border-electric-violet/30 text-slate-800 dark:text-white hover:bg-slate-50 dark:hover:bg-midnight-card/80"
                                                    >
                                                        <span className="truncate flex-1 capitalize">
                                                            {recurrenceEndType === 'forever' ? 'Per sempre' : recurrenceEndType === 'date' ? 'Fino a' : 'Numero di volte'}
                                                        </span>
                                                        <ChevronDownIcon className={`w-4 h-4 text-slate-500 dark:text-slate-400 transition-transform ${isRecurrenceEndOpen ? 'rotate-180' : ''}`} />
                                                    </button>
                                                    {isRecurrenceEndOpen && (
                                                        <div className="absolute top-full mt-1 w-full bg-white dark:bg-midnight-card border border-slate-200 dark:border-electric-violet/30 shadow-lg rounded-lg z-20 p-1.5 space-y-0.5 animate-fade-in-down">
                                                            {(['forever', 'date', 'count'] as const).map(key => (
                                                                <button
                                                                    type="button"
                                                                    key={key}
                                                                    onClick={() => {
                                                                        setRecurrenceEndType(key);
                                                                        setIsRecurrenceEndOpen(false);
                                                                        if (key === 'forever') { setRecurrenceEndDate(''); setRecurrenceCount(undefined); }
                                                                        else if (key === 'date') { setRecurrenceEndDate(recurrenceEndDate || toYYYYMMDD(new Date())); setRecurrenceCount(undefined); }
                                                                        else { setRecurrenceEndDate(''); setRecurrenceCount(recurrenceCount || 12); }
                                                                    }}
                                                                    className={`w-full text-left px-3 py-2 text-sm font-semibold rounded-lg transition-colors ${recurrenceEndType === key ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300' : 'text-slate-800 dark:text-white hover:bg-slate-100 dark:hover:bg-indigo-900/30'}`}
                                                                >
                                                                    {key === 'forever' ? 'Per sempre' : key === 'date' ? 'Fino a' : 'Numero di volte'}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                {recurrenceEndType === 'date' && (
                                                    <div>
                                                        <label className="relative w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm rounded-lg text-indigo-600 dark:text-electric-violet hover:bg-indigo-100 dark:hover:bg-electric-violet/20 font-semibold cursor-pointer h-[42px]">
                                                            <CalendarIcon className="w-4 h-4" />
                                                            <span>{recurrenceEndDate ? formatDate(parseLocalYYYYMMDD(recurrenceEndDate)!) : 'Seleziona'}</span>
                                                            <input
                                                                type="date"
                                                                value={recurrenceEndDate}
                                                                onChange={(e) => setRecurrenceEndDate(e.target.value)}
                                                                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                                                            />
                                                        </label>
                                                    </div>
                                                )}
                                                {recurrenceEndType === 'count' && (
                                                    <div>
                                                        <input
                                                            type="number"
                                                            value={recurrenceCount || ''}
                                                            onChange={(e) => {
                                                                const num = parseInt(e.target.value, 10);
                                                                setRecurrenceCount(isNaN(num) || num <= 0 ? undefined : num);
                                                            }}
                                                            className="block w-full text-center rounded-lg border border-slate-300 dark:border-electric-violet/30 bg-white dark:bg-midnight-card py-2.5 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 dark:focus:border-electric-violet focus:ring-1 focus:ring-indigo-500 dark:focus:ring-electric-violet text-sm"
                                                            placeholder="N."
                                                            min="1"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => { setIsFormOpen(false); resetRecurrenceState(); }}
                                    className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold"
                                >
                                    Annulla
                                </button>
                                <button
                                    type="submit"
                                    disabled={!canSave}
                                    className={`flex-1 py-3 rounded-xl font-bold shadow-lg transition-all ${canSave
                                        ? 'bg-indigo-600 text-white shadow-indigo-500/30 active:scale-95'
                                        : 'bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed shadow-none'
                                        }`}
                                >
                                    Salva
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SubscriptionManagerScreen;
