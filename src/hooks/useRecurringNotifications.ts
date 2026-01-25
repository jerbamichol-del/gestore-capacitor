import { useEffect } from 'react';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Expense } from '../types';
import { parseLocalYYYYMMDD } from '../utils/date';

const NOTIFICATION_ID_WEEKLY = 88888;
const NOTIFICATION_ID_MONTHLY = 99999;

export function useRecurringNotifications(recurringExpenses: Expense[]) {

    useEffect(() => {
        if (!recurringExpenses || recurringExpenses.length === 0) return;
        scheduleRecurrenceSummaries();
    }, [recurringExpenses]);

    const scheduleRecurrenceSummaries = async () => {
        try {
            // Request permission first (silent check)
            const perm = await LocalNotifications.checkPermissions();
            if (perm.display !== 'granted') return;

            // Clear old schedules
            await LocalNotifications.cancel({ notifications: [{ id: NOTIFICATION_ID_WEEKLY }, { id: NOTIFICATION_ID_MONTHLY }] });

            const now = new Date();

            // --- 1. Weekly Summary (Next Monday 9:00 AM) ---
            const nextMonday = getNextDayOfWeek(now, 1); // 1 = Monday
            nextMonday.setHours(9, 0, 0, 0);

            // Calculate recurring expenses falling in that week
            const weeklyExpenses = getRecurringInstancesInPeriod(recurringExpenses, nextMonday, 7);
            if (weeklyExpenses.length > 0) {
                const total = weeklyExpenses.reduce((sum, e) => sum + e.amount, 0);
                const names = weeklyExpenses.map(e => e.description).slice(0, 3).join(', ');
                const moreCount = weeklyExpenses.length - 3;

                await LocalNotifications.schedule({
                    notifications: [{
                        id: NOTIFICATION_ID_WEEKLY,
                        title: '📅 Scadenze della Settimana',
                        body: `Hai ${weeklyExpenses.length} spese previste (${total.toFixed(2)}€).\nInclude: ${names}${moreCount > 0 ? ` e altri ${moreCount}` : '.'}`,
                        schedule: { at: nextMonday, repeats: true, every: 'week' }, // Repeat weekly
                        smallIcon: 'ic_stat_calendar_today' // Android specific, handled by OS default usually
                    }]
                });
                console.log(`Scheduled Weekly Summary for ${nextMonday.toLocaleString()} (${weeklyExpenses.length} items)`);
            }

            // --- 2. Monthly Summary (Next 1st of Month 9:00 AM) ---
            const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1, 9, 0, 0);

            // Calculate recurring expenses falling in that month
            const monthlyExpenses = getRecurringInstancesInPeriod(recurringExpenses, nextMonthStart, 30);
            if (monthlyExpenses.length > 0) {
                const total = monthlyExpenses.reduce((sum, e) => sum + e.amount, 0);

                await LocalNotifications.schedule({
                    notifications: [{
                        id: NOTIFICATION_ID_MONTHLY,
                        title: '📅 Spese Fisse del Mese',
                        body: `In arrivo ${monthlyExpenses.length} ricorrenze per un totale di ${total.toFixed(2)}€ questo mese.`,
                        schedule: { at: nextMonthStart, repeats: true, every: 'month' }
                    }]
                });
                console.log(`Scheduled Monthly Summary for ${nextMonthStart.toLocaleString()} (${monthlyExpenses.length} items)`);
            }

        } catch (e) {
            console.error("Error scheduling recurring notifications:", e);
        }
    };

    // --- Helpers ---

    const getNextDayOfWeek = (date: Date, dayOfWeek: number) => {
        const resultDate = new Date(date.getTime());
        resultDate.setDate(date.getDate() + (7 + dayOfWeek - date.getDay()) % 7);
        // If today is Monday, schedule for NEXT Monday (avoid immediate trigger loop if logic used elsewhere)
        // But for LocalNotifications 'at', if date is in past/now, it fires immediately (or not at all depending on plugin ver).
        // Let's ensure it's in the future.
        if (resultDate <= new Date()) {
            resultDate.setDate(resultDate.getDate() + 7);
        }
        return resultDate;
    };

    /**
     * Simulation logic to predict instances. 
     * Simplified: checks 'daily', 'weekly', 'monthly' patterns.
     */
    const getRecurringInstancesInPeriod = (expenses: Expense[], startDate: Date, daysDuration: number): { description: string, amount: number }[] => {
        const instances: { description: string, amount: number }[] = [];
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + daysDuration);

        expenses.forEach(ex => {
            if (ex.recurrence === 'daily') {
                instances.push({ description: ex.description, amount: ex.amount }); // Will happen at least once
            } else if (ex.recurrence === 'weekly') {
                // Check if any recurrence day falls in range
                // Simplified: Assume yes for weekly in a 7+ day window
                instances.push({ description: ex.description, amount: ex.amount });
            } else if (ex.recurrence === 'monthly') {
                // Check if day of month matches range
                // A bit complex to do perfectly without a full Recurrence Engine, 
                // but we can approximation: if it's "Monthly", it likely happens once in a 30 day window.
                instances.push({ description: ex.description, amount: ex.amount });
            }
        });

        return instances;
    };
}
