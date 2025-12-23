// components/PendingTransactionsModal.tsx

import React, { useEffect, useState } from 'react';
import { AutoTransaction } from '../types/transaction';
import { AutoTransactionService } from '../services/auto-transaction-service';
import { Expense } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAddExpense: (data: Omit<Expense, 'id'>) => void;
}

const PendingTransactionsModal: React.FC<Props> = ({ isOpen, onClose, onAddExpense }) => {
  const [transactions, setTransactions] = useState<AutoTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadTransactions();
    }
  }, [isOpen]);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const pending = await AutoTransactionService.getPendingTransactions();
      setTransactions(pending);
    } catch (error) {
      console.error('Error loading pending transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (id: string) => {
    setProcessingId(id);
    try {
      await AutoTransactionService.confirmTransaction(id, onAddExpense);
      await loadTransactions();
    } catch (error) {
      console.error('Error confirming transaction:', error);
      alert('Errore durante la conferma');
    } finally {
      setProcessingId(null);
    }
  };

  const handleIgnore = async (id: string) => {
    setProcessingId(id);
    try {
      await AutoTransactionService.ignoreTransaction(id);
      await loadTransactions();
    } catch (error) {
      console.error('Error ignoring transaction:', error);
    } finally {
      setProcessingId(null);
    }
  };

  if (!isOpen) return null;

  const getSourceIcon = (sourceType: string, sourceApp?: string) => {
    if (sourceType === 'sms') return '💬';
    if (sourceType === 'notification') return '🔔';
    return '📱';
  };

  const getTypeEmoji = (type: string) => {
    if (type === 'expense') return '💸';
    if (type === 'income') return '💰';
    if (type === 'transfer') return '🔄';
    return '💵';
  };

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[90vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-slate-900">Transazioni Rilevate</h2>
            {transactions.length > 0 && (
              <span className="bg-indigo-100 text-indigo-700 text-sm font-semibold px-3 py-1 rounded-full">
                {transactions.length}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-3xl font-light leading-none"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">✅</div>
              <p className="text-slate-600 text-lg">Nessuna transazione in attesa</p>
              <p className="text-slate-400 text-sm mt-2">Le nuove transazioni rilevate appariranno qui</p>
            </div>
          ) : (
            <div className="space-y-4">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="bg-slate-50 rounded-xl p-5 border border-slate-200 hover:border-indigo-300 transition-colors"
                >
                  {/* Transaction Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{getTypeEmoji(tx.type)}</span>
                      <div>
                        <h3 className="font-semibold text-slate-900 text-lg">
                          {tx.description}
                        </h3>
                        <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                          <span>{getSourceIcon(tx.sourceType, tx.sourceApp)}</span>
                          <span className="capitalize">{tx.sourceApp || tx.sourceType}</span>
                          <span>•</span>
                          <span>{new Date(tx.createdAt).toLocaleString('it-IT', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-2xl font-bold ${
                        tx.type === 'expense' ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {tx.type === 'expense' ? '-' : '+'}€{tx.amount.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {/* Transaction Details */}
                  <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                    <div>
                      <span className="text-slate-500">Account:</span>
                      <span className="ml-2 font-medium text-slate-700">{tx.account}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Data:</span>
                      <span className="ml-2 font-medium text-slate-700">
                        {new Date(tx.date).toLocaleDateString('it-IT')}
                      </span>
                    </div>
                    {tx.category && (
                      <div className="col-span-2">
                        <span className="text-slate-500">Categoria:</span>
                        <span className="ml-2 font-medium text-slate-700">{tx.category}</span>
                      </div>
                    )}
                    {tx.toAccount && (
                      <div className="col-span-2">
                        <span className="text-slate-500">Verso:</span>
                        <span className="ml-2 font-medium text-slate-700">{tx.toAccount}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleConfirm(tx.id)}
                      disabled={processingId === tx.id}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      {processingId === tx.id ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      ) : (
                        <>
                          <span>✓</span>
                          <span>Conferma</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleIgnore(tx.id)}
                      disabled={processingId === tx.id}
                      className="flex-1 bg-slate-200 hover:bg-slate-300 disabled:bg-slate-100 text-slate-700 font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      {processingId === tx.id ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-slate-600"></div>
                      ) : (
                        <>
                          <span>✕</span>
                          <span>Ignora</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {transactions.length > 0 && (
          <div className="p-6 border-t border-slate-200 bg-slate-50">
            <p className="text-sm text-slate-600 text-center">
              💡 Le transazioni confermate verranno aggiunte alla tua cronologia
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PendingTransactionsModal;
