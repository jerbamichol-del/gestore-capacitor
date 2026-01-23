import React, { useMemo, useState, useRef, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Sector } from 'recharts';
import { Expense, Account } from '../types';
import { formatCurrency } from './icons/formatters';
import { getCategoryStyle } from '../utils/categoryStyles';
import { ArrowsUpDownIcon } from './icons/ArrowsUpDownIcon';
import { ArrowDownTrayIcon } from './icons/ArrowDownTrayIcon';
import { ArrowUpTrayIcon } from './icons/ArrowUpTrayIcon';
import { ArrowPathIcon } from './icons/ArrowPathIcon';
import { XMarkIcon } from './icons/XMarkIcon';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon';
import { ChevronRightIcon } from './icons/ChevronRightIcon';
import { ProgrammateDetailedIcon } from './icons/ProgrammateDetailedIcon';
import { ExpensesDetailedIcon } from './icons/ExpensesDetailedIcon';
import { IncomeDetailedIcon } from './icons/IncomeDetailedIcon';
import { AccountsDetailedIcon } from './icons/AccountsDetailedIcon';
import { exportExpenses } from '../utils/fileHelper';
import { useTapBridge } from '../hooks/useTapBridge';
import { parseLocalYYYYMMDD, toYYYYMMDD } from '../utils/date';
import {
    QuickFilterControl,
    PeriodNavigator,
    CustomDateRangeInputs,
    DateFilter,
    PeriodType
} from './HistoryFilterCard';
import { useSwipe } from '../hooks/useSwipe';
import { BudgetTrendChart } from './BudgetTrendChart';
import { EyeIcon } from './icons/EyeIcon';
import { EyeSlashIcon } from './icons/EyeSlashIcon';
import { useTheme } from '../hooks/useTheme';
import { DndContext, closestCenter, KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors, DragEndEvent, DragStartEvent, DragOverlay } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const categoryHexColors: Record<string, string> = {
    'Trasporti': '#64748b',
    'Casa': '#1e3a8a',
    'Shopping': '#9333ea',
    'Alimentari': '#84cc16',
    'Salute': '#06b6d4',
    'Altro': '#78350f',
    'Beneficienza': '#dc2626',
    'Lavoro': '#2563eb',
    'Istruzione': '#16a34a',
    'Tempo Libero': '#eab308',
};
const DEFAULT_COLOR = '#78350f';

const renderActiveShape = (props: any) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent } = props;

    if (!payload) return null;

    const isDark = document.documentElement.classList.contains('dark');
    const shadowColor = fill;

    return (
        <g>
            <text x={cx} y={cy - 12} textAnchor="middle" className="text-base font-bold" style={{ fill: 'var(--pie-text-primary, #1e293b)' }}>
                {payload.name}
            </text>
            <text x={cx} y={cy + 12} textAnchor="middle" fill={fill} className="text-lg font-extrabold" style={isDark ? { filter: `drop-shadow(0 0 4px ${shadowColor})` } : {}}>
                {formatCurrency(payload.value)}
            </text>
            <text x={cx} y={cy + 32} textAnchor="middle" className="text-sm font-bold" style={{ fill: 'var(--pie-text-secondary, #334155)' }}>
                {`(${(percent * 100).toFixed(2)}%)`}
            </text>

            <Sector
                cx={cx}
                cy={cy}
                innerRadius={innerRadius}
                outerRadius={outerRadius + 6}
                startAngle={startAngle}
                endAngle={endAngle}
                fill={fill}
                fillOpacity={isDark ? 0.15 : 1}
                stroke={isDark ? fill : "none"}
                strokeWidth={isDark ? 3 : 0}
                style={isDark ? { filter: `drop-shadow(0 0 5px ${shadowColor})` } : {}}
            />
        </g>
    );
};

interface DashboardProps {
    accounts: Account[];
    expenses: Expense[];
    recurringExpenses: Expense[];
    onNavigateToRecurring: () => void;
    onNavigateToHistory: () => void;
    onNavigateToIncomes?: () => void;
    onNavigateToAccounts?: () => void;
    onImportFile: (file: File) => void;
    onReceiveSharedFile?: (file: File) => void | Promise<void>;
    onSync: () => Promise<void> | void;
    onOpenBankSyncSettings: () => void;
    isBalanceVisible: boolean;
    onToggleBalanceVisibility: () => void;
    showToast: (msg: { message: string; type: 'success' | 'info' | 'error' }) => void;
    isDraggingDisabled?: boolean;
}

