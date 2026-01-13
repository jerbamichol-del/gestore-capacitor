import { useState, useCallback, useEffect } from 'react';
import { Expense, Account, CATEGORIES } from '../types';
import { useLocalStorage } from './useLocalStorage';
import { DEFAULT_ACCOUNTS } from '../utils/defaults';
import { toYYYYMMDD } from '../utils/date';
import { useRecurringExpenseGenerator } from './useRecurringExpenseGenerator';

export interface ToastMessage { message: string; type: 'success' | 'info' | 'error' }

export function useTransactionsCore(showToast: (msg: ToastMessage) => void) {
    // --- Data State ---
    const [expenses, setExpenses] = useLocalStorage<Expense[]>('expenses_v2', []);
    const [recurringExpenses, setRecurringExpenses] = useLocalStorage<Expense[]>('recurring_expenses_v1', []);
    const [accounts, setAccounts] = useLocalStorage<Account[]>('accounts_v1', DEFAULT_ACCOUNTS);

    const safeAccounts = accounts || [];

    // --- UI State for Deletion ---
    const [isConfirmDeleteModalOpen, setIsConfirmDeleteModalOpen] = useState(false);
    const [expenseToDeleteId, setExpenseToDeleteId] = useState<string | null>(null);
    const [showSuccessIndicator, setShowSuccessIndicator] = useState(false);

    // --- Recurring Generator ---
    // This hook watches expenses/recurringExpenses and adds new ones if needed
    useRecurringExpenseGenerator(expenses, setExpenses, recurringExpenses, setRecurringExpenses);

    // ✅ Listen for external updates (e.g. from BankSyncService Bank reconciliation)
    useEffect(() => {
        const handleRefresh = () => {
            try {
                const stored = localStorage.getItem('expenses_v2');
                if (stored) {
                    setExpenses(JSON.parse(stored));
                }
            } catch (e) {
                console.error('Failed to sync expenses from storage:', e);
            }
        };
        window.addEventListener('expenses-updated', handleRefresh);
        return () => window.removeEventListener('expenses-updated', handleRefresh);
    }, [setExpenses]);

    // --- Helpers ---
    const sanitizeExpenseData = useCallback((data: any, imageBase64?: string): Partial<Omit<Expense, 'id'>> => {
        if (!data) return {};
        let category = data.category || 'Altro';
        if (!CATEGORIES[category]) category = 'Altro';
        let amount = data.amount;
        if (typeof amount === 'string') amount = parseFloat(amount.replace(',', '.'));
        if (typeof amount !== 'number' || isNaN(amount)) amount = 0;

        return {
            type: data.type || 'expense',
            description: data.description || '',
            amount: amount,
            category: category,
            date: data.date || new Date().toISOString().split('T')[0],
            tags: Array.isArray(data.tags) ? data.tags : [],
            receipts: Array.isArray(data.receipts) ? data.receipts : (imageBase64 ? [imageBase64] : []),
            accountId: data.accountId || (safeAccounts.length > 0 ? safeAccounts[0].id : '')
        };
    }, [safeAccounts]);

    // --- Actions ---
    const handleAddExpense = useCallback((data: Omit<Expense, 'id'> | Expense, onSuccess?: () => void) => {
        let finalData = { ...data };
        if (!finalData.type) finalData.type = 'expense';
        const todayStr = toYYYYMMDD(new Date());

        // Normalize single occurrence recurring expense
        if (
            finalData.frequency === 'recurring' &&
            finalData.recurrenceEndType === 'count' &&
            finalData.recurrenceCount === 1 &&
            finalData.date <= todayStr
        ) {
            finalData.frequency = 'single';
            finalData.recurrence = undefined;
            finalData.recurrenceInterval = undefined;
            finalData.recurrenceDays = undefined;
            finalData.recurrenceEndType = undefined;
            finalData.recurrenceEndDate = undefined;
            finalData.recurrenceCount = undefined;
            finalData.monthlyRecurrenceType = undefined;
        }

        if ('id' in finalData) {
            const updatedExpense = finalData as Expense;
            setExpenses(p => p.map(e => e.id === updatedExpense.id ? updatedExpense : e));
            if (updatedExpense.frequency === 'single') {
                setRecurringExpenses(p => p.filter(e => e.id !== updatedExpense.id));
            } else {
                setRecurringExpenses(p => p.map(e => e.id === updatedExpense.id ? updatedExpense : e));
            }
        } else {
            const newItem = { ...finalData, id: crypto.randomUUID() } as Expense;
            if (finalData.frequency === 'recurring') setRecurringExpenses(p => [newItem, ...p]);
            else setExpenses(p => [newItem, ...p]);
        }

        setShowSuccessIndicator(true);
        setTimeout(() => setShowSuccessIndicator(false), 2000);

        if (onSuccess) onSuccess();
    }, [setExpenses, setRecurringExpenses]);

    const handleDeleteRequest = useCallback((id: string) => {
        setExpenseToDeleteId(id);
        setIsConfirmDeleteModalOpen(true);
    }, []);

    const confirmDelete = useCallback(() => {
        if (!expenseToDeleteId) return;
        setExpenses(p => p.filter(e => e.id !== expenseToDeleteId));
        setExpenseToDeleteId(null);
        setIsConfirmDeleteModalOpen(false);
        showToast({ message: 'Spesa eliminata.', type: 'info' });
    }, [expenseToDeleteId, setExpenses, showToast]);

    const deleteExpenses = useCallback((ids: string[]) => {
        if (!ids || ids.length === 0) return;
        setExpenses(p => p.filter(e => !ids.includes(e.id)));
        showToast({ message: `${ids.length} spese eliminate.`, type: 'info' });
    }, [setExpenses, showToast]);

    const deleteRecurringExpenses = useCallback((ids: string[]) => {
        if (!ids || ids.length === 0) return;
        setRecurringExpenses(p => p.filter(e => !ids.includes(e.id)));
        showToast({ message: `${ids.length} ricorrenti eliminate.`, type: 'info' });
    }, [setRecurringExpenses, showToast]);

    return {
        // State
        expenses,
        recurringExpenses,
        accounts: safeAccounts,
        isConfirmDeleteModalOpen,
        setIsConfirmDeleteModalOpen,
        showSuccessIndicator,

        // Setters (exposed for other hooks like useCloudSync)
        setExpenses,
        setRecurringExpenses,
        setAccounts,

        // Actions
        handleAddExpense,
        handleDeleteRequest,
        confirmDelete,
        deleteExpenses,
        deleteRecurringExpenses,
        sanitizeExpenseData
    };
}
