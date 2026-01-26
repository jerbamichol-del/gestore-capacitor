// components/TransferConfirmationModal.tsx

import React, { useState, useEffect } from 'react';
import { AutoTransaction } from '../types/transaction';
import { NotificationTransactionParser } from '../services/notification-transaction-parser';
import { Account } from '../types';

interface Props {
  isOpen: boolean;
  transaction: AutoTransaction | null;
  accounts: Account[];
  onClose: () => void;
  onConfirmAsTransfer: (fromAccount: string, toAccount: string) => void;
  onConfirmAsExpense: () => void;
}

const TransferConfirmationModal: React.FC<Props> = ({
  isOpen,
  transaction,
  accounts,
  onClose,
  onConfirmAsTransfer,
  onConfirmAsExpense
}) => {
  const [selectedToAccount, setSelectedToAccount] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Auto-detect possible destination account from merchant name
  useEffect(() => {
    if (!transaction) return;

    const merchantLower = (transaction.description || '').toLowerCase();
    const matchingAccount = accounts.find(acc =>
      merchantLower.includes(acc.name.toLowerCase())
    );

    if (matchingAccount) {
      setSelectedToAccount(matchingAccount.id);
    } else if (accounts.length > 0) {
      // Default to first account that's NOT the source account
      const otherAccount = accounts.find(acc => acc.name !== transaction.account);
      setSelectedToAccount(otherAccount?.id || accounts[0].id);
    }
  }, [transaction, accounts]);

  if (!isOpen || !transaction) return null;

  const handleTransferConfirm = async () => {
    if (!selectedToAccount) {
      alert('Seleziona un conto di destinazione');
      return;
    }

    setIsProcessing(true);
    try {
      const toAccountName = accounts.find(a => a.id === selectedToAccount)?.name || selectedToAccount;
      onConfirmAsTransfer(transaction.account, toAccountName);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExpenseConfirm = async () => {
    setIsProcessing(true);
    try {
      onConfirmAsExpense();
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-slate-900/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="midnight-card rounded-t-3xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[85vh] flex flex-col shadow-2xl transition-colors duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🤔</span>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Trasferimento o Spesa?</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Questa transazione potrebbe essere un trasferimento tra i tuoi conti</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="text-slate-400 hover:text-slate-600 text-3xl font-light leading-none disabled:opacity-50"
          >
            ×
          </button>
        </div>

        {/* Transaction Info */}
        <div className="p-4 border-b border-slate-200 dark:border-electric-violet/20 bg-[var(--sunset-cream, #F2F4F2)] dark:bg-midnight-card/50">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">Da</div>
              <div className="text-lg font-semibold text-slate-900 dark:text-white">{transaction.account}</div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-red-600 dark:text-red-400">-€{transaction.amount.toFixed(2)}</div>
              <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">{new Date(transaction.date).toLocaleDateString('it-IT')}</div>
            </div>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-900/30 rounded-lg p-3">
            <div className="flex items-start gap-3">
              <span className="text-xl">🏦</span>
              <div>
                <div className="font-semibold text-yellow-900 dark:text-yellow-400 mb-1">Possibile trasferimento rilevato</div>
                <div className="text-sm text-yellow-700 dark:text-yellow-500">Il beneficiario “<span className="font-medium">{transaction.description}</span>” sembra essere un altro tuo conto.</div>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Option 1: Transfer */}
          <div className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 border-2 border-indigo-200 dark:border-indigo-800/50 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">🔄</span>
              <div>
                <h3 className="text-lg font-bold text-indigo-900 dark:text-indigo-300">Trasferimento tra conti</h3>
                <p className="text-sm text-indigo-700 dark:text-indigo-400">Hai spostato denaro tra i tuoi conti</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Verso quale conto?
                </label>
                <select
                  value={selectedToAccount}
                  onChange={(e) => setSelectedToAccount(e.target.value)}
                  disabled={isProcessing}
                  className="w-full px-4 py-3 bg-sunset-cream/60 dark:bg-midnight-card/50 border border-slate-300 dark:border-electric-violet/30 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:focus:ring-electric-violet focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 dark:text-white"
                >
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} {acc.name === transaction.account && '(sorgente)'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="midnight-card rounded-lg p-4 border border-indigo-200 dark:border-electric-violet/30">
                <div className="text-sm text-slate-600 dark:text-slate-400 mb-2 font-medium">Verrà registrato:</div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-700 dark:text-slate-300">• Uscita da <span className="font-semibold">{transaction.account}</span></span>
                    <span className="text-red-600 dark:text-red-400 font-semibold">-€{transaction.amount.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-700 dark:text-slate-300">• Entrata su <span className="font-semibold">{accounts.find(a => a.id === selectedToAccount)?.name || 'conto selezionato'}</span></span>
                    <span className="text-green-600 dark:text-green-400 font-semibold">+€{transaction.amount.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleTransferConfirm}
                disabled={isProcessing || !selectedToAccount}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white font-semibold py-4 rounded-lg transition-colors flex items-center justify-center gap-2 text-lg"
              >
                {isProcessing ? (
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                ) : (
                  <>
                    <span>✅</span>
                    <span>Conferma come Trasferimento</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Option 2: Normal Expense */}
          <div className="bg-gradient-to-br from-slate-50 to-gray-50 dark:from-slate-800 dark:to-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">💸</span>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Spesa normale</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">Hai pagato un servizio/prodotto</p>
              </div>
            </div>

            <div className="midnight-card rounded-lg p-4 border border-slate-200 dark:border-electric-violet/20 mb-4">
              <div className="text-sm text-slate-600 dark:text-slate-400 mb-2 font-medium">Verrà registrato:</div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-700 dark:text-slate-300">Spesa su <span className="font-semibold">{transaction.account}</span></span>
                <span className="text-red-600 dark:text-red-400 font-semibold">-€{transaction.amount.toFixed(2)}</span>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                Beneficiario: <span className="font-medium">{transaction.description}</span>
              </div>
            </div>

            <button
              onClick={handleExpenseConfirm}
              disabled={isProcessing}
              className="w-full bg-slate-600 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white font-semibold py-4 rounded-lg transition-colors flex items-center justify-center gap-2 text-lg"
            >
              {isProcessing ? (
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
              ) : (
                <>
                  <span>✔️</span>
                  <span>Conferma come Spesa</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200 dark:border-electric-violet/20 bg-[var(--sunset-cream, #F2F4F2)] dark:bg-midnight-card/50 rounded-b-2xl">
          <p className="text-sm text-slate-600 dark:text-slate-400 text-center">
            💡 <span className="font-medium">Suggerimento:</span> I trasferimenti creano due movimenti linkati per mantenere i saldi corretti su entrambi i conti
          </p>
        </div>
      </div>
    </div>
  );
};

export default TransferConfirmationModal;
