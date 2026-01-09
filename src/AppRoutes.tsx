import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import AccountsScreen from './screens/AccountsScreen';
import RecurringExpensesScreen from './screens/RecurringExpensesScreen';
import HistoryScreen from './screens/HistoryScreen';
import { useTransactions } from './context/TransactionsContext';
import { useUI } from './context/UIContext';
import { useTheme } from './context/ThemeContext';

interface AppRoutesProps {
    currentEmail: string;
    onLogout: () => void;
    onSync: () => Promise<void> | void;
}

const AppRoutes: React.FC<AppRoutesProps> = ({ currentEmail, onLogout, onSync }) => {
    // Phase 2: Refactor Screens to consume Context incrementally.
    // Dashboard is already Context-aware (mostly).

    return (
        <Routes>
            <Route path="/" element={
                <Dashboard
                    // Action Props
                    onImportFile={() => { }}
                    onSync={onSync}
                    isBalanceVisible={true}
                    onToggleBalanceVisibility={() => { }}
                />
            } />

            <Route path="/accounts" element={
                <AccountsScreen />
            } />

            <Route path="/history" element={
                <HistoryScreen
                    filterType="expense"
                />
            } />

            <Route path="/income" element={
                <HistoryScreen
                    filterType="income"
                />
            } />

            <Route path="/recurring" element={
                <RecurringExpensesScreen />
            } />

            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
};

export default AppRoutes;
