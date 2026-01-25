import { Expense, Account } from '../types';
import { parseLocalYYYYMMDD, toYYYYMMDD } from './date';

export interface DashboardMetrics {
    totalExpenses: number;
    totalIncome: number;
    netBudget: number;
    dailyTotal: number;
    categoryData: { name: string; value: number }[];
    dateRangeLabel: string;
}

export const calculateDashboardMetrics = (
    expenses: Expense[],
    start: Date,
    end: Date
): DashboardMetrics => {
    const validExpenses = expenses.filter(e => e.amount != null && !isNaN(Number(e.amount)));
    const now = new Date();
    const todayString = toYYYYMMDD(now);

    const dailyTotal = validExpenses
        .filter(expense => expense.date === todayString && expense.type === 'expense')
        .reduce((acc, expense) => acc + Number(expense.amount), 0);

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

    const categoryTotals = periodExpenses.reduce((acc: Record<string, number>, expense) => {
        const category = expense.category || 'Altro';
        acc[category] = (acc[category] || 0) + Number(expense.amount);
        return acc;
    }, {} as Record<string, number>);

    const sortedCategoryData = Object.entries(categoryTotals)
        .map(([name, value]) => ({ name, value: value as number }))
        .sort((a, b) => b.value - a.value);

    // Default range label (can be overridden by caller)
    const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
    const rangeLabel = `${start.toLocaleDateString('it-IT', opts)} - ${end.toLocaleDateString('it-IT', opts)}`;

    return {
        totalExpenses: totalExp,
        totalIncome: totalInc,
        netBudget: budget,
        dailyTotal,
        categoryData: sortedCategoryData,
        dateRangeLabel: rangeLabel
    };
};

export const calculateTotalBalance = (accounts: Account[], expenses: Expense[]) => {
    const balances: Record<string, number> = {};
    accounts.forEach(acc => {
        balances[acc.id] = 0;
    });

    expenses.forEach(e => {
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
};
