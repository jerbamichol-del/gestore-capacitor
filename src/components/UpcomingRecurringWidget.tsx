import React, { useMemo } from 'react';
import { Expense } from '../types';
import { formatCurrency } from './icons/formatters';
import { parseLocalYYYYMMDD, toYYYYMMDD } from '../utils/date';
import { SubscriptionService } from '../services/subscription-service';

interface UpcomingRecurringWidgetProps {
    recurringExpenses: Expense[];
    expenses: Expense[];
    onNavigateToRecurring: () => void;
}

const getServiceInitial = (name: string): string => {
    return name ? name.charAt(0).toUpperCase() : '?';
};

export const UpcomingRecurringWidget: React.FC<UpcomingRecurringWidgetProps> = ({
    recurringExpenses,
    expenses,
    onNavigateToRecurring
}) => {
    // Logic to find upcoming recurring expenses (next 7 days)
    const upcomingList = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const nextWeek = new Date(today);
        nextWeek.setDate(today.getDate() + 7);
        nextWeek.setHours(23, 59, 59, 999);

        const list: { template: Expense; dueDate: Date; isOverdue: boolean }[] = [];

        recurringExpenses.forEach(template => {
            if (!template.date) return;

            // Logic similar to Dashboard recurrence calculation
            let nextDue = parseLocalYYYYMMDD(template.date);
            if (!nextDue) return;

            // Check if user has set specific end conditions
            if (template.recurrenceEndType === 'date' && template.recurrenceEndDate && template.lastGeneratedDate && template.lastGeneratedDate >= template.recurrenceEndDate) return;
            // Simplified check for count
            if (template.recurrenceEndType === 'count' && template.recurrenceCount && (template.recurrenceCount <= 0)) return;


            // Advance cursor to find next occurrence >= today
            let cursor = new Date(nextDue);

            // Safety break to prevent infinite loops if date is way in past
            let iterations = 0;
            while (cursor < today && iterations < 1000) {
                const interval = template.recurrenceInterval || 1;
                switch (template.recurrence) {
                    case 'daily': cursor.setDate(cursor.getDate() + interval); break;
                    case 'weekly': cursor.setDate(cursor.getDate() + 7 * interval); break;
                    case 'monthly': cursor.setMonth(cursor.getMonth() + interval); break;
                    case 'yearly': cursor.setFullYear(cursor.getFullYear() + interval); break;
                    default: return;
                }
                iterations++;
            }

            // Now cursor is the next due date >= today
            if (cursor <= nextWeek) {
                // Check if this specific occurrence has already been generated
                // We'll search for an expense linked to this recurring ID with a date close to this due date
                const cursorIso = toYYYYMMDD(cursor);

                // Check if an expense with this recurringId exists with this date
                const alreadyGenerated = expenses.some(e =>
                    e.recurringExpenseId === template.id &&
                    e.date === cursorIso
                );

                if (!alreadyGenerated) {
                    const isOverdue = cursor < today;
                    list.push({ template, dueDate: new Date(cursor), isOverdue });
                }
            }
        });

        // Sort by due date
        return list.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime()).slice(0, 5);
    }, [recurringExpenses, expenses]);

    if (upcomingList.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 dark:text-slate-500">
                <div className="bg-slate-100 dark:bg-white/5 p-3 rounded-full mb-3">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                </div>
                <p className="text-sm font-medium">Nessuna spesa ricorrente in arrivo questa settimana</p>
                <button
                    onClick={onNavigateToRecurring}
                    className="mt-2 text-xs text-indigo-500 hover:text-indigo-600 font-medium"
                >
                    Vedi tutte
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {upcomingList.map(({ template, dueDate }, index) => {
                const dayName = dueDate.toLocaleDateString('it-IT', { weekday: 'short' });
                const dayNum = dueDate.getDate();
                const monthName = dueDate.toLocaleDateString('it-IT', { month: 'short' });

                const isToday = new Date().toDateString() === dueDate.toDateString();
                const isTomorrow = new Date(new Date().setDate(new Date().getDate() + 1)).toDateString() === dueDate.toDateString();

                const label = isToday ? 'Oggi' : isTomorrow ? 'Domani' : `${dayName} ${dayNum} ${monthName}`;
                const logoUrl = SubscriptionService.getLogoUrl(template.description);

                return (
                    <div key={`${template.id}-${index}`} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-700 shadow-sm flex items-center justify-center overflow-hidden shrink-0">
                                <img
                                    src={logoUrl}
                                    alt=""
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                    }}
                                />
                                <span className="hidden text-sm font-bold text-slate-500">{getServiceInitial(template.description)}</span>
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-800 dark:text-white line-clamp-1">{template.description}</p>
                                <p className={`text-xs font-medium ${isToday ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'}`}>
                                    {label}
                                </p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-sm font-bold text-slate-900 dark:text-white">{formatCurrency(template.amount)}</p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">{template.recurrence === 'monthly' ? 'Mensile' : 'Annuale'}</p>
                        </div>
                    </div>
                );
            })}

            <button
                onClick={onNavigateToRecurring}
                className="w-full py-2 text-xs font-medium text-center text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-electric-violet transition-colors"
            >
                Gestisci pianificazione &rarr;
            </button>
        </div>
    );
};
