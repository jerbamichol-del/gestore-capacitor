import React, { useMemo } from 'react';
import { Expense, Budgets } from '../types';
import { formatCurrency } from './icons/formatters';
import { LightBulbIcon, ArrowsUpDownIcon } from './icons';
import { parseLocalYYYYMMDD } from '../utils/date';

interface AIInsightsWidgetProps {
    expenses: Expense[];
    budgets?: Budgets;
    onOpenBudgetSettings?: () => void;
}

const AIInsightsWidget: React.FC<AIInsightsWidgetProps> = ({ expenses, budgets = {}, onOpenBudgetSettings }) => {
    const insights = useMemo(() => {
        const list = expenses.filter(e => e.type === 'expense');
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

        // Filter transactions
        const thisMonthTx = list.filter(e => {
            if (!e.date) return false;
            const d = parseLocalYYYYMMDD(e.date);
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        });

        const lastMonthTx = list.filter(e => {
            if (!e.date) return false;
            const d = parseLocalYYYYMMDD(e.date);
            return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
        });

        // 1. Total comparison (pro-rated logic could be added, but simple comparison for now)
        const thisMonthTotal = thisMonthTx.reduce((sum, e) => sum + Number(e.amount), 0);
        const lastMonthTotal = lastMonthTx.reduce((sum, e) => sum + Number(e.amount), 0);

        // 2. Category spike detection
        const catTotalsThis: Record<string, number> = {};
        const catTotalsLast: Record<string, number> = {};

        thisMonthTx.forEach(e => catTotalsThis[e.category] = (catTotalsThis[e.category] || 0) + Number(e.amount));
        lastMonthTx.forEach(e => catTotalsLast[e.category] = (catTotalsLast[e.category] || 0) + Number(e.amount));

        let maxSpikeCat = '';
        let maxSpikeAmount = 0;

        Object.keys(catTotalsThis).forEach(cat => {
            const diff = catTotalsThis[cat] - (catTotalsLast[cat] || 0);
            if (diff > maxSpikeAmount && diff > 50) { // Only care if diff > 50€
                maxSpikeAmount = diff;
                maxSpikeCat = cat;
            }
        });

        // 3. Subscription detection strategy (naive: same amount, same description, > 1 occurrence)
        // Looking at global history for better accuracy
        const recurringCandidates: Record<string, { count: number, amount: number, desc: string, dates: string[] }> = {};

        // Check last 90 days
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        list.forEach(e => {
            if (!e.date) return;
            if (parseLocalYYYYMMDD(e.date) < ninetyDaysAgo) return;

            // Key: Amount + Description (slugified)
            const key = `${e.amount.toFixed(2)}-${e.description.toLowerCase().trim()}`;
            if (!recurringCandidates[key]) {
                recurringCandidates[key] = { count: 0, amount: Number(e.amount), desc: e.description, dates: [] };
            }
            recurringCandidates[key].count++;
            recurringCandidates[key].dates.push(e.date);
        });

        // Filter probable subscriptions (at least 2 times, roughly 25-35 days apart or exactly 30)
        // Simplifying to: count >= 2 and type not 'recurring' (if already marked)
        const potentialSubscriptions = Object.values(recurringCandidates)
            .filter(c => c.count >= 2 && c.count <= 4) // monthly in 3 months = ~3
            .filter(c => !expenses.some(e => e.frequency === 'recurring' && e.description === c.desc));


        // 4. Budget Status
        const budgetAlerts: Array<{ cat: string, spent: number, limit: number, percent: number }> = [];
        Object.keys(budgets).forEach(cat => {
            const limit = budgets[cat];
            if (limit <= 0) return;

            const spent = cat === 'total'
                ? thisMonthTotal
                : (catTotalsThis[cat] || 0);

            const percent = (spent / limit) * 100;
            if (percent > 0) {
                budgetAlerts.push({ cat, spent, limit, percent });
            }
        });

        // Sort by percent descending
        budgetAlerts.sort((a, b) => b.percent - a.percent);

        return {
            thisMonthTotal,
            lastMonthTotal,
            diffTotal: thisMonthTotal - lastMonthTotal,
            maxSpikeCat,
            maxSpikeAmount,
            potentialSubscriptions,
            budgetAlerts
        };
    }, [expenses, budgets]);

    if (expenses.length === 0) return null;

    return (
        <div className="midnight-card p-5 md:rounded-3xl shadow-lg border border-slate-100 dark:border-electric-violet/20 bg-gradient-to-br from-indigo-50/50 to-white dark:from-indigo-950/20 dark:to-midnight-card">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white">Insights & Budget</h3>
                </div>
            </div>

            <div className="space-y-4">
                {/* Monthly Comparison */}
                <div className="p-4 bg-white/60 dark:bg-black/20 rounded-xl border border-indigo-100 dark:border-indigo-500/10">
                    <p className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">Trend Mensile</p>
                    <div className="flex justify-between items-end">
                        <div>
                            <span className="text-2xl font-black text-slate-800 dark:text-white">{formatCurrency(insights.thisMonthTotal)}</span>
                            <p className="text-xs text-slate-500">spesi questo mese</p>
                        </div>
                        <div className={`text-right ${insights.diffTotal > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                            <span className="font-bold text-lg">
                                {insights.diffTotal > 0 ? '+' : ''}{formatCurrency(insights.diffTotal)}
                            </span>
                            <p className="text-xs font-medium">vs mese scorso</p>
                        </div>
                    </div>
                    {insights.diffTotal > 0 ? (
                        <p className="text-xs text-rose-500 mt-2 font-medium">⚠️ Stai spendendo di più. Attenzione alle uscite!</p>
                    ) : (
                        <p className="text-xs text-emerald-500 mt-2 font-medium">🎉 Ottimo lavoro! Stai risparmiando rispetto al mese scorso.</p>
                    )}
                </div>

                {/* Category Spike Alert */}
                {insights.maxSpikeCat && (
                    <div className="flex gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-700/30">
                        <span className="text-2xl">📈</span>
                        <div>
                            <p className="text-sm font-bold text-amber-900 dark:text-amber-200">Occhio a "{insights.maxSpikeCat}"</p>
                            <p className="text-xs text-amber-800 dark:text-amber-300/80">
                                Hai speso <span className="font-bold">+{formatCurrency(insights.maxSpikeAmount)}</span> in più rispetto al mese scorso in questa categoria.
                            </p>
                        </div>
                    </div>
                )}

                {/* Subscription Detective */}
                {insights.potentialSubscriptions.length > 0 && (
                    <div className="flex gap-3 p-3 rounded-xl bg-sky-50 dark:bg-sky-900/10 border border-sky-100 dark:border-sky-700/30">
                        <span className="text-2xl">🕵️</span>
                        <div>
                            <p className="text-sm font-bold text-sky-900 dark:text-sky-200">Possibili Abbonamenti</p>
                            <p className="text-xs text-sky-800 dark:text-sky-300/80 mb-1">
                                Ho notato uscite ricorrenti per <b>{insights.potentialSubscriptions[0].desc}</b> ({formatCurrency(insights.potentialSubscriptions[0].amount)}).
                            </p>
                            <p className="text-[10px] font-bold uppercase text-sky-600 dark:text-sky-400 cursor-pointer hover:underline">
                                Verifica e aggiungi ai ricorrenti →
                            </p>
                        </div>
                    </div>
                )}

                {/* Budget Progress Bars */}
                {insights.budgetAlerts.length > 0 && (
                    <div className="pt-2 space-y-4">
                        <div className="flex justify-between items-center">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Stato Budget Mensile</label>
                        </div>
                        <div className="space-y-3">
                            {insights.budgetAlerts.slice(0, 3).map(b => (
                                <div key={b.cat} className="space-y-1.5">
                                    <div className="flex justify-between items-end text-xs">
                                        <span className="font-bold text-slate-600 dark:text-slate-300 capitalize">{b.cat === 'total' ? 'Totale Mese' : b.cat}</span>
                                        <span className="font-mono opacity-80">{formatCurrency(b.spent)} / {formatCurrency(b.limit)}</span>
                                    </div>
                                    <div className="h-2 w-full bg-slate-200 dark:bg-white/5 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full transition-all duration-1000 ${b.percent >= 100 ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]' : b.percent >= 80 ? 'bg-amber-400' : 'bg-emerald-500'}`}
                                            style={{ width: `${Math.min(b.percent, 100)}%` }}
                                        />
                                    </div>
                                    {b.percent >= 100 && (
                                        <p className="text-[10px] text-rose-500 font-bold animate-pulse">Budget superato!</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {/* Budget Management Button */}
                <div className="pt-2">
                    <button
                        onClick={onOpenBudgetSettings}
                        className="w-full py-3 text-sm font-bold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors flex items-center justify-center gap-2"
                    >
                        <ArrowsUpDownIcon className="w-4 h-4" />
                        Gestisci Budget
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AIInsightsWidget;
