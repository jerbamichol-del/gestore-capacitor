import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon } from '../components/icons/XMarkIcon';
import { CheckIcon } from '../components/icons/CheckIcon';
import { ChevronRightIcon } from '../components/icons/ChevronRightIcon';
import { ArrowLeftIcon } from '../components/icons/ArrowLeftIcon';
import { Expense, Account, Budgets } from '../types';
import { CategorySummaryCard } from '../components/dashboard/CategorySummaryCard';
import { CategoryPieCard } from '../components/dashboard/CategoryPieCard';
import { BudgetTrendChart } from '../components/BudgetTrendChart';
import AIInsightsWidget from '../components/AIInsightsWidget';
import SavingsGoalsCard from '../components/SavingsGoalsCard';
import { calculateDashboardMetrics, calculateTotalBalance } from '../utils/dashboardMetrics';
import { DashboardCardId } from '../hooks/useDashboardConfig';

interface ReportGroup {
    title: string;
    reports: {
        id: DashboardCardId;
        label: string;
        description: string;
        emoji: string;
    }[];
}

const REPORT_GROUPS: ReportGroup[] = [
    {
        title: 'Analisi Spese',
        reports: [
            { id: 'summary', label: 'Riepilogo Categorie', description: 'Dettaglio testuale delle uscite per categoria', emoji: '📊' },
            { id: 'categoryPie', label: 'Distribuzione Categorie', description: 'Grafico a torta interattivo delle spese', emoji: 'Pie' },
        ]
    },
    {
        title: 'Andamento & Patrimonio',
        reports: [
            { id: 'trend', label: 'Andamento Patrimoniale', description: 'Evoluzione del saldo e dei budget nel tempo', emoji: '📈' },
            { id: 'goals', label: 'Obiettivi di Risparmio', description: 'Stato di avanzamento dei tuoi salvadanai', emoji: '🎯' },
        ]
    },
    {
        title: 'Intelligenza & Budget',
        reports: [
            { id: 'insights', label: 'Budget & Insights', description: 'Analisi automatica e suggerimenti AI', emoji: '💡' },
        ]
    }
];

interface CardManagerScreenProps {
    isOpen: boolean;
    onClose: () => void;
    items: string[];
    onToggleCard: (id: string) => void;
    expenses: Expense[];
    accounts: Account[];
    budgets: Budgets;
    onOpenBudgetSettings?: () => void;
}

