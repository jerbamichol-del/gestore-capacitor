import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Expense } from '../types';

export type ToastMessage = { message: string; type: 'success' | 'info' | 'error' };

type UIContextType = {
    activeTab: 'dashboard' | 'accounts' | 'stats' | 'settings';
    setActiveTab: (tab: 'dashboard' | 'accounts' | 'stats' | 'settings') => void;

    // Modals
    isAddModalOpen: boolean;
    setIsAddModalOpen: (isOpen: boolean) => void;

    // Toast
    toast: ToastMessage | null;
    showToast: (msg: ToastMessage | null) => void;

    // Form Editing State
    editingExpense: Expense | undefined;
    setEditingExpense: (expense: Expense | undefined) => void;
    editingRecurringExpense: Expense | undefined;
    setEditingRecurringExpense: (expense: Expense | undefined) => void;

    isVoiceModalOpen: boolean;
    setIsVoiceModalOpen: (isOpen: boolean) => void;

    isQrModalOpen: boolean;
    setIsQrModalOpen: (isOpen: boolean) => void;

    isCalculatorContainerOpen: boolean;
    setIsCalculatorContainerOpen: (isOpen: boolean) => void;

    isImageSourceModalOpen: boolean;
    setIsImageSourceModalOpen: (isOpen: boolean) => void;

    // History specific
    isHistoryFilterOpen: boolean;
    setIsHistoryFilterOpen: (isOpen: boolean) => void;
};

const UIContext = createContext<UIContextType | undefined>(undefined);

export function UIProvider({ children }: { children: ReactNode }) {
    const [activeTab, setActiveTab] = useState<'dashboard' | 'accounts' | 'stats' | 'settings'>('dashboard');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
    const [isQrModalOpen, setIsQrModalOpen] = useState(false);
    const [isCalculatorContainerOpen, setIsCalculatorContainerOpen] = useState(false);
    const [isImageSourceModalOpen, setIsImageSourceModalOpen] = useState(false);

    const [toast, setToast] = useState<ToastMessage | null>(null);

    const [editingExpense, setEditingExpense] = useState<Expense | undefined>(undefined);
    const [editingRecurringExpense, setEditingRecurringExpense] = useState<Expense | undefined>(undefined);
    const [isHistoryFilterOpen, setIsHistoryFilterOpen] = useState(false);

    return (
        <UIContext.Provider value={{
            activeTab,
            setActiveTab,
            isAddModalOpen,
            setIsAddModalOpen,
            isVoiceModalOpen,
            setIsVoiceModalOpen,
            isQrModalOpen,
            setIsQrModalOpen,
            isCalculatorContainerOpen,
            setIsCalculatorContainerOpen,
            isImageSourceModalOpen,
            setIsImageSourceModalOpen,
            toast,
            showToast: setToast,
            editingExpense,
            setEditingExpense,
            editingRecurringExpense,
            setEditingRecurringExpense,
            isHistoryFilterOpen,
            setIsHistoryFilterOpen
        }}>
            {children}
        </UIContext.Provider>
    );
}

export function useUI() {
    const context = useContext(UIContext);
    if (context === undefined) {
        throw new Error('useUI must be used within a UIProvider');
    }
    return context;
}
