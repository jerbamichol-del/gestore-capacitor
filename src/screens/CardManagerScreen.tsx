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
import { HistoryFilterCard, DateFilter, PeriodType } from '../components/HistoryFilterCard';
import { parseLocalYYYYMMDD } from '../utils/date';



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

    const [activeFilterMode, setActiveFilterMode] = useState<'quick' | 'period' | 'custom'>('quick');
    const [dateFilter, setDateFilter] = useState<DateFilter>('30d');
    const [customRange, setCustomRange] = useState<{ start: string | null; end: string | null; }>({ start: null, end: null });
    const [periodType, setPeriodType] = useState<PeriodType>('month');
    const [periodDate, setPeriodDate] = useState<Date>(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; });
    const [filterAccount, setFilterAccount] = useState<string | null>(null);
    const [filterCategories, setFilterCategories] = useState<Set<string>>(new Set());
    const [filterDescription, setFilterDescription] = useState('');
    const [filterAmountRange, setFilterAmountRange] = useState<{ min: string; max: string }>({ min: '', max: '' });
    const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
    const [isDateModalOpen, setIsDateModalOpen] = useState(false);

    // Initial default: Standard to 'Period: Month' to match original behavior? 
    // The user wants it identical to "Entrate". Entrate defaults to '30d' quick usually, or 'All'. 
    // Let's default to Quick 30d which is very standard for reports.
    // Actually, originally CardManager used "current month".
    // I will initialize logic to mimic current month via Period Filter if I want to be 100% faithful, 
    // but '30d' is often better. Let's stick to 30d as default or Period Month current.
    // Let's use Period Month Current to be safe.
    useEffect(() => {
        setActiveFilterMode('period');
        setPeriodType('month');
        setPeriodDate(new Date());
    }, [isOpen]);

    const handleToggleCategoryFilter = (key: string) => { setFilterCategories(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; }); };
    const handleClearCategoryFilters = () => setFilterCategories(new Set());

    // 1. Base Filtered Expenses (Account, Category, Description, Amount) - NO DATE YET
    const baseFilteredExpenses = useMemo(() => {
        let result = expenses;

        if (filterAccount) result = result.filter(e => e.accountId === filterAccount);
        if (filterCategories.size > 0) result = result.filter(e => { const whole = e.category; const sub = `${e.category}:${e.subcategory || ''}`; return filterCategories.has(whole) || (e.subcategory && filterCategories.has(sub)); });
        if (filterDescription.trim()) { const q = filterDescription.toLowerCase(); result = result.filter(e => (e.description || '').toLowerCase().includes(q)); }
        if (filterAmountRange.min) { const min = parseFloat(filterAmountRange.min); if (!isNaN(min)) result = result.filter(e => Math.abs(e.amount) >= min); }
        if (filterAmountRange.max) { const max = parseFloat(filterAmountRange.max); if (!isNaN(max)) result = result.filter(e => Math.abs(e.amount) <= max); }

        // Ensure we typically show Expenses in Report Center, unless user wants to manage that?
        // CardManager originally didn't filter type in calculateDashboardMetrics, but calculateDashboardMetrics might handle it.
        // Let's check calculateDashboardMetrics usage... it usually filters 'expense' type.
        // So we just pass potentially mixed data to metrics, and metrics util filters expense?
        // Yes, likely.

        return result;
    }, [expenses, filterAccount, filterCategories, filterDescription, filterAmountRange]);

    // 2. Date Range Calculation
    const { startDate, endDate } = useMemo(() => {
        let start = new Date();
        let end = new Date();
        end.setHours(23, 59, 59, 999);
        start.setHours(0, 0, 0, 0);

        if (activeFilterMode === 'quick') {
            switch (dateFilter) {
                case '7d': start.setDate(start.getDate() - 6); break;
                case '30d': start.setDate(start.getDate() - 29); break;
                case '6m': start.setMonth(start.getMonth() - 6); break;
                case '1y': start.setFullYear(start.getFullYear() - 1); break;
                default: start = new Date(0); break; // All
            }
        } else if (activeFilterMode === 'period') {
            start = new Date(periodDate);
            end = new Date(periodDate);
            if (periodType === 'day') {
                // Single day
            } else if (periodType === 'week') {
                const day = start.getDay();
                const diff = start.getDate() - day + (day === 0 ? -6 : 1);
                start.setDate(diff);
                end = new Date(start);
                end.setDate(start.getDate() + 6);
            } else if (periodType === 'month') {
                start.setDate(1);
                end.setMonth(end.getMonth() + 1);
                end.setDate(0);
            } else { // year
                start.setMonth(0, 1);
                end.setFullYear(end.getFullYear() + 1);
                end.setMonth(0, 0);
            }
        } else if (activeFilterMode === 'custom' && customRange.start && customRange.end) {
            start = parseLocalYYYYMMDD(customRange.start);
            end = parseLocalYYYYMMDD(customRange.end);
        }

        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);

        return { startDate: start, endDate: end };
    }, [activeFilterMode, dateFilter, periodType, periodDate, customRange]);

    const metrics = useMemo(() => {
        // use baseFilteredExpenses and apply date range for metrics
        // calculateDashboardMetrics expects expenses list and filters them by date range internally? 
        // No, it expects 'expenses', 'start', 'end'. It filters within range.
        return calculateDashboardMetrics(baseFilteredExpenses, startDate, endDate);
    }, [baseFilteredExpenses, startDate, endDate]);

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
                return (
                    <BudgetTrendChart
                        expenses={baseFilteredExpenses}
                        accounts={accounts}
                        periodType={periodType}
                        periodDate={periodDate}
                        activeViewIndex={activeFilterMode === 'quick' ? 0 : activeFilterMode === 'period' ? 1 : 2}
                        quickFilter={dateFilter}
                        customRange={customRange}
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
                className="flex-1 overflow-hidden relative pb-32" // Added padding bottom for filters
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

                                {/* Card Body - Added padding-x to prevent overflow/too-wide feeling */}
                                <div className="pb-10 px-4">
                                    {renderCardContent(report)}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>


            <HistoryFilterCard
                zIndex={9000}
                isActive={true}
                onSelectQuickFilter={(value) => { setDateFilter(value); setActiveFilterMode('quick'); }}
                currentQuickFilter={dateFilter}
                onCustomRangeChange={(range) => { setCustomRange(range); setActiveFilterMode('custom'); }}
                currentCustomRange={customRange}
                isCustomRangeActive={activeFilterMode === 'custom'}
                onDateModalStateChange={setIsDateModalOpen}
                periodType={periodType}
                periodDate={periodDate}
                onSelectPeriodType={(type) => { setPeriodType(type); setPeriodDate(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }); setActiveFilterMode('period'); }}
                onSetPeriodDate={setPeriodDate}
                isPeriodFilterActive={activeFilterMode === 'period'}
                onActivatePeriodFilter={() => setActiveFilterMode('period')}
                onOpenStateChange={setIsFilterPanelOpen}
                accounts={accounts}
                selectedAccountId={filterAccount}
                onSelectAccount={setFilterAccount}
                selectedCategoryFilters={filterCategories}
                onToggleCategoryFilter={handleToggleCategoryFilter}
                onClearCategoryFilters={handleClearCategoryFilters}
                descriptionQuery={filterDescription}
                onDescriptionChange={setFilterDescription}
                amountRange={filterAmountRange}
                onAmountRangeChange={setFilterAmountRange}
            />
        </div >,
        document.body
    );
};

export default CardManagerScreen;
