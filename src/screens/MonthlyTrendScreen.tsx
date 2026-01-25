import React, { useState, useMemo, useRef, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Sector } from 'recharts';
import { Expense } from '../types';
import { formatCurrency } from '../components/icons/formatters';
import { getCategoryStyle } from '../utils/categoryStyles';
import { useSwipe } from '../hooks/useSwipe';
import { ChevronRightIcon } from '../components/icons/ChevronRightIcon';

// Reusing colors from Dashboard
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

interface MonthlyTrendScreenProps {
    expenses: Expense[];
}

const renderActiveShape = (props: any) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent } = props;
    const style = getCategoryStyle(payload.name);
    const isDark = document.documentElement.classList.contains('dark');

    return (
        <g>
            <text x={cx} y={cy - 12} textAnchor="middle" className="text-base font-bold" style={{ fill: 'var(--pie-text-primary, #1e293b)' }}>
                {style.label}
            </text>
            <text x={cx} y={cy + 12} textAnchor="middle" fill={fill} className="text-xl font-extrabold" style={isDark ? { filter: `drop-shadow(0 0 4px ${fill})` } : {}}>
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
                stroke={isDark ? fill : "none"}
                strokeWidth={isDark ? 3 : 0}
            />
        </g>
    );
};

const Pages = [
    { id: 'summary', title: 'Riepilogo Categorie' },
    { id: 'distribution', title: 'Distribuzione' },
];

