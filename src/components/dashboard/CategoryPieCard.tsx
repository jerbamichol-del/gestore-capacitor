import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Sector } from 'recharts';
import { getCategoryStyle } from '../../utils/categoryStyles';
import { formatCurrency } from '../icons/formatters';

export const categoryHexColors: Record<string, string> = {
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

interface CategoryPieCardProps {
    categoryData: { name: string; value: number }[];
    totalExpenses: number;
    dateRangeLabel: string;
    selectedIndex: number | null;
    onSelectedIndexChange: (index: number | null) => void;
}

export const CategoryPieCard: React.FC<CategoryPieCardProps> = ({
    categoryData,
    totalExpenses,
    dateRangeLabel,
    selectedIndex,
    onSelectedIndexChange
}) => {
    const isDark = document.documentElement.classList.contains('dark');

    const handleLegendItemClick = (index: number, event: React.MouseEvent) => {
        event.stopPropagation();
        onSelectedIndexChange(selectedIndex === index ? null : index);
    };

    return (
        <div className="midnight-card p-6 md:rounded-2xl shadow-xl h-full w-full flex flex-col">
            <div className="mb-2 text-center">
                <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200">Spese per Categoria</h3>
                <p className="text-sm text-slate-500 font-medium capitalize">{dateRangeLabel}</p>
            </div>

            {categoryData.length > 0 ? (
                <div className="relative cursor-pointer" onClick={() => onSelectedIndexChange(null)}>
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
                                {...({ activeIndex: selectedIndex ?? undefined } as any)}
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
                    {selectedIndex === null && (
                        <div className="absolute inset-0 flex flex-col justify-center items-center pointer-events-none">
                            <span className="text-slate-800 dark:text-slate-200 text-base font-bold">Totale</span>
                            <span className="text-2xl font-extrabold text-slate-800 dark:text-white mt-1">
                                {formatCurrency(totalExpenses)}
                            </span>
                        </div>
                    )}
                </div>
            ) : (
                <div className="flex-grow flex items-center justify-center py-16">
                    <p className="text-center text-slate-500">Nessun dato da visualizzare.</p>
                </div>
            )}

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
};
