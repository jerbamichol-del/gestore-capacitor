import React, { useState, useEffect, useMemo } from 'react';
import { Subscription, Account } from '../types';
import { SubscriptionService } from '../services/subscription-service';
import { getCategoryColor, getCategoryIcon } from '../utils/categoryStyles';
import { formatCurrency, formatDate } from '../components/icons/formatters';
import { ArrowLeftIcon } from '../components/icons/ArrowLeftIcon';
import { PlusIcon } from '../components/icons/PlusIcon';
import { TrashIcon } from '../components/icons/TrashIcon';
import { parseLocalYYYYMMDD, toYYYYMMDD } from '../utils/date';
import { EmptyState } from '../components/EmptyState';
import { CalendarDaysIcon } from '../components/icons/CalendarDaysIcon';
import { useTapBridge } from '../hooks/useTapBridge';

interface SubscriptionManagerScreenProps {
    accounts: Account[];
    onClose: () => void;
    onCloseStart?: () => void;
    initialSubscription?: Partial<Subscription>;
}

const SubscriptionManagerScreen: React.FC<SubscriptionManagerScreenProps> = ({
    accounts,
    onClose,
    onCloseStart,
    initialSubscription
}) => {
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [isAnimatingIn, setIsAnimatingIn] = useState(false);
    const [isFormOpen, setIsFormOpen] = useState(!!initialSubscription);
    const [editingSub, setEditingSub] = useState<Partial<Subscription> | null>(initialSubscription || null);
    const tapBridge = useTapBridge();

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

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingSub?.name || !editingSub?.amount) return;

        const newSub: Subscription = {
            id: editingSub.id || crypto.randomUUID(),
            name: editingSub.name,
            amount: Number(editingSub.amount),
            currency: editingSub.currency || '€',
            frequency: editingSub.frequency || 'monthly',
            nextRenewalDate: editingSub.nextRenewalDate || toYYYYMMDD(new Date()),
            category: editingSub.category || 'Altro',
            iconUrl: SubscriptionService.getLogoUrl(editingSub.name),
            linkedRecurringExpenseId: editingSub.linkedRecurringExpenseId,
        };

        await SubscriptionService.saveSubscription(newSub);
        await loadSubscriptions();
        setIsFormOpen(false);
        setEditingSub(null);
    };

    const handleDelete = async (id: string) => {
        await SubscriptionService.deleteSubscription(id);
        await loadSubscriptions();
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

    return (
        <div className={`fixed inset-0 z-50 bg-sunset-cream dark:bg-midnight transform transition-transform duration-300 ease-in-out ${isAnimatingIn ? 'translate-y-0' : 'translate-y-full'}`} {...tapBridge}>
            <header className="sticky top-0 z-20 flex items-center gap-4 p-4 midnight-card shadow-sm dark:shadow-electric-violet/5 h-[60px] border-b border-transparent dark:border-electric-violet/10">
                <button onClick={handleClose} className="p-2 -ml-2 rounded-full hover:bg-slate-200 dark:hover:bg-midnight-card transition-colors">
                    <ArrowLeftIcon className="w-6 h-6 text-slate-700 dark:text-slate-200" />
                </button>
                <h1 className="text-xl font-bold text-slate-800 dark:text-white flex-1">Gestore Abbonamenti</h1>
                <button
                    onClick={() => { setEditingSub({}); setIsFormOpen(true); }}
                    className="p-2 rounded-full bg-indigo-600 text-white shadow-lg active:scale-95 transition-transform"
                >
                    <PlusIcon className="w-6 h-6" />
                </button>
            </header>

            <main className="overflow-y-auto h-[calc(100%-60px)] p-4 pb-24">
                {/* Hero Section - Total Spending */}
                <div className="relative mb-8 p-6 rounded-3xl overflow-hidden shadow-2xl transition-all duration-500 bg-white/40 dark:bg-electric-violet/10 backdrop-blur-xl border border-white/20 dark:border-electric-violet/20">
                    <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl animate-pulse"></div>
                    <div className="relative z-10">
                        <p className="text-indigo-600 dark:text-electric-violet font-medium uppercase tracking-wider text-xs mb-1">Spesa Totale Mensile</p>
                        <h2 className="text-4xl font-black text-slate-900 dark:text-white">{formatCurrency(totalMonthly)}</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Basato su {subscriptions.length} abbonamenti attivi</p>
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

                            return (
                                <div key={sub.id} className="relative group p-4 rounded-2xl bg-white dark:bg-midnight-card shadow-sm border border-slate-100 dark:border-electric-violet/10 transition-all hover:shadow-md">
                                    <div className="flex items-center gap-4">
                                        <div className="relative w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                                            {sub.iconUrl ? (
                                                <img
                                                    src={sub.iconUrl}
                                                    alt={sub.name}
                                                    className="w-full h-full object-contain"
                                                    onError={(e) => (e.currentTarget.style.display = 'none')}
                                                />
                                            ) : (
                                                <CategoryIcon className="w-6 h-6" style={{ color }} />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-bold text-slate-900 dark:text-white truncate">{sub.name}</h3>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                {sub.frequency === 'monthly' ? 'Mensile' : 'Annuale'} • Prossimo: {formatDate(nextDate)}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-slate-900 dark:text-white">{formatCurrency(sub.amount)}</p>
                                            <p className={`text-[10px] font-bold uppercase tracking-tighter ${diffDays <= 3 ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}>
                                                {diffDays <= 0 ? 'Scaduto' : diffDays === 1 ? 'Domani' : `Tra ${diffDays} gg`}
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
                    <div className="w-full max-w-md bg-white dark:bg-midnight-card rounded-3xl p-6 shadow-2xl animate-fade-in-up">
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
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Importo</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={editingSub?.amount || ''}
                                        onChange={e => setEditingSub({ ...editingSub, amount: Number(e.target.value) })}
                                        className="w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Frequenza</label>
                                    <select
                                        value={editingSub?.frequency || 'monthly'}
                                        onChange={e => setEditingSub({ ...editingSub, frequency: e.target.value as 'monthly' | 'yearly' })}
                                        className="w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                                    >
                                        <option value="monthly">Mensile</option>
                                        <option value="yearly">Annuale</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsFormOpen(false)}
                                    className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold"
                                >
                                    Annulla
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-500/30"
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
