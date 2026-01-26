import React from 'react';
import { getCategoryStyle } from '../../utils/categoryStyles';
import { formatCurrency } from '../icons/formatters';

interface CategorySummaryCardProps {
    categoryData: { name: string; value: number }[];
    totalExpenses: number;
    dateRangeLabel: string;
    noBorder?: boolean;
}

export const CategorySummaryCard: React.FC<CategorySummaryCardProps> = ({
    categoryData,
    totalExpenses,
    dateRangeLabel,
    noBorder = false,
}) => {
    return (
        <div className={`${noBorder ? '' : 'midnight-card p-6 md:rounded-2xl shadow-xl'} h-full w-full flex flex-col`}>
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
            ) : (
                <div className="flex-grow flex items-center justify-center">
                    <p className="text-center text-slate-500 dark:text-slate-400">Nessuna spesa registrata in questo periodo.</p>
                </div>
            )}
        </div>
    );
};