const MonthlyTrendScreen: React.FC<MonthlyTrendScreenProps> = ({ expenses }) => {
    const [activePageIndex, setActivePageIndex] = useState(0);
    const [isSwipeAnimating, setIsSwipeAnimating] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Data Preparation (This month only)
    const monthlyData = useMemo(() => {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const monthlyExpenses = expenses.filter(e => {
            if (!e.date) return false;
            const expenseDate = new Date(e.date);
            return expenseDate >= startOfMonth && expenseDate <= endOfMonth && e.amount != null && !isNaN(Number(e.amount)) && e.type === 'expense';
        });

        const categoryTotals = monthlyExpenses.reduce((acc: Record<string, number>, expense) => {
            const category = expense.category || 'Altro';
            acc[category] = (acc[category] || 0) + Number(expense.amount);
            return acc;
        }, {});

        const total = Object.values(categoryTotals).reduce((a, b) => a + b, 0);

        return Object.entries(categoryTotals)
            .map(([name, value]) => ({ name, value: value as number }))
            .sort((a, b) => b.value - a.value)
            .map(item => ({ ...item, percentage: total > 0 ? (item.value / total) * 100 : 0 }));

    }, [expenses]);

    const { progress } = useSwipe(containerRef, {
        onSwipeLeft: () => {
            if (activePageIndex < Pages.length - 1) {
                setActivePageIndex(prev => prev + 1);
                setIsSwipeAnimating(true);
            }
        },
        onSwipeRight: () => {
            if (activePageIndex > 0) {
                setActivePageIndex(prev => prev - 1);
                setIsSwipeAnimating(true);
            }
        }
    }, { threshold: 40, slop: 10 });

    useEffect(() => {
        if (isSwipeAnimating) {
            const timer = setTimeout(() => setIsSwipeAnimating(false), 200);
            return () => clearTimeout(timer);
        }
    }, [isSwipeAnimating]);

    const [selectedIndex, setSelectedIndex] = useState<number | null>(0);
    const activePieIndex = selectedIndex;

    const currentMonthName = new Date().toLocaleString('it-IT', { month: 'long', year: 'numeric' });

    // --- Sub-components (Inline for simplicity given file structure requests) ---

    const renderSummaryPage = () => (
        <div className="p-4 space-y-4">
            {monthlyData.length > 0 ? (
                monthlyData.map((cat, index) => {
                    const style = getCategoryStyle(cat.name);
                    return (
                        <div key={cat.name} className="flex items-center gap-4 p-3 bg-white/50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/10 shadow-sm">
                            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-full">
                                <style.Icon className="w-8 h-8 flex-shrink-0 text-slate-700 dark:text-slate-300" />
                            </div>
                            <div className="flex-grow min-w-0">
                                <div className="flex justify-between items-baseline mb-1">
                                    <span className="font-bold text-slate-700 dark:text-slate-200 truncate">{style.label}</span>
                                    <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(cat.value)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                                        <div
                                            className="bg-indigo-500 dark:bg-electric-violet h-2 rounded-full transition-all duration-500"
                                            style={{ width: `${cat.percentage}%` }}
                                        />
                                    </div>
                                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 w-10 text-right">{cat.percentage.toFixed(0)}%</span>
                                </div>
                            </div>
                        </div>
                    );
                })
            ) : (
                <div className="text-center py-10 text-slate-500 dark:text-slate-400">
                    Nessuna spesa questo mese.
                </div>
            )}
        </div>
    );

    const renderDistributionPage = () => (
        <div className="p-4 flex flex-col items-center">
            {monthlyData.length > 0 ? (
                <>
                    <div className="w-full h-[350px] relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    activeIndex={activePieIndex ?? undefined}
                                    activeShape={renderActiveShape}
                                    data={monthlyData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={80}
                                    outerRadius={110}
                                    paddingAngle={2}
                                    dataKey="value"
                                    onClick={(_, index) => setSelectedIndex(prev => prev === index ? null : index)}
                                >
                                    {monthlyData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={categoryHexColors[entry.name] || DEFAULT_COLOR} strokeWidth={0} />
                                    ))}
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="mt-6 flex flex-wrap justify-center gap-3">
                        {monthlyData.map((entry, index) => {
                            const style = getCategoryStyle(entry.name);
                            const isActive = index === selectedIndex;
                            return (
                                <button
                                    key={`item-${index}`}
                                    onClick={() => setSelectedIndex(isActive ? null : index)}
                                    className={`flex items-center gap-2 p-2 px-3 rounded-full text-sm font-medium transition-all ${isActive
                                            ? 'bg-indigo-100 text-indigo-800 dark:bg-electric-violet dark:text-white ring-2 ring-indigo-300 dark:ring-white/20'
                                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                                        }`}
                                >
                                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: categoryHexColors[entry.name] || DEFAULT_COLOR }} />
                                    {style.label}
                                </button>
                            );
                        })}
                    </div>
                </>
            ) : (
                <div className="text-center py-10 text-slate-500 dark:text-slate-400">
                    Nessuna spesa questo mese.
                </div>
            )}
        </div>
    );

    return (
        <div className="animate-fade-in-up pb-20">
            <h1 className="text-3xl font-black text-slate-800 dark:text-white mb-1 px-1">Centro Report</h1>

            <div className="flex overflow-x-auto no-scrollbar gap-6 px-1 mb-6 border-b border-slate-200 dark:border-slate-800/50 pb-2">
                {Pages.map((page, index) => (
                    <button
                        key={page.id}
                        onClick={() => setActivePageIndex(index)}
                        className={`whitespace-nowrap pb-1 font-bold text-sm transition-colors relative ${activePageIndex === index
                                ? 'text-indigo-600 dark:text-electric-violet'
                                : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                            }`}
                    >
                        {page.title}
                        {activePageIndex === index && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-electric-violet rounded-full layout-id-underline" />
                        )}
                    </button>
                ))}
            </div>

            <div
                ref={containerRef}
                className="midnight-card rounded-3xl shadow-xl border border-transparent dark:border-electric-violet/20 bg-white dark:bg-midnight-card min-h-[500px] overflow-hidden relative"
            >
                {/* Header of the card (Dynamic based on page) */}
                <div className="p-6 border-b border-slate-100 dark:border-slate-700/50 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/20">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white">{Pages[activePageIndex].title}</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 capitalize">{currentMonthName}</p>
                    </div>
                    {/* Pagination Dots */}
                    <div className="flex gap-1.5">
                        {Pages.map((_, i) => (
                            <div
                                key={i}
                                className={`w-2 h-2 rounded-full transition-all ${i === activePageIndex ? 'bg-indigo-500 w-4' : 'bg-slate-300 dark:bg-slate-700'}`}
                            />
                        ))}
                    </div>
                </div>

                {/* Swipeable View Container */}
                <div className="relative overflow-hidden w-full">
                    <div
                        className="flex transition-transform duration-300 ease-out w-full"
                        style={{ transform: `translateX(-${activePageIndex * 100}%)` }}
                    >
                        <div className="w-full flex-shrink-0">
                            {renderSummaryPage()}
                        </div>
                        <div className="w-full flex-shrink-0">
                            {renderDistributionPage()}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MonthlyTrendScreen;
