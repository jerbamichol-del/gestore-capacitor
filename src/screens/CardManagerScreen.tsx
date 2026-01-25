import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon } from '../components/icons/XMarkIcon';
import { CheckIcon } from '../components/icons/CheckIcon';
import { ChevronLeftIcon } from '../components/icons/ChevronLeftIcon';
import { ChevronRightIcon } from '../components/icons/ChevronRightIcon';
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
    description: string;
    emoji: string;
}

// Flat list of all reports for carousel navigation
const ALL_REPORTS: ReportItem[] = [
    { id: 'summary', label: 'Riepilogo Categorie', description: 'Dettaglio testuale delle uscite per categoria', emoji: '📊' },
    { id: 'categoryPie', label: 'Distribuzione Categorie', description: 'Grafico a torta interattivo delle spese', emoji: '🥧' },
    { id: 'trend', label: 'Andamento Patrimoniale', description: 'Evoluzione del saldo e dei budget nel tempo', emoji: '📈' },
    { id: 'goals', label: 'Obiettivi di Risparmio', description: 'Stato di avanzamento dei tuoi salvadanai', emoji: '🎯' },
    { id: 'insights', label: 'Budget & Insights', description: 'Analisi automatica e suggerimenti AI', emoji: '💡' },
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

    // Swipe handling
    const touchStartX = useRef<number | null>(null);
    const touchEndX = useRef<number | null>(null);
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

    // Navigation functions
    const goToNext = useCallback(() => {
        if (currentIndex < ALL_REPORTS.length - 1 && !isTransitioning) {
            setIsTransitioning(true);
            setCurrentIndex(prev => prev + 1);
            setTimeout(() => setIsTransitioning(false), 300);
        }
    }, [currentIndex, isTransitioning]);

    const goToPrev = useCallback(() => {
        if (currentIndex > 0 && !isTransitioning) {
            setIsTransitioning(true);
            setCurrentIndex(prev => prev - 1);
            setTimeout(() => setIsTransitioning(false), 300);
        }
    }, [currentIndex, isTransitioning]);

    // Touch handlers for swipe
    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartX.current = e.touches[0].clientX;
        touchEndX.current = null;
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (touchStartX.current === null) return;
        touchEndX.current = e.touches[0].clientX;
        const diff = touchEndX.current - touchStartX.current;

        // Limit swipe offset at edges
        if ((currentIndex === 0 && diff > 0) || (currentIndex === ALL_REPORTS.length - 1 && diff < 0)) {
            setSwipeOffset(diff * 0.3); // Resistance at edges
        } else {
            setSwipeOffset(diff);
        }
    };

    const handleTouchEnd = () => {
        if (touchStartX.current === null || touchEndX.current === null) {
            setSwipeOffset(0);
            return;
        }

        const diff = touchEndX.current - touchStartX.current;
        const threshold = 80;

        if (Math.abs(diff) > threshold) {
            if (diff < 0) {
                goToNext();
            } else {
                goToPrev();
            }
        }

        touchStartX.current = null;
        touchEndX.current = null;
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
                    />
                );
            case 'goals':
                return (
                    <SavingsGoalsCard totalBalance={totalBalance} />
                );
            case 'insights':
                return (
                    <AIInsightsWidget
                        expenses={expenses}
                        budgets={budgets}
                        onOpenBudgetSettings={onOpenBudgetSettings}
                    />
                );
            default:
                return null;
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[8500] flex flex-col bg-slate-50 dark:bg-midnight transition-colors">
            {/* Header with Title */}
            <div
                className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-midnight shadow-sm"
                style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
            >
                <div className="flex-1">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white leading-tight">Centro Report</h2>
                    <p className="text-xs text-slate-500 font-medium">{currentIndex + 1} di {ALL_REPORTS.length}</p>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                    <XMarkIcon className="w-7 h-7 text-slate-500" />
                </button>
            </div>

            {/* Card Title Bar */}
            <div className="px-4 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 dark:from-electric-violet dark:to-indigo-600">
                <div className="flex items-center gap-3">
                    <span className="text-3xl">{currentReport.emoji}</span>
                    <div>
                        <h3 className="text-lg font-bold text-white">{currentReport.label}</h3>
                        <p className="text-xs text-white/70">{currentReport.description}</p>
                    </div>
                </div>
            </div>

            {/* Carousel Container */}
            <div
                ref={containerRef}
                className="flex-1 overflow-hidden relative"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {/* Slides */}
                <div
                    className="absolute inset-0 flex transition-transform duration-300 ease-out"
                    style={{
                        transform: `translateX(calc(-${currentIndex * 100}% + ${swipeOffset}px))`,
                        transition: swipeOffset !== 0 ? 'none' : 'transform 0.3s ease-out'
                    }}
                >
                    {ALL_REPORTS.map((report, index) => (
                        <div
                            key={report.id}
                            className="min-w-full h-full overflow-y-auto p-4 md:p-6"
                        >
                            <div className="max-w-2xl mx-auto h-full">
                                <div className="midnight-card p-4 md:p-6 rounded-3xl shadow-xl bg-white dark:bg-midnight-card min-h-[60vh]">
                                    {renderCardContent(report)}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Navigation Arrows (Desktop) */}
                {currentIndex > 0 && (
                    <button
                        onClick={goToPrev}
                        className="absolute left-2 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/90 dark:bg-midnight-card/90 shadow-lg flex items-center justify-center hover:scale-110 transition-transform z-10 hidden md:flex"
                    >
                        <ChevronLeftIcon className="w-6 h-6 text-slate-600 dark:text-slate-300" />
                    </button>
                )}
                {currentIndex < ALL_REPORTS.length - 1 && (
                    <button
                        onClick={goToNext}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/90 dark:bg-midnight-card/90 shadow-lg flex items-center justify-center hover:scale-110 transition-transform z-10 hidden md:flex"
                    >
                        <ChevronRightIcon className="w-6 h-6 text-slate-600 dark:text-slate-300" />
                    </button>
                )}
            </div>

            {/* Bottom Controls */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-midnight">
                {/* Page Indicators */}
                <div className="flex justify-center gap-2 mb-4">
                    {ALL_REPORTS.map((_, index) => (
                        <button
                            key={index}
                            onClick={() => {
                                if (!isTransitioning) {
                                    setIsTransitioning(true);
                                    setCurrentIndex(index);
                                    setTimeout(() => setIsTransitioning(false), 300);
                                }
                            }}
                            className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${index === currentIndex
                                    ? 'bg-indigo-500 dark:bg-electric-violet w-8'
                                    : 'bg-slate-300 dark:bg-slate-600 hover:bg-slate-400'
                                }`}
                        />
                    ))}
                </div>

                {/* Pin/Unpin Button */}
                <button
                    onClick={() => onToggleCard(currentReport.id)}
                    className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-base font-bold transition-all ${isPinned
                        ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200'
                        : 'bg-indigo-500 dark:bg-electric-violet text-white hover:bg-indigo-600 dark:hover:bg-indigo-500'
                        }`}
                >
                    {isPinned ? <XMarkIcon className="w-5 h-5" /> : <CheckIcon className="w-5 h-5" />}
                    {isPinned ? 'Rimuovi dalla Home' : 'Aggiungi alla Home'}
                </button>

                {/* Swipe Hint */}
                <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-3">
                    ← Scorri per vedere altre card →
                </p>
            </div>
        </div>,
        document.body
    );
};

export default CardManagerScreen;
