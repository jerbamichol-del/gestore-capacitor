// src/components/PendingTransactionsModal.tsx

import React, { useState, useEffect } from 'react';
import { PendingTransaction } from '../services/notification-listener-service';
import { Account } from '../../types';

// Saved rule for auto-categorization
interface SavedRule {
  id: string;
  appName: string;
  destinatario: string; // normalized (lowercase, trimmed)
  type: 'expense' | 'income' | 'transfer';
  accountFrom?: string; // for transfers
  accountTo?: string; // for transfers
  createdAt: number;
}

interface PendingTransactionsModalProps {
  isOpen: boolean;
  transactions: PendingTransaction[];
  accounts: Account[]; // NEW: account list
  onClose: () => void;
  onConfirm: (
    id: string,
    transaction: PendingTransaction,
    selectedType: 'expense' | 'income' | 'transfer',
    saveRule: boolean,
    accountFrom?: string, // NEW: for transfers
    accountTo?: string // NEW: for transfers
  ) => void;
  onIgnore: (id: string) => void;
}

const RULES_STORAGE_KEY = 'transaction_type_rules';

// Load saved rules from localStorage
function loadSavedRules(): SavedRule[] {
  try {
    const stored = localStorage.getItem(RULES_STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (error) {
    console.error('Failed to load saved rules:', error);
    return [];
  }
}

// Save rules to localStorage
function saveSavedRules(rules: SavedRule[]): void {
  try {
    localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(rules));
  } catch (error) {
    console.error('Failed to save rules:', error);
  }
}

// Extract destinatario from description
function extractDestinatario(description: string): string | null {
  // Pattern: "a [NAME]" or "to [NAME]"
  const match = description.match(/(?:a|to)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i);
  if (match && match[1]) {
    return match[1].trim();
  }
  return null;
}

// Find matching rule with confidence level
function findMatchingRule(
  appName: string,
  description: string,
  rules: SavedRule[]
): { rule: SavedRule | null; confidence: number } {
  const desc = description.toLowerCase().trim();

  for (const rule of rules) {
    if (rule.appName.toLowerCase() !== appName.toLowerCase()) continue;

    const dest = rule.destinatario.toLowerCase();

    // EXACT match (100%)
    if (desc.includes(dest)) {
      console.log(`✅ Exact rule match: ${dest}`);
      return { rule, confidence: 100 };
    }

    // PARTIAL match - surname only (75%)
    const tokens = dest.split(' ');
    const cognome = tokens.length > 1 ? tokens[tokens.length - 1] : null;
    if (cognome && cognome.length > 3 && desc.includes(cognome)) {
      console.log(`⚠️ Partial rule match: ${cognome}`);
      return { rule, confidence: 75 };
    }
  }

  return { rule: null, confidence: 0 };
}

export function PendingTransactionsModal({
  isOpen,
  transactions,
  accounts,
  onClose,
  onConfirm,
  onIgnore,
}: PendingTransactionsModalProps) {
  const [savedRules, setSavedRules] = useState<SavedRule[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<Record<string, 'expense' | 'income' | 'transfer'>>({});
  const [saveRuleFlags, setSaveRuleFlags] = useState<Record<string, boolean>>({});
  const [matchedRules, setMatchedRules] = useState<Record<string, { rule: SavedRule | null; confidence: number }>>({});
  
  // NEW: Account selections for transfers
  const [transferAccounts, setTransferAccounts] = useState<Record<string, { from: string; to: string }>>({});

  // Load saved rules on mount
  useEffect(() => {
    const rules = loadSavedRules();
    setSavedRules(rules);
  }, []);

  // Initialize selected types and match rules when transactions change
  useEffect(() => {
    if (!isOpen || transactions.length === 0) return;

    const newSelectedTypes: Record<string, 'expense' | 'income' | 'transfer'> = {};
    const newMatchedRules: Record<string, { rule: SavedRule | null; confidence: number }> = {};
    const newTransferAccounts: Record<string, { from: string; to: string }> = {};

    transactions.forEach((transaction) => {
      // Try to find matching rule
      const match = findMatchingRule(transaction.appName, transaction.description, savedRules);
      newMatchedRules[transaction.id] = match;

      // If exact match (100%), pre-select type from rule
      if (match.confidence === 100 && match.rule) {
        newSelectedTypes[transaction.id] = match.rule.type;
        
        // If rule has saved accounts for transfer, pre-fill them
        if (match.rule.type === 'transfer' && match.rule.accountFrom && match.rule.accountTo) {
          newTransferAccounts[transaction.id] = {
            from: match.rule.accountFrom,
            to: match.rule.accountTo,
          };
        } else {
          // Default accounts
          const defaultFrom = accounts[0]?.id || '';
          const defaultTo = accounts.length > 1 ? accounts[1].id : accounts[0]?.id || '';
          newTransferAccounts[transaction.id] = { from: defaultFrom, to: defaultTo };
        }
      } else {
        // Default: use transaction's detected type
        newSelectedTypes[transaction.id] = transaction.type;
        
        // Initialize default transfer accounts
        const defaultFrom = accounts[0]?.id || '';
        const defaultTo = accounts.length > 1 ? accounts[1].id : accounts[0]?.id || '';
        newTransferAccounts[transaction.id] = { from: defaultFrom, to: defaultTo };
      }
    });

    setSelectedTypes(newSelectedTypes);
    setMatchedRules(newMatchedRules);
    setTransferAccounts(newTransferAccounts);
  }, [isOpen, transactions, savedRules, accounts]);

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

  const handleTypeChange = (transactionId: string, type: 'expense' | 'income' | 'transfer') => {
    setSelectedTypes((prev) => ({ ...prev, [transactionId]: type }));
  };

  const handleSaveRuleChange = (transactionId: string, checked: boolean) => {
    setSaveRuleFlags((prev) => ({ ...prev, [transactionId]: checked }));
  };

  const handleTransferAccountChange = (
    transactionId: string,
    direction: 'from' | 'to',
    accountId: string
  ) => {
    setTransferAccounts((prev) => ({
      ...prev,
      [transactionId]: {
        ...prev[transactionId],
        [direction]: accountId,
      },
    }));
  };

  const handleConfirm = (transaction: PendingTransaction) => {
    const selectedType = selectedTypes[transaction.id] || transaction.type;
    const saveRule = saveRuleFlags[transaction.id] || false;
    const transferAccountSelection = transferAccounts[transaction.id];

    // Validate transfer accounts
    if (selectedType === 'transfer') {
      if (!transferAccountSelection || !transferAccountSelection.from || !transferAccountSelection.to) {
        alert('Seleziona entrambi i conti per il trasferimento.');
        return;
      }
      if (transferAccountSelection.from === transferAccountSelection.to) {
        alert('Il conto di origine e destinazione devono essere diversi.');
        return;
      }
    }

    // If user wants to save rule, create and save it
    if (saveRule) {
      const destinatario = extractDestinatario(transaction.description);
      if (destinatario) {
        const newRule: SavedRule = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          appName: transaction.appName,
          destinatario: destinatario.toLowerCase().trim(),
          type: selectedType,
          createdAt: Date.now(),
        };

        // Save account info for transfers
        if (selectedType === 'transfer' && transferAccountSelection) {
          newRule.accountFrom = transferAccountSelection.from;
          newRule.accountTo = transferAccountSelection.to;
        }

        const updatedRules = [...savedRules, newRule];
        saveSavedRules(updatedRules);
        setSavedRules(updatedRules);
        console.log('✅ Saved new rule:', newRule);
      }
    }

    // Pass account info to handler
    onConfirm(
      transaction.id,
      transaction,
      selectedType,
      saveRule,
      selectedType === 'transfer' ? transferAccountSelection?.from : undefined,
      selectedType === 'transfer' ? transferAccountSelection?.to : undefined
    );
  };

  const handleDeleteRule = (transactionId: string) => {
    const match = matchedRules[transactionId];
    if (!match || !match.rule) return;

    const updatedRules = savedRules.filter((r) => r.id !== match.rule!.id);
    saveSavedRules(updatedRules);
    setSavedRules(updatedRules);

    // Reset to default type
    const transaction = transactions.find((t) => t.id === transactionId);
    if (transaction) {
      setSelectedTypes((prev) => ({ ...prev, [transactionId]: transaction.type }));
    }

    // Clear matched rule
    setMatchedRules((prev) => ({ ...prev, [transactionId]: { rule: null, confidence: 0 } }));

    console.log('🗑️ Deleted rule:', match.rule.id);
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
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 z-10">
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
          <div className="space-y-4">
            {transactions.map((transaction) => {
              const selectedType = selectedTypes[transaction.id] || transaction.type;
              const saveRule = saveRuleFlags[transaction.id] || false;
              const match = matchedRules[transaction.id];
              const transferAccountSelection = transferAccounts[transaction.id];
              const isTransferValid =
                selectedType !== 'transfer' ||
                (transferAccountSelection?.from &&
                  transferAccountSelection?.to &&
                  transferAccountSelection.from !== transferAccountSelection.to);

              return (
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
                      <p className="text-sm font-medium text-gray-900 mb-1 leading-relaxed">
                        {transaction.description}
                      </p>
                      <p className="text-lg font-bold text-red-600">
                        {formatAmount(transaction.amount, transaction.currency)}
                      </p>
                    </div>
                  </div>

                  {/* Rule Match Info */}
                  {match && match.rule && match.confidence === 100 && (
                    <div className="mb-3 p-2 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-xs font-medium text-green-700">
                        ✅ Regola riconosciuta: {match.rule.type === 'transfer' ? 'Trasferimento' : match.rule.type === 'income' ? 'Entrata' : 'Spesa'}
                      </p>
                      <p className="text-xs text-green-600 mt-0.5">
                        "{match.rule.destinatario}"
                      </p>
                    </div>
                  )}
                  {match && match.rule && match.confidence === 75 && (
                    <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-xs font-medium text-yellow-700">
                        ⚠️ Possibile corrispondenza
                      </p>
                      <p className="text-xs text-yellow-600 mt-0.5">
                        Simile a "{match.rule.destinatario}"
                      </p>
                    </div>
                  )}

                  {/* Type Selection */}
                  <div className="mb-3">
                    <p className="text-xs font-medium text-gray-700 mb-2">Seleziona tipo:</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleTypeChange(transaction.id, 'expense')}
                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                          selectedType === 'expense'
                            ? 'bg-red-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        💸 Spesa
                      </button>
                      <button
                        onClick={() => handleTypeChange(transaction.id, 'income')}
                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                          selectedType === 'income'
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        💰 Entrata
                      </button>
                      <button
                        onClick={() => handleTypeChange(transaction.id, 'transfer')}
                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                          selectedType === 'transfer'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        🔄 Trasferimento
                      </button>
                    </div>
                  </div>

                  {/* Transfer Account Selection */}
                  {selectedType === 'transfer' && (
                    <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-xs font-medium text-blue-900 mb-2">Seleziona conti:</p>
                      <div className="space-y-2">
                        {/* From Account */}
                        <div>
                          <label className="text-xs text-blue-700 font-medium block mb-1">
                            Da (origine):
                          </label>
                          <select
                            value={transferAccountSelection?.from || ''}
                            onChange={(e) =>
                              handleTransferAccountChange(transaction.id, 'from', e.target.value)
                            }
                            className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="">-- Seleziona conto --</option>
                            {accounts.map((account) => (
                              <option key={account.id} value={account.id}>
                                {account.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* To Account */}
                        <div>
                          <label className="text-xs text-blue-700 font-medium block mb-1">
                            Verso (destinazione):
                          </label>
                          <select
                            value={transferAccountSelection?.to || ''}
                            onChange={(e) =>
                              handleTransferAccountChange(transaction.id, 'to', e.target.value)
                            }
                            className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="">-- Seleziona conto --</option>
                            {accounts.map((account) => (
                              <option key={account.id} value={account.id}>
                                {account.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Validation Warning */}
                        {!isTransferValid && (
                          <p className="text-xs text-red-600 font-medium mt-1">
                            ⚠️ I conti devono essere diversi
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Save Rule Checkbox */}
                  {!match?.rule && (
                    <div className="mb-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={saveRule}
                          onChange={(e) => handleSaveRuleChange(transaction.id, e.target.checked)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">Ricorda per il futuro</span>
                      </label>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleConfirm(transaction)}
                      disabled={!isTransferValid}
                      className={`flex-1 font-medium py-2 px-4 rounded-lg transition-colors ${
                        isTransferValid
                          ? 'bg-blue-600 hover:bg-blue-700 text-white'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      ✓ Conferma
                    </button>
                    <button
                      onClick={() => onIgnore(transaction.id)}
                      className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-2 px-4 rounded-lg transition-colors"
                    >
                      ✕ Ignora
                    </button>
                    {match?.rule && (
                      <button
                        onClick={() => handleDeleteRule(transaction.id)}
                        className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 font-medium rounded-lg transition-colors"
                        title="Elimina regola salvata"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-3 z-10">
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
