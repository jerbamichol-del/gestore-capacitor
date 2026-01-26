import React, { useMemo } from 'react';
import {
    ComposedChart,
    Area,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine
} from 'recharts';
import { Expense, Account } from '../types';
import { formatCurrency } from './icons/formatters';

interface BudgetTrendChartProps {
    expenses: Expense[];
    accounts: Account[];
    periodType: 'day' | 'week' | 'month' | 'year';
    periodDate: Date;
    activeViewIndex: number; // 0: Quick, 1: Period, 2: Custom
    quickFilter: string;
    customRange: { start: string | null; end: string | null };
    noBorder?: boolean;
}

const parseLocalYYYYMMDD = (s: string) => {
    const p = s.split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
};

const toYYYYMMDD = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

// Tooltip
const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        const dateLabel = (() => {
            const parts = label.split('-');
            if (parts.length === 3) {
                const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                return date.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' });
            }
            return label;
        })();

        const expensePositive = Math.abs(data.negExpense);

        return (
            <div className="midnight-card backdrop-blur-md p-4 rounded-xl shadow-xl border border-slate-100 dark:border-electric-violet/30 text-sm z-50">
                <p className="text-slate-500 dark:text-slate-400 font-medium mb-2 border-b border-slate-100 dark:border-electric-violet/20 pb-1">{dateLabel}</p>

                <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-4">
                        <span className="text-indigo-600 dark:text-electric-violet font-bold">Patrimonio:</span>
                        <span className="font-bold text-slate-800 dark:text-white">{formatCurrency(data.balance)}</span>
                    </div>

                    {/* Se vuoi nascondere “Rettifica” anche nel tooltip, elimina questo blocco */}
                    {data.adjustment !== 0 && (
                        <div className="flex items-center justify-between gap-4">
                            <span className="text-slate-500 dark:text-slate-400 font-medium">Rettifica:</span>
                            <span className={`font-semibold ${data.adjustment >= 0 ? "text-slate-700 dark:text-slate-200" : "text-red-400"}`}>
                                {data.adjustment > 0 ? '+' : ''}{formatCurrency(data.adjustment)}
                            </span>
                        </div>
                    )}

                    <div className="flex items-center justify-between gap-4">
                        <span className={data.net >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                            Flusso Netto:
                        </span>
                        <span className={`font-semibold ${data.net >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                            {data.net > 0 ? '+' : ''}{formatCurrency(data.net)}
                        </span>
                    </div>

                    <div className="pt-2 mt-2 border-t border-slate-100 dark:border-electric-violet/20 grid grid-cols-2 gap-x-4 text-xs">
                        <div className="text-emerald-600 dark:text-emerald-400 font-medium">
                            Entrate: {formatCurrency(data.income)}
                        </div>
                        <div className="text-rose-600 dark:text-rose-400 font-medium text-right">
                            Uscite: {formatCurrency(expensePositive)}
                        </div>
                    </div>
                </div>
            </div>
        );
    }
    return null;
};

type ChartPoint = {
    date: string;
    income: number;
    expense: number;
    adjustment: number;
    net: number;
    balance: number;
    negExpense: number;
};

export const BudgetTrendChart: React.FC<BudgetTrendChartProps> = ({
    expenses,
    accounts,
    periodType,
    periodDate,
    activeViewIndex,
    quickFilter,
    customRange,
    noBorder = false
}) => {
    const chartData = useMemo<ChartPoint[]>(() => {
        // 1) Determine date range (stessa logica attuale)
        const now = new Date();
        let start = new Date();
        let end = new Date();

        if (activeViewIndex === 0) { // Quick
            end = new Date(now);
            start = new Date(now);
            start.setHours(0, 0, 0, 0);
            switch (quickFilter) {
                case '7d': start.setDate(start.getDate() - 6); break;
                case '30d': start.setDate(start.getDate() - 29); break;
                case '6m': start.setMonth(start.getMonth() - 6); break;
                case '1y': start.setFullYear(start.getFullYear() - 1); break;
                default: start = new Date(0); break; // All
            }
        } else if (activeViewIndex === 2) { // Custom
            if (customRange.start && customRange.end) {
                start = parseLocalYYYYMMDD(customRange.start);
                end = parseLocalYYYYMMDD(customRange.end);
            }
        } else { // Period
            start = new Date(periodDate);
            end = new Date(periodDate);

            if (periodType === 'day') {
                const day = start.getDay();
                const diff = start.getDate() - day + (day === 0 ? -6 : 1);
                start.setDate(diff);
                end = new Date(start);
                end.setDate(start.getDate() + 6);
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
        }

        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);

        // Clip future
        const todayEndOfDay = new Date();
        todayEndOfDay.setHours(23, 59, 59, 999);
        if (end > todayEndOfDay) end = todayEndOfDay;

        // Safety: if start is after today (e.g. next month)
        if (start > end) {
            start = new Date(end);
            start.setHours(0, 0, 0, 0);
        }

        // 2) Bucket selection
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const isYearly = diffDays > 60;

        const bucketKeys: string[] = [];
        const bucketRanges = new Map<string, { bucketStart: Date; bucketEnd: Date }>();

        if (isYearly) {
            const curr = new Date(start);
            curr.setDate(1);
            curr.setHours(0, 0, 0, 0);

            while (curr <= end) {
                const key = `${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, '0')}-01`;

                const bucketStart = new Date(curr);
                bucketStart.setHours(0, 0, 0, 0);

                const bucketEnd = new Date(curr.getFullYear(), curr.getMonth() + 1, 0);
                bucketEnd.setHours(23, 59, 59, 999);

                // clip end (per l’ultimo mese)
                const clippedEnd = bucketEnd > end ? new Date(end) : bucketEnd;

                bucketKeys.push(key);
                bucketRanges.set(key, { bucketStart, bucketEnd: clippedEnd });

                curr.setMonth(curr.getMonth() + 1);
            }
        } else {
            const curr = new Date(start);
            curr.setHours(0, 0, 0, 0);
            while (curr <= end) {
                const key = toYYYYMMDD(curr);

                const bucketStart = new Date(curr);
                bucketStart.setHours(0, 0, 0, 0);

                const bucketEnd = new Date(curr);
                bucketEnd.setHours(23, 59, 59, 999);

                bucketKeys.push(key);
                bucketRanges.set(key, { bucketStart, bucketEnd });

                curr.setDate(curr.getDate() + 1);
            }
        }

        if (bucketKeys.length === 0) return [];

        // 3) Setup balances (identico concetto Home: per-account, poi somma)
        const balances: Record<string, number> = {};
        (accounts || []).forEach(acc => { balances[acc.id] = 0; });

        const applyToBalances = (e: Expense) => {
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
        };

        const sumBalances = () =>
            (Object.values(balances) as number[]).reduce((acc, v) => acc + v, 0);

        // 4) Sort transactions by date to replay deterministically
        const sortedTx = (expenses || [])
            .filter(e => !!e.date)
            .slice()
            .sort((a, b) => parseLocalYYYYMMDD(a.date).getTime() - parseLocalYYYYMMDD(b.date).getTime());

        // Pointer: applica tutte le tx < start per inizializzare il patrimonio
        let txIdx = 0;
        while (txIdx < sortedTx.length) {
            const d = parseLocalYYYYMMDD(sortedTx[txIdx].date);
            if (d < start) {
                applyToBalances(sortedTx[txIdx]);
                txIdx++;
            } else {
                break;
            }
        }

        // 5) Build chart points
        const out: ChartPoint[] = [];

        for (const key of bucketKeys) {
            const range = bucketRanges.get(key);
            if (!range) continue;

            const { bucketStart, bucketEnd } = range;

            let income = 0;
            let expense = 0;
            let adjustment = 0;

            // consuma tutte le transazioni dentro il bucket
            while (txIdx < sortedTx.length) {
                const tx = sortedTx[txIdx];
                const d = parseLocalYYYYMMDD(tx.date);

                if (d > bucketEnd) break;

                if (d >= bucketStart) {
                    const amt = Number(tx.amount) || 0;

                    if (tx.type === 'income') {
                        income += Math.abs(amt); // solo per barra
                    } else if (tx.type === 'expense') {
                        expense += Math.abs(amt); // solo per barra
                    } else if (tx.type === 'adjustment') {
                        adjustment += amt; // “rettifica” come dato informativo
                    }
                }

                // sempre applicata al saldo (come Home), inclusi adjustment e transfer
                applyToBalances(tx);
                txIdx++;
            }

            const net = income - expense;
            const balance = sumBalances();

            out.push({
                date: key,
                income,
                expense,
                adjustment,
                net,
                balance,
                negExpense: -expense
            });
        }

        return out;
    }, [expenses, accounts, periodType, periodDate, activeViewIndex, quickFilter, customRange]);

    if (chartData.length === 0) return null;

    return (
        <div className={`${noBorder ? '' : 'midnight-card p-5 md:rounded-3xl shadow-lg'} transition-colors`}>
            <div className="mb-6 flex justify-between items-end">
                <div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white">Andamento Patrimonio</h3>
                    <p className="text-xs font-medium text-slate-400 dark:text-slate-400 mt-0.5">Patrimonio (linea), Entrate (verde), Uscite (rosso)</p>
                </div>
            </div>

            <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer>
                    <ComposedChart data={chartData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }} stackOffset="sign">
                        <defs>
                            <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#A855F7" stopOpacity={0.2} />
                                <stop offset="95%" stopColor="#A855F7" stopOpacity={0} />
                            </linearGradient>
                        </defs>

                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-200 dark:text-electric-violet/10" strokeOpacity={0.5} />

                        <XAxis
                            dataKey="date"
                            tick={{ fontSize: 10, fill: 'var(--pie-text-secondary, #94a3b8)' }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(val) => {
                                const parts = val.split('-');
                                if (parts.length === 3) {
                                    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                                    if (chartData.length > 60) return d.toLocaleDateString('it-IT', { month: 'short' });
                                    return d.getDate().toString();
                                }
                                return '';
                            }}
                            minTickGap={5}
                            dy={10}
                        />

                        <YAxis
                            tick={{ fontSize: 10, fill: 'var(--pie-text-secondary, #94a3b8)' }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(val) => {
                                if (Math.abs(val) >= 1000) return `${(val / 1000).toFixed(0)}k`;
                                return val;
                            }}
                        />

                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--pie-text-secondary, #cbd5e1)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                        <ReferenceLine y={0} stroke="var(--pie-text-secondary, #cbd5e1)" strokeWidth={1} />

                        <Bar
                            dataKey="income"
                            stackId="stack"
                            barSize={12}
                            fill="#10b981"
                            className="dark:fill-emerald-400"
                            fillOpacity={0.8}
                            radius={[0, 0, 0, 0]}
                        />

                        <Bar
                            dataKey="negExpense"
                            stackId="stack"
                            barSize={12}
                            fill="#f43f5e"
                            className="dark:fill-rose-400"
                            fillOpacity={0.8}
                            radius={[0, 0, 0, 0]}
                        />

                        <Area
                            type="monotone"
                            dataKey="balance"
                            stroke="#A855F7"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#colorBalance)"
                            activeDot={{ r: 6, strokeWidth: 0, fill: '#A855F7' }}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
