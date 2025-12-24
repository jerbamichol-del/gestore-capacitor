// src/components/PendingTransactionsModal.tsx

import React from 'react';
import { PendingTransaction } from '../services/notification-listener-service';

interface PendingTransactionsModalProps {
  isOpen: boolean;
  transactions: PendingTransaction[];
  onClose: () => void;
  onConfirm: (id: string, transaction: PendingTransaction) => void;
  onIgnore: (id: string) => void;
}

export function PendingTransactionsModal({
  isOpen,
  transactions,
  onClose,
  onConfirm,
  onIgnore,
}: PendingTransactionsModalProps) {
  if (!isOpen || transactions.length === 0) return null;

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('it-IT', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatAmount = (amount: number, currency: string) => {
    return `${currency} ${amount.toFixed(2)}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              Transazioni Rilevate
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            {transactions.length} {transactions.length === 1 ? 'transazione' : 'transazioni'} da confermare
          </p>
        </div>

        {/* Transactions List */}
        <div className="overflow-y-auto max-h-[calc(80vh-140px)] px-6 py-4">
          <div className="space-y-3">
            {transactions.map((transaction) => (
              <div
                key={transaction.id}
                className="bg-gray-50 rounded-lg p-4 border border-gray-200"
              >
                {/* Transaction Info */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-gray-500 uppercase">
                        {transaction.appName}
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatDate(transaction.timestamp)}
                      </span>
                    </div>
                    <p className="text-base font-medium text-gray-900 mb-1">
                      {transaction.description}
                    </p>
                    <p className="text-lg font-bold text-red-600">
                      {formatAmount(transaction.amount, transaction.currency)}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => onConfirm(transaction.id, transaction)}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                  >
                    ✓ Conferma
                  </button>
                  <button
                    onClick={() => onIgnore(transaction.id)}
                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-2 px-4 rounded-lg transition-colors"
                  >
                    ✕ Ignora
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-3">
          <button
            onClick={onClose}
            className="w-full text-gray-600 text-sm font-medium py-2"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}

// Badge component for showing pending count
interface PendingBadgeProps {
  count: number;
  onClick: () => void;
}

export function PendingTransactionsBadge({ count, onClick }: PendingBadgeProps) {
  if (count === 0) return null;

  return (
    <button
      onClick={onClick}
      className="relative inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-full shadow-lg transition-all hover:shadow-xl"
    >
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
      <span className="text-sm">
        {count} {count === 1 ? 'transazione' : 'transazioni'}
      </span>
      <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-xs font-bold">
        {count}
      </span>
    </button>
  );
}