const calculateNextDueDate = (template: Expense, fromDate: Date): Date | null => {
    if (template.frequency !== 'recurring' || !template.recurrence) return null;
    const interval = template.recurrenceInterval || 1;
    const nextDate = new Date(fromDate);

    switch (template.recurrence) {
        case 'daily':
            nextDate.setDate(nextDate.getDate() + interval);
            break;
        case 'weekly':
            nextDate.setDate(nextDate.getDate() + 7 * interval);
            break;
        case 'monthly':
            nextDate.setMonth(nextDate.getMonth() + interval);
            break;
        case 'yearly':
            nextDate.setFullYear(nextDate.getFullYear() + interval);
            break;
        default:
            return null;
    }
    return nextDate;
};

// --- Sortable Item Component ---
const SortableItem = ({ id, children }: { id: string, children: React.ReactNode }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

    const style: React.CSSProperties = {
        transform: CSS.Translate.toString(transform),
        transition,
        zIndex: isDragging ? 100 : 'auto',
        opacity: isDragging ? 0 : 1, // Nasconde l'originale, DragOverlay mostra la copia
        position: 'relative' as const,
        touchAction: 'manipulation', // Migliora la gestione touch
        userSelect: 'none', // Previene selezione testo durante drag
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none', // Previene menu contestuale iOS
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`group relative ${isDragging ? 'z-50' : ''}`}
            {...attributes}
            {...listeners}
            onContextMenu={(e) => e.preventDefault()} // Previene menu contestuale (long press)
        >
            {children}
        </div>
    );
};

