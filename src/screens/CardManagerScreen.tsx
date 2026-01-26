import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon } from '../components/icons/XMarkIcon';
import { CheckIcon } from '../components/icons/CheckIcon';
import { Expense, Account, Budgets } from '../types';
import { CategorySummaryCard } from '../components/dashboard/CategorySummaryCard';
import { CategoryPieCard } from '../components/dashboard/CategoryPieCard';
import { BudgetTrendChart } from '../components/BudgetTrendChart';
import AIInsightsWidget from '../components/AIInsightsWidget';
import SavingsGoalsCard from '../components/SavingsGoalsCard';
import { calculateDashboardMetrics, calculateTotalBalance } from '../utils/dashboardMetrics';
import { DashboardCardId } from '../hooks/useDashboardConfig';

interface ReportItem {
    id: DashboardCardId;
    label: string;
    shortLabel: string;
    description: string;
}

// Flat list of all reports
const ALL_REPORTS: ReportItem[] = [
    { id: 'summary', label: 'Riepilogo Categorie', shortLabel: 'Riepilogo', description: 'Dettaglio testuale delle uscite per categoria' },
    { id: 'categoryPie', label: 'Distribuzione', shortLabel: 'Distribuzione', description: 'Grafico a torta interattivo delle spese' },
    { id: 'trend', label: 'Andamento', shortLabel: 'Andamento', description: 'Evoluzione del saldo e dei budget nel tempo' },
    { id: 'goals', label: 'Obiettivi', shortLabel: 'Obiettivi', description: 'Stato di avanzamento dei tuoi salvadanai' },
    { id: 'insights', label: 'Insights', shortLabel: 'Insights', description: 'Analisi automatica e suggerimenti AI' },
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
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedPieIndex, setSelectedPieIndex] = useState<number | null>(null);
    const tabsRef = useRef<HTMLDivElement>(null);
    const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

    // Swipe handling
    const touchStartX = useRef<number | null>(null);
    const touchEndX = useRef<number | null>(null);
    const touchStartY = useRef<number | null>(null);
    const touchEndY = useRef<number | null>(null);
    const scrollLock = useRef<'none' | 'vertical' | 'horizontal'>('none');
    const containerRef = useRef<HTMLDivElement>(null);
    const [swipeOffset, setSwipeOffset] = useState(0);
    const [isTransitioning, setIsTransitioning] = useState(false);

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

    const currentReport = ALL_REPORTS[currentIndex];
    const isPinned = items.includes(currentReport.id);

    // Scroll active tab into view
    useEffect(() => {
        const activeTab = tabRefs.current[currentIndex];
        if (activeTab && tabsRef.current) {
            activeTab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
    }, [currentIndex]);

    // Navigate to specific tab
    const goToTab = useCallback((index: number) => {
        if (!isTransitioning && index !== currentIndex) {
            setIsTransitioning(true);
            setCurrentIndex(index);
            setTimeout(() => setIsTransitioning(false), 300);
        }
    }, [currentIndex, isTransitioning]);

    // Touch handlers for swipe
    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;
        touchEndX.current = null;
        touchEndY.current = null;
        scrollLock.current = 'none';
        setSwipeOffset(0);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (touchStartX.current === null) return;

        const currentX = e.touches[0].clientX;
        const currentY = e.touches[0].clientY;
        const diffX = currentX - touchStartX.current;
        const diffY = currentY - (touchStartY.current || 0);

        // Lock direction if not already locked
        if (scrollLock.current === 'none') {
            if (Math.abs(diffX) > 10 && Math.abs(diffX) > Math.abs(diffY)) {
                scrollLock.current = 'horizontal';
            } else if (Math.abs(diffY) > 10) {
                scrollLock.current = 'vertical';
            }
        }

        if (scrollLock.current === 'vertical') {
            setSwipeOffset(0);
            return; // Allow native vertical scroll
        }

        if (scrollLock.current === 'horizontal') {
            // Prevent native vertical scroll when swiping horizontally
            if (e.cancelable) e.preventDefault();

            touchEndX.current = currentX;
            const diff = currentX - touchStartX.current;

            // Limit swipe offset at edges
            if ((currentIndex === 0 && diff > 0) || (currentIndex === ALL_REPORTS.length - 1 && diff < 0)) {
                setSwipeOffset(diff * 0.3);
            } else {
                setSwipeOffset(diff);
            }
        }
    };

    const handleTouchEnd = () => {
        if (touchStartX.current === null || touchEndX.current === null || scrollLock.current !== 'horizontal') {
            setSwipeOffset(0);
            scrollLock.current = 'none';
            return;
        }

        const diff = touchEndX.current - touchStartX.current;
        const threshold = 80;

        if (Math.abs(diff) > threshold) {
            if (diff < 0 && currentIndex < ALL_REPORTS.length - 1) {
                goToTab(currentIndex + 1);
            } else if (diff > 0 && currentIndex > 0) {
                goToTab(currentIndex - 1);
            }
        }

        touchStartX.current = null;
        touchEndX.current = null;
        scrollLock.current = 'none';
        setSwipeOffset(0);
    };

    // Reset index when modal opens
    useEffect(() => {
        if (isOpen) {
            setCurrentIndex(0);
            setSwipeOffset(0);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    // Render the content for the current report
    const renderCardContent = (report: ReportItem) => {
        switch (report.id) {
            case 'summary':
                return (
                    <CategorySummaryCard
                        categoryData={metrics.categoryData}
                        totalExpenses={metrics.totalExpenses}
                        dateRangeLabel={metrics.dateRangeLabel}
                        noBorder={true}
                    />
                );
            case 'categoryPie':
                return (
                    <CategoryPieCard
                        categoryData={metrics.categoryData}
                        totalExpenses={metrics.totalExpenses}
                        dateRangeLabel={metrics.dateRangeLabel}
                        selectedIndex={selectedPieIndex}
                        onSelectedIndexChange={setSelectedPieIndex}
                        noBorder={true}
                    />
                );
            case 'trend':
                return (
                    <BudgetTrendChart
                        expenses={expenses}
                        accounts={accounts}
                        periodType="month"
                        periodDate={new Date()}
                        activeViewIndex={1}
                        quickFilter="30d"
                        customRange={{ start: null, end: null }}
                        noBorder={true}
                    />
                );
            case 'goals':
                return (
                    <SavingsGoalsCard totalBalance={totalBalance} noBorder={true} />
                );
            case 'insights':
                return (
                    <AIInsightsWidget
                        expenses={expenses}
                        budgets={budgets}
                        onOpenBudgetSettings={onOpenBudgetSettings}
                        noBorder={true}
                    />
                );
            default:
                return null;
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[8500] flex flex-col bg-slate-50 dark:bg-midnight transition-colors">
            {/* Header */}
            <div
                className="bg-indigo-600 dark:bg-midnight-card px-2"
                style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
            >
                {/* Title Row */}
                <div className="flex items-center justify-between px-2 py-3">
                    <button
                        onClick={onClose}
                        className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors"
                    >
                        <XMarkIcon className="w-6 h-6 text-white" />
                    </button>
                    <h1 className="text-xl font-bold text-white">Centro Report</h1>
                    <div className="w-10" /> {/* Spacer for centering */}
                </div>

                {/* Scrollable Tabs */}
                <div
                    ref={tabsRef}
                    className="flex overflow-x-auto no-scrollbar"
                >
                    {ALL_REPORTS.map((report, index) => (
                        <button
                            key={report.id}
                            ref={(el) => { tabRefs.current[index] = el; }}
                            onClick={() => goToTab(index)}
                            className={`flex-shrink-0 px-5 py-3 text-sm font-semibold whitespace-nowrap transition-all relative ${index === currentIndex
                                ? 'text-white'
                                : 'text-white/60 hover:text-white/80'
                                }`}
                        >
                            {report.shortLabel}
                            {index === currentIndex && (
                                <div className="absolute bottom-0 left-2 right-2 h-[3px] bg-white rounded-full" />
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Container */}
            <div
                ref={containerRef}
                className="flex-1 overflow-hidden relative"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {/* Slides */}
                <div
                    className="absolute inset-0 flex"
                    style={{
                        transform: `translateX(calc(-${currentIndex * 100}% + ${swipeOffset}px))`,
                        transition: swipeOffset !== 0 ? 'none' : 'transform 0.3s ease-out'
                    }}
                >
                    {ALL_REPORTS.map((report) => (
                        <div
                            key={report.id}
                            className="min-w-full h-full overflow-y-auto"
                        >
                            {/* Card Content - Full Width, No Borders */}
                            <div className="bg-transparent min-h-full">
                                {/* Card Header */}
                                <div className="px-5 py-6 flex justify-between items-start">
                                    <div className="flex-1 pr-4">
                                        <h2 className="text-2xl font-black text-slate-800 dark:text-white leading-tight">
                                            {report.label}
                                        </h2>
                                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
                                            {report.description}
                                        </p>
                                    </div>

                                    {/* Action Toggle (Icon version) */}
                                    <button
                                        onClick={() => onToggleCard(report.id)}
                                        className={`p-3 rounded-2xl transition-all shadow-sm ${items.includes(report.id)
                                            ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400'
                                            : 'bg-indigo-100 dark:bg-emerald-900/30 text-indigo-600 dark:text-emerald-400'
                                            }`}
                                        title={items.includes(report.id) ? "Rimuovi dalla Home" : "Aggiungi alla Home"}
                                    >
                                        {items.includes(report.id) ? (
                                            <XMarkIcon className="w-6 h-6" strokeWidth={2.5} />
                                        ) : (
                                            <CheckIcon className="w-6 h-6" strokeWidth={2.5} />
                                        )}
                                    </button>
                                </div>

                                {/* Card Body - No padding-x so content is full width if desired */}
                                <div className="pb-10">
                                    {renderCardContent(report)}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Bottom Info Row (Optional, instead of big button) */}
            <div
                className="bg-white/50 dark:bg-midnight/50 backdrop-blur-sm px-6 py-4 text-center"
                style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.5rem)' }}
            >
                <div className="h-1.5 w-12 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-2 opacity-50" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                    Scorri per altri report • Usa l'icona per gestire la Home
                </p>
            </div>
        </div>,
        document.body
    );
};

export default CardManagerScreen;