const CardManagerScreen: React.FC<CardManagerScreenProps> = ({
    isOpen,
    onClose,
    items,
    onToggleCard,
    expenses,
    accounts,
    budgets,
    onOpenBudgetSettings
}) => {
    const [selectedReportId, setSelectedReportId] = useState<DashboardCardId | null>(null);
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

    // Calculate generic metrics for the "current month" by default
    const metrics = useMemo(() => {
        const start = new Date();
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        const end = new Date();
        end.setHours(23, 59, 59, 999);
        return calculateDashboardMetrics(expenses, start, end);
    }, [expenses]);

    const totalBalance = useMemo(() => calculateTotalBalance(accounts, expenses), [accounts, expenses]);

    if (!isOpen) return null;

    const renderDetailView = () => {
        if (!selectedReportId) return null;

        let content = null;
        const isPinned = items.includes(selectedReportId);

        switch (selectedReportId) {
            case 'summary':
                content = (
                    <CategorySummaryCard
                        categoryData={metrics.categoryData}
                        totalExpenses={metrics.totalExpenses}
                        dateRangeLabel={metrics.dateRangeLabel}
                    />
                );
                break;
            case 'categoryPie':
                content = (
                    <CategoryPieCard
                        categoryData={metrics.categoryData}
                        totalExpenses={metrics.totalExpenses}
                        dateRangeLabel={metrics.dateRangeLabel}
                        selectedIndex={selectedIndex}
                        onSelectedIndexChange={setSelectedIndex}
                    />
                );
                break;
            case 'trend':
                content = (
                    <BudgetTrendChart
                        expenses={expenses}
                        accounts={accounts}
                        periodType="month"
                        periodDate={new Date()}
                        activeViewIndex={1}
                        quickFilter="30d"
                        customRange={{ start: null, end: null }}
                    />
                );
                break;
            case 'goals':
                content = (
                    <SavingsGoalsCard totalBalance={totalBalance} />
                );
                break;
            case 'insights':
                content = (
                    <AIInsightsWidget
                        expenses={expenses}
                        budgets={budgets}
                        onOpenBudgetSettings={onOpenBudgetSettings}
                    />
                );
                break;
        }

        return (
            <div className="absolute inset-0 bg-sunset-cream dark:bg-midnight z-[8600] flex flex-col animate-slide-in-right">
                {/* Detail Header */}
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-midnight" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}>
                    <div className="flex items-center gap-3">
                        <button onClick={() => setSelectedReportId(null)} className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
                            <ArrowLeftIcon className="w-6 h-6 text-slate-500" />
                        </button>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white">
                            {REPORT_GROUPS.flatMap(g => g.reports).find(r => r.id === selectedReportId)?.label}
                        </h2>
                    </div>

                    {/* Pin Toggle */}
                    <button
                        onClick={() => onToggleCard(selectedReportId)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all ${isPinned
                            ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200'
                            : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-200'
                            }`}
                    >
                        {isPinned ? <XMarkIcon className="w-4 h-4" /> : <CheckIcon className="w-4 h-4" />}
                        {isPinned ? 'Rimuovi dalla Home' : 'Aggiungi alla Home'}
                    </button>
                </div>

                {/* Detail Content */}
                <div className="flex-1 overflow-y-auto p-4 md:p-8">
                    <div className="max-w-2xl mx-auto">
                        <div className="midnight-card p-6 rounded-3xl shadow-xl bg-white dark:bg-midnight-card min-h-[400px]">
                            {content}
                        </div>

                        <div className="mt-8 text-center px-6">
                            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed italic">
                                Questa card è interattiva e visualizza i dati in tempo reale. Puoi decidere se fissarla nella tua pagina principale per averla sempre sott'occhio.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return createPortal(
        <div className="fixed inset-0 z-[8500] flex flex-col bg-slate-50 dark:bg-midnight transition-colors">
            {/* Header */}
            <div
                className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-midnight shadow-sm"
                style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
            >
                <div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white leading-tight">Centro Report</h2>
                    <p className="text-xs text-slate-500 font-medium">{items.length} card attive nella home</p>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                    <XMarkIcon className="w-7 h-7 text-slate-500" />
                </button>
            </div>

            {/* List Container */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-12">
                <div className="max-w-2xl mx-auto space-y-8">
                    {REPORT_GROUPS.map((group, gIdx) => (
                        <div key={gIdx} className="space-y-3">
                            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 pl-2">
                                {group.title}
                            </h3>
                            <div className="grid grid-cols-1 gap-3">
                                {group.reports.map((report) => {
                                    const isPinned = items.includes(report.id);
                                    return (
                                        <div
                                            key={report.id}
                                            onClick={() => setSelectedReportId(report.id)}
                                            className="midnight-card p-4 rounded-2xl flex items-center justify-between cursor-pointer group active:scale-[0.98] transition-all bg-white dark:bg-midnight-card hover:border-indigo-500 dark:hover:border-electric-violet"
                                        >
                                            <div className="flex items-center gap-4 flex-1">
                                                <div className="w-12 h-12 flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-xl text-2xl group-hover:scale-110 transition-transform">
                                                    {report.emoji === 'Pie' ? '🥧' : report.emoji}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-bold text-slate-800 dark:text-white truncate">
                                                        {report.label}
                                                    </p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                                                        {report.description}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                {isPinned && (
                                                    <span className="bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-[10px] font-black px-2 py-1 rounded uppercase tracking-tighter shadow-sm border border-indigo-200 dark:border-indigo-500/20">
                                                        🏠 Home
                                                    </span>
                                                )}
                                                <ChevronRightIcon className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}

                    {/* Quick Config Hint */}
                    <div className="p-6 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 text-center">
                        <p className="text-sm text-slate-400 dark:text-slate-500 italic">
                            Tocca una voce per visualizzare l'anteprima dinamica e personalizzare la tua dashboard.
                        </p>
                    </div>
                </div>
            </div>

            {/* Detail View Overlay */}
            {renderDetailView()}

            <style>{`
                @keyframes slide-in-right {
                    from { transform: translateX(100%); }
                    to { transform: translateX(0); }
                }
                .animate-slide-in-right {
                    animation: slide-in-right 0.25s cubic-bezier(0.4, 0, 0.2, 1) forwards;
                }
            `}</style>
        </div>,
        document.body
    );
};

export default CardManagerScreen;