const Dashboard: React.FC<DashboardProps> = ({
    accounts,
    expenses,
    recurringExpenses,
    onNavigateToRecurring,
    onNavigateToHistory,
    onNavigateToIncomes,
    onNavigateToAccounts,
    onImportFile,
    onSync,
    onOpenBankSyncSettings,
    isBalanceVisible,
    onToggleBalanceVisibility,
    showToast,
    isDraggingDisabled = false
}) => {


    // --- State & DnD Logic ---
    const [items, setItems] = useState<string[]>(() => {
        const saved = localStorage.getItem('dashboard_order_safe');
        return saved ? JSON.parse(saved) : ['summary', 'categoryPie', 'trend'];
    });

    const [activeId, setActiveId] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(TouchSensor, {
            activationConstraint: {
                delay: 700, // Richiede 0.7 secondi di pressione per iniziare il drag
                tolerance: 5, // Tolleranza di movimento durante il delay
            },
        }),
        useSensor(MouseSensor, {
            activationConstraint: {
                distance: 10, // Richiede movimento di 10px per drag col mouse
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (active.id !== over?.id) {
            setItems((items) => {
                const oldIndex = items.indexOf(active.id as string);
                const newIndex = items.indexOf(over?.id as string);
                const newOrder = arrayMove(items, oldIndex, newIndex);
                localStorage.setItem('dashboard_order_safe', JSON.stringify(newOrder));
                return newOrder;
            });
        }
    };

    const { isDark } = useTheme();
    const tapBridgeHandlers = useTapBridge();
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const [activeViewIndex, setActiveViewIndex] = useState(1);
    const [quickFilter, setQuickFilter] = useState<DateFilter>('30d');
    const [periodType, setPeriodType] = useState<PeriodType>('month');
    const [periodDate, setPeriodDate] = useState<Date>(new Date());
    const [customRange, setCustomRange] = useState<{ start: string | null; end: string | null }>({ start: null, end: null });
    const [isPeriodMenuOpen, setIsPeriodMenuOpen] = useState(false);
    const [isSwipeAnimating, setIsSwipeAnimating] = useState(false);
    const [isImportExportMenuOpen, setIsImportExportMenuOpen] = useState(false);
    const [showExportOptions, setShowExportOptions] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    const activeIndex = selectedIndex;
    const fileInputRef = useRef<HTMLInputElement>(null);
    const headerContainerRef = useRef<HTMLDivElement>(null);

    const handleLegendItemClick = (index: number, event: React.MouseEvent) => {
        event.stopPropagation();
        setSelectedIndex(current => (current === index ? null : index));
    };

    const handleChartBackgroundClick = () => setSelectedIndex(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            onImportFile(e.target.files[0]);
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleNavigateToRecurring = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.currentTarget.blur();
        onNavigateToRecurring();
    };

    const handleNavigateToHistory = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.currentTarget.blur();
        onNavigateToHistory();
    };

    const handleNavigateToIncomes = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.currentTarget.blur();
        onNavigateToIncomes?.();
    };

    const handleNavigateToAccounts = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.currentTarget.blur();
        onNavigateToAccounts?.();
    };

    useEffect(() => {
        const handlePopState = (event: PopStateEvent) => {
            const modal = event.state?.modal;
            if (modal === 'import_export_main') {
                setIsImportExportMenuOpen(true);
                setShowExportOptions(false);
            } else if (modal === 'import_export_format') {
                setIsImportExportMenuOpen(true);
                setShowExportOptions(true);
            } else {
                setIsImportExportMenuOpen(false);
                setShowExportOptions(false);
            }
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    const openImportExportMenu = () => {
        window.history.pushState({ modal: 'import_export_main' }, '');
        setIsImportExportMenuOpen(true);
        setShowExportOptions(false);
    };

    const openExportOptions = () => {
        window.history.pushState({ modal: 'import_export_format' }, '');
        setShowExportOptions(true);
    };

    const handleBackNavigation = () => window.history.back();

    const handleCloseNavigation = () => {
        if (showExportOptions) window.history.go(-2);
        else window.history.back();
    };

    const handleImportClick = () => {
        window.history.back();
        setTimeout(() => fileInputRef.current?.click(), 100);
    };

    const handleExportClick = async (format: 'excel' | 'json') => {
        setIsExporting(true);
        try {
            const result = await exportExpenses(expenses, format);

            // Close modal first
            window.history.go(-2);

            // Show toast feedback after a small delay to ensure modal is closed
            setTimeout(() => {
                showToast({
                    message: result.message,
                    type: result.success ? 'success' : 'error'
                });
            }, 300);
        } catch (error) {
            console.error('Export error:', error);
            showToast({ message: 'Errore imprevisto durante l\'export.', type: 'error' });
            window.history.go(-2);
        } finally {
            setIsExporting(false);
        }
    };

    const handleSyncClick = async () => {
        window.history.back();
        await onSync();
    };

    const handleOpenBankSyncSettings = () => {
        window.history.back();
        setTimeout(onOpenBankSyncSettings, 50);
    };

    useEffect(() => {
        if (!isImportExportMenuOpen) setTimeout(() => setShowExportOptions(false), 300);
    }, [isImportExportMenuOpen]);

    const { progress } = useSwipe(headerContainerRef, {
        onSwipeLeft: () => {
            if (activeViewIndex < 2 && !isPeriodMenuOpen) {
                setActiveViewIndex(prev => prev + 1);
                setIsSwipeAnimating(true);
            }
        },
        onSwipeRight: () => {
            if (activeViewIndex > 0 && !isPeriodMenuOpen) {
                setActiveViewIndex(prev => prev - 1);
                setIsSwipeAnimating(true);
            }
        }
    }, { threshold: 40, slop: 10, enabled: !isPeriodMenuOpen && !isDraggingDisabled });

    useEffect(() => {
        if (isSwipeAnimating) {
            const timer = setTimeout(() => setIsSwipeAnimating(false), 200);
            return () => clearTimeout(timer);
        }
    }, [isSwipeAnimating]);

    useEffect(() => {
        setIsPeriodMenuOpen(false);
    }, [activeViewIndex]);

    // ✅ Saldo Home = somma dei saldi di tutti i conti (non "budget" del periodo)
    const totalAccountsBalance = useMemo(() => {
        const safeAccounts = accounts || [];
        const safeExpenses = expenses || [];

        const balances: Record<string, number> = {};
        safeAccounts.forEach(acc => {
            balances[acc.id] = 0;
        });

        safeExpenses.forEach(e => {
            const amt = Number(e.amount) || 0;

            if (e.type === 'expense') {
                if (balances[e.accountId] !== undefined) balances[e.accountId] -= amt;
            } else if (e.type === 'income') {
                if (balances[e.accountId] !== undefined) balances[e.accountId] += amt;
            } else if (e.type === 'transfer') {
                if (balances[e.accountId] !== undefined) balances[e.accountId] -= amt;
                if (e.toAccountId && balances[e.toAccountId] !== undefined) balances[e.toAccountId] += amt;
            } else if (e.type === 'adjustment') {
                if (balances[e.accountId] !== undefined) balances[e.accountId] += amt;
            }
        });

        return (Object.values(balances) as number[]).reduce((acc, val) => acc + val, 0);
    }, [accounts, expenses]);

    const { totalExpenses, totalIncome, netBudget, dailyTotal, categoryData, recurringCountInPeriod, periodLabel, dateRangeLabel } = useMemo(() => {
        const safeExpenses = expenses || [];
        const validExpenses = safeExpenses.filter(e => e.amount != null && !isNaN(Number(e.amount)));
        const now = new Date();

        const todayString = toYYYYMMDD(now);
        const daily = validExpenses
            .filter(expense => expense.date === todayString && expense.type === 'expense')
            .reduce((acc, expense) => acc + Number(expense.amount), 0);

        let start: Date, end: Date, label: string, rangeLabel = '';

        if (activeViewIndex === 0) {
            end = new Date(now);
            end.setHours(23, 59, 59, 999);
            start = new Date(now);
            start.setHours(0, 0, 0, 0);

            switch (quickFilter) {
                case '7d': start.setDate(start.getDate() - 6); label = "Ultimi 7 Giorni"; break;
                case '30d': start.setDate(start.getDate() - 29); label = "Ultimi 30 Giorni"; break;
                case '6m': start.setMonth(start.getMonth() - 6); label = "Ultimi 6 Mesi"; break;
                case '1y': start.setFullYear(start.getFullYear() - 1); label = "Ultimo Anno"; break;
                default: label = "Tutto"; start = new Date(0); break;
            }
            const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
            rangeLabel = `${start.toLocaleDateString('it-IT', opts)} - Oggi`;

        } else if (activeViewIndex === 2) {
            if (customRange.start && customRange.end) {
                start = parseLocalYYYYMMDD(customRange.start);
                end = parseLocalYYYYMMDD(customRange.end);
                end.setHours(23, 59, 59, 999);
                label = "Periodo Personalizzato";
                const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
                const yOpts: Intl.DateTimeFormatOptions = { year: '2-digit' };
                rangeLabel = `${start.toLocaleDateString('it-IT', opts)} - ${end.toLocaleDateString('it-IT', yOpts)}`;
            } else {
                start = new Date();
                end = new Date();
                label = "Seleziona Date";
                rangeLabel = "-";
            }
        } else {
            start = new Date(periodDate);
            start.setHours(0, 0, 0, 0);
            end = new Date(periodDate);
            end.setHours(23, 59, 59, 999);

            if (periodType === 'day') {
                const isToday = toYYYYMMDD(start) === toYYYYMMDD(now);
                label = isToday ? "Spesa di Oggi" : "Spesa Giornaliera";
                rangeLabel = start.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'long' });
            } else if (periodType === 'week') {
                const day = start.getDay();
                const diff = start.getDate() - day + (day === 0 ? -6 : 1);
                start.setDate(diff);
                end = new Date(start);
                end.setDate(start.getDate() + 6);
                end.setHours(23, 59, 59, 999);
                label = "Spesa Settimanale";
                rangeLabel = `${start.getDate()} ${start.toLocaleString('it-IT', { month: 'short' })} - ${end.getDate()} ${end.toLocaleString('it-IT', { month: 'short' })}`;
            } else if (periodType === 'month') {
                start.setDate(1);
                end = new Date(start);
                end.setMonth(end.getMonth() + 1);
                end.setDate(0);
                end.setHours(23, 59, 59, 999);
                label = "Spesa Mensile";
                rangeLabel = start.toLocaleString('it-IT', { month: 'long', year: 'numeric' });
            } else {
                start.setMonth(0, 1);
                end = new Date(start);
                end.setFullYear(end.getFullYear() + 1);
                end.setMonth(0, 0);
                end.setHours(23, 59, 59, 999);
                label = "Spesa Annuale";
                rangeLabel = start.getFullYear().toString();
            }
        }

        const periodTransactions = validExpenses.filter(e => {
            const expenseDate = parseLocalYYYYMMDD(e.date);
            return expenseDate >= start && expenseDate <= end;
        });

        const periodExpenses = periodTransactions.filter(e => e.type === 'expense');
        const periodIncome = periodTransactions.filter(e => e.type === 'income');
        const periodAdjustments = periodTransactions.filter(e => e.type === 'adjustment');

        const totalExp = periodExpenses.reduce((acc, e) => acc + Number(e.amount), 0);
        const totalInc = periodIncome.reduce((acc, e) => acc + Number(e.amount), 0);
        const totalAdj = periodAdjustments.reduce((acc, e) => acc + Number(e.amount), 0);

        const budget = totalInc - totalExp + totalAdj;

        let recurringCount = 0;
        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
            recurringExpenses.forEach(template => {
                if (!template.date) return;
                const totalGenerated = safeExpenses.filter(e => e.recurringExpenseId === template.id).length;
                if (template.recurrenceEndType === 'count' && template.recurrenceCount && totalGenerated >= template.recurrenceCount) return;
                if (template.recurrenceEndType === 'date' && template.recurrenceEndDate && template.lastGeneratedDate && template.lastGeneratedDate >= template.recurrenceEndDate) return;

                let nextDue = parseLocalYYYYMMDD(template.date);
                let simulatedOccurrences = 0;
                while (nextDue) {
                    if (nextDue > end) break;
                    if (template.recurrenceEndType === 'date' && template.recurrenceEndDate && toYYYYMMDD(nextDue) > template.recurrenceEndDate) break;
                    if (template.recurrenceEndType === 'count' && template.recurrenceCount && simulatedOccurrences >= template.recurrenceCount) break;

                    if (nextDue >= start) recurringCount++;

                    simulatedOccurrences++;
                    nextDue = calculateNextDueDate(template, nextDue);
                }
            });
        }

        const categoryTotals = periodExpenses.reduce((acc: Record<string, number>, expense) => {
            const category = expense.category || 'Altro';
            acc[category] = (acc[category] || 0) + Number(expense.amount);
            return acc;
        }, {} as Record<string, number>);

        const sortedCategoryData = Object.entries(categoryTotals)
            .map(([name, value]) => ({ name, value: value as number }))
            .sort((a, b) => b.value - a.value);

        return {
            totalExpenses: totalExp,
            totalIncome: totalInc,
            netBudget: budget,
            dailyTotal: daily,
            categoryData: sortedCategoryData,
            recurringCountInPeriod: recurringCount,
            periodLabel: label,
            dateRangeLabel: rangeLabel
        };
    }, [expenses, recurringExpenses, activeViewIndex, quickFilter, periodType, periodDate, customRange]);

    const listTx = -activeViewIndex * (100 / 3);

    const renderCard = (id: string, isOverlay: boolean = false) => {
        let content = null;

        if (id === 'summary') {
            content = (
                <div className="midnight-card p-6 md:rounded-2xl shadow-xl flex flex-col transition-all duration-300">
                    <div className="mb-4">
                        <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200">Riepilogo Categorie</h3>
                        <p className="text-sm text-slate-500 font-medium capitalize">{dateRangeLabel}</p>
                    </div>

                    {categoryData.length > 0 ? (
                        <div className="space-y-4 flex-grow">
                            {categoryData.map(cat => {
                                const style = getCategoryStyle(cat.name);
                                const percentage = totalExpenses > 0 ? (cat.value / totalExpenses) * 100 : 0;
                                return (
                                    <div key={cat.name} className="flex items-center gap-4 text-base">
                                        <style.Icon className="w-10 h-10 flex-shrink-0" />
                                        <div className="flex-grow">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="font-semibold text-slate-700 dark:text-slate-300">{style.label}</span>
                                                <span className="font-bold text-slate-800 dark:text-white">{formatCurrency(cat.value)}</span>
                                            </div>
                                            <div className="w-full bg-sunset-cream/90 dark:bg-slate-700 rounded-full h-2.5">
                                                <div className="bg-indigo-500 dark:bg-electric-violet h-2.5 rounded-full" style={{ width: `${percentage}%` }}></div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    ) : <p className="text-center text-slate-500 dark:text-slate-400 flex-grow flex items-center justify-center">Nessuna spesa registrata in questo periodo.</p>}
                </div>
            );
        } else if (id === 'categoryPie') {
            content = (
                <div className="midnight-card p-6 md:rounded-2xl shadow-xl transition-all duration-300">
                    <div className="mb-2 text-center">
                        <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200">Spese per Categoria</h3>
                        <p className="text-sm text-slate-500 font-medium capitalize">{dateRangeLabel}</p>
                    </div>

                    {categoryData.length > 0 ? (
                        <div className="relative cursor-pointer" onClick={handleChartBackgroundClick}>
                            <ResponsiveContainer width="100%" height={300}>
                                <PieChart>
                                    <Pie
                                        data={categoryData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={68}
                                        outerRadius={102}
                                        cornerRadius={6}
                                        fill="#8884d8"
                                        paddingAngle={4}
                                        dataKey="value"
                                        nameKey="name"
                                        {...({ activeIndex: activeIndex ?? undefined } as any)}
                                        activeShape={renderActiveShape}
                                    >
                                        {categoryData.map((entry) => {
                                            const color = categoryHexColors[entry.name] || DEFAULT_COLOR;
                                            return (
                                                <Cell
                                                    key={`cell-${entry.name}`}
                                                    fill={color}
                                                    fillOpacity={isDark ? 0.15 : 1}
                                                    stroke={isDark ? color : "none"}
                                                    strokeWidth={isDark ? 2 : 0}
                                                    style={isDark ? { filter: `drop-shadow(0 0 3px ${color})` } as React.CSSProperties : {}}
                                                />
                                            );
                                        })}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                            {activeIndex === null && (
                                <div className="absolute inset-0 flex flex-col justify-center items-center pointer-events-none">
                                    <span className="text-slate-800 dark:text-slate-200 text-base font-bold">Totale</span>
                                    <span className="text-2xl font-extrabold text-slate-800 dark:text-white mt-1">
                                        {formatCurrency(totalExpenses)}
                                    </span>
                                </div>
                            )}
                        </div>
                    ) : <p className="text-center text-slate-500 py-16">Nessun dato da visualizzare.</p>}

                    {categoryData.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-slate-200">
                            <div className="flex flex-wrap justify-center gap-x-4 gap-y-3">
                                {categoryData.map((entry, index) => {
                                    const style = getCategoryStyle(entry.name);
                                    return (
                                        <button
                                            key={`item-${index}`}
                                            onClick={(e) => handleLegendItemClick(index, e)}
                                            className={`flex items-center gap-3 p-2 rounded-full text-left transition-all duration-200 bg-sunset-cream/60 dark:bg-midnight-card hover:bg-sunset-peach/50 dark:hover:bg-midnight-card/80`}
                                        >
                                            <style.Icon className="w-8 h-8 flex-shrink-0" />
                                            <div className="min-w-0 pr-2">
                                                <p className={`font-semibold text-sm truncate text-slate-700 dark:text-slate-300`}>{style.label}</p>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            );
        } else if (id === 'trend') {
            content = (
                <BudgetTrendChart
                    expenses={expenses}
                    accounts={accounts}
                    periodType={periodType}
                    periodDate={periodDate}
                    activeViewIndex={activeViewIndex}
                    quickFilter={quickFilter}
                    customRange={customRange}
                />
            );
        }

        if (isOverlay) {
            return (
                <div className="cursor-grabbing scale-[0.65] shadow-2xl z-50">
                    {content}
                </div>
            );
        }

        return (
            <SortableItem key={id} id={id}>
                {content}
            </SortableItem>
        );
    };

    return (
        <>
            <div className="md:p-6 pb-32 md:pb-32 space-y-6 dark:bg-midnight" {...tapBridgeHandlers}>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-1 flex flex-col gap-4">
                        <div className="midnight-card p-6 md:rounded-2xl shadow-xl flex flex-col justify-between relative transition-all duration-300">
                            <div className="text-center mb-2 relative z-10">
                                <h3 className="text-lg font-bold text-sunset-text dark:text-white leading-tight uppercase tracking-wide">{periodLabel}</h3>
                                <p className="text-sm font-medium text-slate-400 dark:text-slate-500 capitalize mb-1">{dateRangeLabel}</p>
                                <div className="relative flex justify-center items-center text-indigo-600 dark:text-electric-violet mt-1">
                                    <div className="relative flex items-baseline">
                                        <span className="absolute right-full mr-2 text-3xl font-semibold opacity-80 top-1/2 -translate-y-1/2">€</span>
                                        <span className="text-5xl font-extrabold tracking-tight dark:text-white">
                                            {formatCurrency(totalExpenses).replace('€', '').trim()}
                                        </span>
                                    </div>
                                    {recurringCountInPeriod > 0 && (
                                        <div className="absolute right-0 top-1/2 -translate-y-1/2">
                                            <span className="w-8 h-8 flex items-center justify-center text-xs font-bold text-slate-900 bg-amber-100 border border-amber-400 rounded-lg shadow-sm" title="Spese programmate in arrivo">
                                                {recurringCountInPeriod}P
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="mb-2 relative z-20 mx-5" ref={headerContainerRef} style={{ touchAction: 'pan-y' }}>
                                <div className={`relative ${isPeriodMenuOpen ? 'overflow-visible' : 'overflow-hidden'}`}>
                                    <div
                                        className="w-[300%] flex transition-transform duration-300 ease-out"
                                        style={{ transform: `translateX(${listTx}%)` }}
                                    >
                                        <div className={`w-1/3 px-1 ${isPeriodMenuOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                                            <QuickFilterControl
                                                isActive={activeViewIndex === 0}
                                                currentValue={quickFilter}
                                                onSelect={(v) => { setQuickFilter(v); setActiveViewIndex(0); }}
                                                compact={true}
                                            />
                                        </div>
                                        <div className="w-1/3 px-1 relative z-20">
                                            <PeriodNavigator
                                                isActive={activeViewIndex === 1}
                                                periodType={periodType}
                                                periodDate={periodDate}
                                                onTypeChange={setPeriodType}
                                                onDateChange={setPeriodDate}
                                                onActivate={() => setActiveViewIndex(1)}
                                                isMenuOpen={isPeriodMenuOpen}
                                                onMenuToggle={setIsPeriodMenuOpen}
                                                isPanelOpen={true}
                                                compact={true}
                                            />
                                        </div>
                                        <div className={`w-1/3 px-1 ${isPeriodMenuOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                                            <CustomDateRangeInputs
                                                isActive={activeViewIndex === 2}
                                                range={customRange}
                                                onChange={(r) => { setCustomRange(r); setActiveViewIndex(2); }}
                                                compact={true}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-center items-center mt-3 gap-2">
                                    {[0, 1, 2].map((i) => (
                                        <button
                                            key={i}
                                            onClick={() => setActiveViewIndex(i)}
                                            className={`w-2 h-2 rounded-full transition-colors ${activeViewIndex === i ? 'bg-indigo-600 dark:bg-electric-violet' : 'bg-slate-300 dark:bg-slate-700 hover:bg-slate-400'}`}
                                            aria-label={`Vai alla pagina filtri ${i + 1}`}
                                        />
                                    ))}
                                </div>
                            </div>

                            <div className="mt-4 pt-4 border-t border-slate-200 relative z-10">
                                <div className="flex justify-between items-start gap-4">
                                    <div className="flex-1">
                                        <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400">Spesa Oggi</h4>
                                        <p className="text-xl font-bold text-sunset-text dark:text-white">{formatCurrency(dailyTotal)}</p>
                                    </div>
                                    <div className="w-px h-12 bg-slate-200 dark:bg-slate-700" />
                                    <div className="flex-1 flex flex-col">
                                        <div className="flex justify-between items-center mb-1">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onToggleBalanceVisibility(); }}
                                                className="p-2 -ml-2 rounded-full text-slate-400 hover:text-indigo-600 dark:hover:text-electric-violet hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                aria-label={isBalanceVisible ? "Nascondi patrimonio" : "Mostra patrimonio"}
                                            >
                                                {isBalanceVisible ? <EyeSlashIcon className="w-6 h-6" /> : <EyeIcon className="w-6 h-6" />}
                                            </button>
                                            <h4 className="text-sm font-medium text-slate-400 dark:text-slate-500 cursor-default select-none">Patrimonio</h4>
                                        </div>
                                        <p className={`text-xl font-bold text-right ${!isBalanceVisible ? 'text-slate-800 dark:text-white' : totalAccountsBalance >= 0 ? 'text-green-600 dark:text-emerald-400' : 'text-red-600 dark:text-rose-400'}`}>
                                            {isBalanceVisible ? (
                                                <>
                                                    {totalAccountsBalance >= 0 ? '+' : ''}{formatCurrency(totalAccountsBalance)}
                                                </>
                                            ) : (
                                                '******'
                                            )}
                                        </p>
                                    </div>
                                </div>

                                <div
                                    className="mt-4 flex items-center gap-3 overflow-x-auto py-2 -mx-6 px-6 no-scrollbar"
                                    style={{
                                        scrollbarWidth: 'none',
                                        msOverflowStyle: 'none',
                                        WebkitOverflowScrolling: 'touch',
                                        touchAction: 'pan-x pan-y'
                                    }}
                                >
                                    <style>{`.no-scrollbar::-webkit-scrollbar { display: none; }`}</style>
                                    <button onClick={handleNavigateToRecurring} className="flex-none h-10 flex items-center justify-center gap-2 px-3 text-center font-semibold text-amber-900 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300 rounded-full hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-all border border-amber-200 dark:border-amber-500/30">
                                        <ProgrammateDetailedIcon className="w-7 h-7" /> <span className="text-sm">Programmate</span>
                                    </button>
                                    <button onClick={handleNavigateToHistory} className="flex-none h-10 flex items-center justify-center gap-2 px-3 text-center font-semibold text-indigo-900 bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 rounded-full hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-all border border-indigo-200 dark:border-indigo-500/30">
                                        <ExpensesDetailedIcon className="w-7 h-7" /> <span className="text-sm">Spese</span>
                                    </button>
                                    <button onClick={handleNavigateToIncomes} className={`flex-none h-10 flex items-center justify-center gap-2 px-3 text-center font-semibold text-emerald-900 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-full hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-all border border-emerald-200 dark:border-emerald-500/30 ${!isBalanceVisible ? 'opacity-50 grayscale' : ''}`}>
                                        <IncomeDetailedIcon className="w-7 h-7" /> <span className="text-sm">Entrate</span>
                                    </button>
                                    <button onClick={handleNavigateToAccounts} className={`flex-none h-10 flex items-center justify-center gap-2 px-3 text-center font-semibold text-slate-900 bg-slate-100 dark:bg-slate-800 dark:text-slate-300 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-all border border-slate-200 dark:border-slate-600/50 ${!isBalanceVisible ? 'opacity-50 grayscale' : ''}`}>
                                        <AccountsDetailedIcon className="w-7 h-7" /> <span className="text-sm">Conti</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3">
                            <button
                                onClick={openImportExportMenu}
                                className="midnight-card flex items-center p-4 md:rounded-2xl shadow-lg border border-transparent dark:border-electric-violet/10 hover:shadow-xl transition-all group overflow-hidden relative"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/0 via-indigo-500/5 to-indigo-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                                {/* Icona a sinistra */}
                                <div className="w-12 h-12 flex items-center justify-center bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl relative z-10 flex-shrink-0">
                                    <ArrowsUpDownIcon className="w-7 h-7" />
                                </div>
                                {/* Testo centrato nello spazio rimanente */}
                                <div className="flex-1 flex flex-col items-center justify-center relative z-10">
                                    <p className="font-bold text-slate-700 dark:text-white underline decoration-indigo-200 dark:decoration-indigo-900 decoration-2 underline-offset-4">IMP/EXP</p>
                                </div>
                                {/* Spacer trasparente a destra per bilanciare l'icona */}
                                <div className="w-12 flex-shrink-0" />
                            </button>
                        </div>
                    </div>

                    <div className="lg:col-span-2 flex flex-col gap-6">
                        <DndContext
                            sensors={isDraggingDisabled ? [] : sensors}
                            collisionDetection={closestCenter}
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                        >
                            <SortableContext items={items} strategy={verticalListSortingStrategy}>
                                <div className="space-y-6">
                                    {items.map((id) => renderCard(id))}
                                </div>
                            </SortableContext>

                            <DragOverlay>
                                {activeId ? renderCard(activeId, true) : null}
                            </DragOverlay>
                        </DndContext>
                    </div>
                </div>
            </div>

            {/* Modal Import/Export (Menu) */}
            {isImportExportMenuOpen && (
                <div className="fixed inset-0 z-[6000] flex justify-center items-end md:items-center p-0 md:p-4 bg-midnight/60 backdrop-blur-md animate-fade-in" onClick={handleCloseNavigation}>
                    <div
                        className="midnight-card rounded-t-3xl md:rounded-2xl shadow-2xl w-full max-w-lg border border-transparent dark:border-electric-violet/30 overflow-hidden animate-slide-up md:animate-scale-in"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="p-6 flex items-center justify-between border-b dark:border-slate-800">
                            <div className="flex items-center gap-3">
                                {showExportOptions && (
                                    <button onClick={handleBackNavigation} className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                        <ArrowLeftIcon className="w-6 h-6 text-slate-500" />
                                    </button>
                                )}
                                <h2 className="text-xl font-bold text-slate-800 dark:text-white">
                                    {showExportOptions ? 'Seleziona Formato' : 'Importa / Esporta'}
                                </h2>
                            </div>
                            <button onClick={handleCloseNavigation} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
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
                                        onClick={openExportOptions}
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

                                    <button
                                        onClick={handleOpenBankSyncSettings}
                                        className="flex items-center gap-4 p-4 rounded-xl border-2 border-slate-100 dark:border-slate-800 hover:border-amber-500 dark:hover:border-amber-500/50 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-all text-left group"
                                    >
                                        <div className="w-12 h-12 flex items-center justify-center bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-lg group-hover:scale-110 transition-transform">
                                            <span className="text-2xl">🏦</span>
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-800 dark:text-white text-lg">Configura Banche</p>
                                            <p className="text-sm text-slate-500">Collega Revolut e altri conti bancari.</p>
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
                </div>
            )}
        </>
    );
};

export default Dashboard;
