import { useState, useEffect, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { useNotificationListener } from './useNotificationListener';
import { useSMSListener } from './useSMSListener';
import { AutoTransaction } from '../types/transaction';
import { NotificationTransactionParser } from '../services/notification-transaction-parser';
import { PendingTransaction } from '../services/notification-listener-service';
import { Account, Expense } from '../types';
import { toYYYYMMDD } from '../utils/date';

export type PendingConfirmOptions = {
    accountId?: string;
    accountFrom?: string;
    accountTo?: string;
    category?: string;
    subcategory?: string;
    receipts?: string[];
};

export interface ToastMessage { message: string; type: 'success' | 'info' | 'error' }

export function useAutoFlow(
    accounts: Account[],
    handleAddExpense: (data: Omit<Expense, 'id'> | Expense) => void,
    showToast: (msg: ToastMessage) => void
) {
    // --- Modals State ---
    const [isPendingTransactionsModalOpen, setIsPendingTransactionsModalOpen] = useState(false);
    const [isNotificationPermissionModalOpen, setIsNotificationPermissionModalOpen] = useState(false);
    const [isTransferConfirmationModalOpen, setIsTransferConfirmationModalOpen] = useState(false);

    // Logic for transfers
    const [currentConfirmationTransaction, setCurrentConfirmationTransaction] = useState<AutoTransaction | null>(null);

    // --- Listeners ---
    const {
        pendingTransactions,
        pendingCount,
        isEnabled: isNotificationListenerEnabled,
        requestPermission: requestNotificationPermission,
        confirmTransaction,
        ignoreTransaction,
    } = useNotificationListener();

    const {
        isEnabled: isSMSReaderEnabled,
        requestPermission: requestSMSPermission,
        manualCheckPermission: manualCheckSMSPermission,
    } = useSMSListener();

    // --- Handlers ---

    const handleConfirmTransaction = useCallback(async (
        id: string,
        transaction: PendingTransaction,
        selectedType: 'expense' | 'income' | 'transfer',
        saveRule: boolean,
        options?: PendingConfirmOptions
    ) => {
        try {
            // ✅ Fix: use createdAt (timestamp property does not exist on AutoTransaction)
            const dt = new Date(transaction.createdAt);
            const date = toYYYYMMDD(dt);
            const time = dt.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

            // Find matching account (fallback)
            let fallbackAccountId = accounts[0]?.id || '';
            const matchingAccount = accounts.find(
                acc => acc.name.toLowerCase().includes((transaction.sourceApp || '').toLowerCase())
            );
            if (matchingAccount) {
                fallbackAccountId = matchingAccount.id;
            }

            // Handle TRANSFER type
            if (selectedType === 'transfer') {
                const accountFrom = options?.accountFrom;
                const accountTo = options?.accountTo;

                if (!accountFrom || !accountTo) {
                    showToast({ message: 'Seleziona entrambi i conti per il trasferimento.', type: 'error' });
                    return;
                }

                if (accountFrom === accountTo) {
                    showToast({ message: 'I conti devono essere diversi.', type: 'error' });
                    return;
                }

                await confirmTransaction(id);

                const destinationAccountName = accounts.find(a => a.id === accountTo)?.name || 'Conto Destinazione';

                const transferTx: Omit<Expense, 'id'> = {
                    type: 'transfer',
                    description: `Trasferimento → ${destinationAccountName}`,
                    amount: transaction.amount,
                    date,
                    time,
                    category: 'Trasferimenti',
                    accountId: accountFrom,
                    toAccountId: accountTo,
                    tags: ['auto-rilevata', 'transfer', transaction.sourceApp || 'auto'],
                    receipts: [],
                    frequency: 'single',
                };

                handleAddExpense(transferTx);
                showToast({ message: 'Trasferimento registrato!', type: 'success' });

            } else {
                await confirmTransaction(id);

                const accountId = options?.accountId || fallbackAccountId;

                const newTx: Omit<Expense, 'id'> = {
                    description: transaction.description,
                    amount: transaction.amount,
                    date,
                    time,
                    category: selectedType === 'expense' ? (options?.category || 'Altro') : 'Altro',
                    subcategory: selectedType === 'expense' ? (options?.subcategory || undefined) : undefined,
                    accountId,
                    type: selectedType,
                    tags: ['auto-rilevata', transaction.sourceApp || 'auto'],
                    receipts: selectedType === 'expense' ? (options?.receipts || []) : [],
                    frequency: 'single',
                };

                handleAddExpense(newTx);
                showToast({ message: 'Transazione confermata e aggiunta!', type: 'success' });
            }

        } catch (error) {
            console.error('Error confirming transaction:', error);
            showToast({ message: 'Errore durante la conferma.', type: 'error' });
        }
    }, [accounts, confirmTransaction, handleAddExpense, showToast]);

    const handleConfirmAsTransfer = useCallback(async (fromAccount: string, toAccount: string) => {
        if (!currentConfirmationTransaction) return;

        try {
            console.log(`✅ Confirming as transfer: ${fromAccount} → ${toAccount}`);

            await NotificationTransactionParser.confirmAsTransfer(
                currentConfirmationTransaction.id,
                fromAccount,
                toAccount,
                currentConfirmationTransaction.amount,
                currentConfirmationTransaction.date
            );

            const destinationAccountName = accounts.find(a => a.id === toAccount)?.name || 'Conto Destinazione';

            const transferTx: Omit<Expense, 'id'> = {
                type: 'transfer',
                amount: currentConfirmationTransaction.amount,
                description: `Trasferimento → ${destinationAccountName}`,
                date: currentConfirmationTransaction.date,
                accountId: fromAccount,
                toAccountId: toAccount,
                category: 'Trasferimenti',
                tags: ['transfer', 'auto'],
                receipts: [],
                frequency: 'single'
            };

            handleAddExpense(transferTx);

            showToast({ message: 'Trasferimento registrato correttamente!', type: 'success' });
            setIsTransferConfirmationModalOpen(false);
            setCurrentConfirmationTransaction(null);

        } catch (error) {
            console.error('❌ Error confirming transfer:', error);
            showToast({ message: 'Errore durante il trasferimento.', type: 'error' });
        }
    }, [accounts, currentConfirmationTransaction, handleAddExpense, showToast]);

    const handleConfirmAsExpense = useCallback(async () => {
        if (!currentConfirmationTransaction) return;

        try {
            console.log(`✅ Confirming as regular expense`);

            await NotificationTransactionParser.confirmAsExpense(currentConfirmationTransaction.id);

            let accountId = accounts[0]?.id || '';
            const matchingAccount = accounts.find(
                acc => acc.name.toLowerCase() === currentConfirmationTransaction.account.toLowerCase()
            );
            if (matchingAccount) {
                accountId = matchingAccount.id;
            }

            const newExpense: Omit<Expense, 'id'> = {
                type: 'expense',
                amount: currentConfirmationTransaction.amount,
                description: currentConfirmationTransaction.description,
                date: currentConfirmationTransaction.date,
                accountId: accountId,
                category: currentConfirmationTransaction.category || 'Da Categorizzare',
                tags: ['auto'],
                receipts: [],
                frequency: 'single'
            };

            handleAddExpense(newExpense);

            showToast({ message: 'Spesa registrata correttamente!', type: 'success' });
            setIsTransferConfirmationModalOpen(false);
            setCurrentConfirmationTransaction(null);

        } catch (error) {
            console.error('❌ Error confirming expense:', error);
            showToast({ message: 'Errore durante la conferma.', type: 'error' });
        }
    }, [accounts, currentConfirmationTransaction, handleAddExpense, showToast]);

    const handleIgnoreTransaction = useCallback(async (id: string) => {
        try {
            await ignoreTransaction(id);
            showToast({ message: 'Transazione ignorata.', type: 'info' });
        } catch (error) {
            console.error('Error ignoring transaction:', error);
            showToast({ message: 'Errore durante l\'ignora.', type: 'error' });
        }
    }, [ignoreTransaction, showToast]);

    const handleIgnoreAllTransactions = useCallback(async () => {
        try {
            const count = pendingTransactions.length;
            for (const tx of pendingTransactions) {
                await ignoreTransaction(tx.id);
            }
            showToast({ message: `${count} transazioni ignorate.`, type: 'info' });
            setIsPendingTransactionsModalOpen(false);
        } catch (error) {
            console.error('Error ignoring all transactions:', error);
            showToast({ message: 'Errore durante l\'ignora.', type: 'error' });
        }
    }, [pendingTransactions, ignoreTransaction, showToast]);

    // --- Effects ---

    // Listen for confirmation needed events
    useEffect(() => {
        const handleConfirmationNeeded = (event: any) => {
            const { transaction } = event.detail;
            console.log('🚨 Transfer confirmation needed:', transaction);
            setCurrentConfirmationTransaction(transaction);
            setIsTransferConfirmationModalOpen(true);
        };
        window.addEventListener('auto-transaction-confirmation-needed', handleConfirmationNeeded);
        return () => {
            window.removeEventListener('auto-transaction-confirmation-needed', handleConfirmationNeeded);
        };
    }, []);

    // Request Notification Permission on Android
    const hasShownPermissionModalRef = useRef(false);
    useEffect(() => {
        if (Capacitor.getPlatform() === 'android' && !isNotificationListenerEnabled) {
            const dismissedForever = localStorage.getItem('notification_permission_dismissed_forever');
            const hasAskedBefore = localStorage.getItem('has_asked_notification_permission');

            if (!dismissedForever && !hasAskedBefore && !hasShownPermissionModalRef.current) {
                hasShownPermissionModalRef.current = true;
                setTimeout(() => {
                    setIsNotificationPermissionModalOpen(true);
                    localStorage.setItem('has_asked_notification_permission', 'true');
                }, 3000);
            }
        }
    }, [isNotificationListenerEnabled]);

    // Request SMS Permission on Android
    useEffect(() => {
        if (Capacitor.getPlatform() !== 'android') return;
        if (isSMSReaderEnabled) return;

        const hasAskedBefore = localStorage.getItem('has_asked_sms_permission');
        if (hasAskedBefore) return;

        setTimeout(async () => {
            try {
                console.log('📩 Asking SMS permission (first run)...');
                await requestSMSPermission();
                await manualCheckSMSPermission();
            } finally {
                localStorage.setItem('has_asked_sms_permission', 'true');
            }
        }, 3000);
    }, [isSMSReaderEnabled, requestSMSPermission, manualCheckSMSPermission]);

    // Transfer Confirmation Handling
    const currentConfirmationId = currentConfirmationTransaction?.id;

    // ✅ CRITICAL FIX: Filter out the transaction being confirmed in the Transfer Modal
    // This prevents PendingTransactionsModal from showing the same transaction (overlap/duplication).
    // If it's the only transaction, PendingTransactionsModal effectively won't render/open for it.
    const effectivePendingTransactions = pendingTransactions.filter(
        t => t.id !== currentConfirmationId
    );
    const effectivePendingCount = effectivePendingTransactions.length;

    // Auto-open modal on new pending (using filtered count)
    useEffect(() => {
        // Always reopen if there are pending transactions and we are on a relevant screen
        // We only check effectivePendingCount > 0.
        // This ensures if the ONLY pending item is a Transfer (which opens its own modal),
        // we do NOT open PendingTransactionsModal (as effective count is 0).

        if (effectivePendingCount > 0 && !isPendingTransactionsModalOpen) {
            console.log('📬 Pending transactions detected (filtered), opening modal.');
            setIsPendingTransactionsModalOpen(true);
        }
    }, [effectivePendingCount]); // Check ONLY when filtered count changes

    // Also listen for resume/update events specifically to force check
    useEffect(() => {
        const handleForceCheck = () => {
            if (effectivePendingCount > 0 && !isPendingTransactionsModalOpen) {
                setIsPendingTransactionsModalOpen(true);
            }
        };
        window.addEventListener('auto-transactions-updated', handleForceCheck);
        return () => window.removeEventListener('auto-transactions-updated', handleForceCheck);
    }, [effectivePendingCount, isPendingTransactionsModalOpen]);

    return {
        // State
        pendingTransactions: effectivePendingTransactions, // Return FILTERED transactions to UI
        pendingCount: effectivePendingCount,
        isPendingTransactionsModalOpen,
        setIsPendingTransactionsModalOpen,
        isNotificationPermissionModalOpen,
        setIsNotificationPermissionModalOpen,
        isTransferConfirmationModalOpen,
        setIsTransferConfirmationModalOpen,
        currentConfirmationTransaction,
        setCurrentConfirmationTransaction,

        // Permissions
        isNotificationListenerEnabled,
        requestNotificationPermission,
        isSMSReaderEnabled,
        requestSMSPermission,

        // Handlers
        handleConfirmTransaction,
        handleConfirmAsTransfer,
        handleConfirmAsExpense,
        handleIgnoreTransaction,
        handleIgnoreAllTransactions
    };
}
