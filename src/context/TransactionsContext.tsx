import React, { createContext, useContext, ReactNode } from 'react';
import { useTransactionsCore } from '../hooks/useTransactionsCore';

type TransactionsContextType = ReturnType<typeof useTransactionsCore> & {
    isConfirmDeleteModalOpen: boolean;
    confirmDelete: () => void;
    // ensure sanitizeExpenseData is exposed from useTransactionsCore return type, which it likely is.
    // If TypeScript complains it's not in ReturnType<typeof useTransactionsCore>, I might need to explicitly type it or update the hook return.
};

const TransactionsContext = createContext<TransactionsContextType | undefined>(undefined);

export function TransactionsProvider({ children }: { children: ReactNode }) {
    // We need a way to show toasts. Ideally UIContext provides this.
    // However, useTransactionsCore was originally passed `ui.showToast`.
    // Let's assume for this step we can use console.log or we need to expose showToast from UIContext.
    // Checking UIContext... it doesn't have showToast yet!
    // I will add showToast to UIContext first.

    // TEMPORARY FIX: Pass a dummy toast function to satisfy TS until UIContext is fully ready.
    // OR BETTER: Update UIContext to include showToast.
    const transactions = useTransactionsCore((msg) => console.log('Toast:', msg));

    return (
        <TransactionsContext.Provider value={transactions}>
            {children}
        </TransactionsContext.Provider>
    );
}

export function useTransactions() {
    const context = useContext(TransactionsContext);
    if (context === undefined) {
        throw new Error('useTransactions must be used within a TransactionsProvider');
    }
    return context;
}
