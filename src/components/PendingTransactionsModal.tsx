import React, { useState, useEffect } from 'react';
import { PendingTransaction } from '../services/notification-listener-service';
import { Account, CATEGORIES } from '../types';
import { pickImage, processImageFile } from '../utils/fileHelper';

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
    options?: {
      accountId?: string;
      accountFrom?: string;
      accountTo?: string;
      category?: string;
      subcategory?: string;
      receipts?: string[];
    }
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

function getTextForRules(transaction: PendingTransaction): string {
  const raw = (transaction as any)?.rawNotification;
  const rawTitle = (raw?.title || '').toString();
  const rawText = (raw?.text || '').toString();
  const combined = `${rawTitle} ${rawText}`.replace(/\s+/g, ' ').trim();
  if (combined.length >= 3) return combined;
  return (transaction.description || '').toString();
}

// Extract destinatario from description
function extractDestinatario(description: string): string | null {
  // Pattern: "a [NAME]" or "to [NAME]"
  const match = description.match(/(?:a|to)\s+([^€\n.]+?)(?:\s+è|\s+has|\s+was|\.|$)/i);
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

  // Selected type per transaction
  const [selectedTypes, setSelectedTypes] = useState<Record<string, 'expense' | 'income' | 'transfer'>>({});

  // ✅ Lock manual choice to avoid auto-reset
  const [lockedTypes, setLockedTypes] = useState<Record<string, boolean>>({});

  const [saveRuleFlags, setSaveRuleFlags] = useState<Record<string, boolean>>({});
  const [matchedRules, setMatchedRules] = useState<Record<string, { rule: SavedRule | null; confidence: number }>>({});

  // Accounts for transfers
  const [transferAccounts, setTransferAccounts] = useState<Record<string, { from: string; to: string }>>({});

  // Account for expense/income
  const [accountByTx, setAccountByTx] = useState<Record<string, string>>({});

  // Extra fields for expense only
  const [expenseMetaByTx, setExpenseMetaByTx] = useState<
    Record<string, { category: string; subcategory?: string; receipts: string[] }>
  >({});

  // UX state (step-by-step)
  const [currentIndex, setCurrentIndex] = useState(0);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Load saved rules on mount
  useEffect(() => {
    const rules = loadSavedRules();
    setSavedRules(rules);
  }, []);

  // Reset index when modal opens
  useEffect(() => {
    if (isOpen) setCurrentIndex(0);
  }, [isOpen]);

  // Clamp index when list changes
  useEffect(() => {
    if (!isOpen) return;
    setCurrentIndex((prev) => {
      const max = Math.max(0, transactions.length - 1);
      return Math.min(prev, max);
    });
  }, [isOpen, transactions.length]);

  // Initialize defaults + match rules (NON-DESTRUCTIVE)
  useEffect(() => {
    if (!isOpen || transactions.length === 0) return;

    const nextMatchedRules: Record<string, { rule: SavedRule | null; confidence: number }> = {};

    // Build match map first
    transactions.forEach((transaction) => {
      const textForRules = getTextForRules(transaction);
      nextMatchedRules[transaction.id] = findMatchingRule(transaction.appName, textForRules, savedRules);
    });
    setMatchedRules(nextMatchedRules);

    // Transfer accounts
    setTransferAccounts((prev) => {
      const next = { ...prev };
      transactions.forEach((transaction) => {
        if (next[transaction.id]) return;
        const defaultFrom = accounts[0]?.id || '';
        const defaultTo = accounts.length > 1 ? accounts[1].id : accounts[0]?.id || '';
        next[transaction.id] = { from: defaultFrom, to: defaultTo };
      });
      return next;
    });

    // Account for non-transfer
    setAccountByTx((prev) => {
      const next = { ...prev };
      transactions.forEach((transaction) => {
        if (next[transaction.id]) return;
        next[transaction.id] = accounts[0]?.id || '';
      });
      return next;
    });

    // Expense meta
    setExpenseMetaByTx((prev) => {
      const next = { ...prev };
      transactions.forEach((transaction) => {
        if (next[transaction.id]) return;
        next[transaction.id] = { category: '', subcategory: '', receipts: [] };
      });
      return next;
    });

    // Selected type (respect lock)
    setSelectedTypes((prev) => {
      const next = { ...prev };
      transactions.forEach((transaction) => {
        if (lockedTypes[transaction.id]) return;

        const match = nextMatchedRules[transaction.id];
        if (match?.confidence === 100 && match.rule) {
          next[transaction.id] = match.rule.type;

          // Pre-fill transfer accounts if present
          if (match.rule.type === 'transfer' && match.rule.accountFrom && match.rule.accountTo) {
            setTransferAccounts((prevTA) => ({
              ...prevTA,
              [transaction.id]: { from: match.rule.accountFrom!, to: match.rule.accountTo! },
            }));
          }
          return;
        }

        // Default to detected type
        if (!next[transaction.id]) {
          next[transaction.id] = transaction.type;
        }
      });
      return next;
    });
  }, [isOpen, transactions, savedRules, accounts, lockedTypes]);

  if (!isOpen || transactions.length === 0) return null;

  const currentTransaction = transactions[currentIndex];

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
    setLockedTypes((prev) => ({ ...prev, [transactionId]: true }));
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

  const handleAccountChange = (transactionId: string, accountId: string) => {
    setAccountByTx((prev) => ({ ...prev, [transactionId]: accountId }));
  };

  const handleExpenseCategoryChange = (transactionId: string, category: string) => {
    setExpenseMetaByTx((prev) => ({
      ...prev,
      [transactionId]: {
        ...prev[transactionId],
        category,
        subcategory: '',
      },
    }));
  };

  const handleExpenseSubcategoryChange = (transactionId: string, subcategory: string) => {
    setExpenseMetaByTx((prev) => ({
      ...prev,
      [transactionId]: {
        ...prev[transactionId],
        subcategory,
      },
    }));
  };

  const handlePickReceipt = async (transactionId: string, source: 'camera' | 'gallery') => {
    try {
      const file = await pickImage(source);
      const { base64 } = await processImageFile(file);
      setExpenseMetaByTx((prev) => ({
        ...prev,
        [transactionId]: {
          ...prev[transactionId],
          receipts: [...(prev[transactionId]?.receipts || []), base64],
        },
      }));
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemoveReceipt = (transactionId: string, index: number) => {
    setExpenseMetaByTx((prev) => {
      const current = prev[transactionId];
      const receipts = (current?.receipts || []).filter((_, i) => i !== index);
      return {
        ...prev,
        [transactionId]: { ...current, receipts },
      };
    });
  };

  const handleConfirm = async (transaction: PendingTransaction) => {
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

    setProcessingId(transaction.id);

    // If user wants to save rule, create and save it
    if (saveRule) {
      const destinatario = extractDestinatario(getTextForRules(transaction));
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

    const accountId = accountByTx[transaction.id] || accounts[0]?.id || '';
    const expenseMeta = expenseMetaByTx[transaction.id];

    const options = {
      accountId: selectedType === 'transfer' ? undefined : accountId,
      accountFrom: selectedType === 'transfer' ? transferAccountSelection?.from : undefined,
      accountTo: selectedType === 'transfer' ? transferAccountSelection?.to : undefined,
      category: selectedType === 'expense' ? expenseMeta?.category : undefined,
      subcategory: selectedType === 'expense' ? expenseMeta?.subcategory : undefined,
      receipts: selectedType === 'expense' ? expenseMeta?.receipts || [] : undefined,
    };

    onConfirm(transaction.id, transaction, selectedType, saveRule, options);

    // UX: keep index (after removal the next element will slide into same index)
    setTimeout(() => setProcessingId(null), 250);
  };

  const handleIgnore = async (transactionId: string) => {
    setProcessingId(transactionId);
    onIgnore(transactionId);
    setTimeout(() => setProcessingId(null), 250);
  };

  const handleDeleteRule = (transactionId: string) => {
    const match = matchedRules[transactionId];
    if (!match || !match.rule) return;

    const updatedRules = savedRules.filter((r) => r.id !== match.rule!.id);
    saveSavedRules(updatedRules);
    setSavedRules(updatedRules);

    // Reset to default type (and unlock)
    const transaction = transactions.find((t) => t.id === transactionId);
    if (transaction) {
      setLockedTypes((prev) => ({ ...prev, [transactionId]: false }));
      setSelectedTypes((prev) => ({ ...prev, [transactionId]: transaction.type }));
    }

    // Clear matched rule
    setMatchedRules((prev) => ({ ...prev, [transactionId]: { rule: null, confidence: 0 } }));

    console.log('🗑️ Deleted rule:', match.rule.id);
  };

  const selectedType = selectedTypes[currentTransaction.id] || currentTransaction.type;
  const saveRule = saveRuleFlags[currentTransaction.id] || false;
  const match = matchedRules[currentTransaction.id];
  const transferAccountSelection = transferAccounts[currentTransaction.id];

  const isTransferValid =
    selectedType !== 'transfer' ||
    (transferAccountSelection?.from &&
      transferAccountSelection?.to &&
      transferAccountSelection.from !== transferAccountSelection.to);

  const currentAccountId = accountByTx[currentTransaction.id] || accounts[0]?.id || '';
  const expenseMeta = expenseMetaByTx[currentTransaction.id] || { category: '', subcategory: '', receipts: [] };

  const categoryOptions = Object.keys(CATEGORIES);
  const subcategoryOptions = expenseMeta.category && CATEGORIES[expenseMeta.category] ? CATEGORIES[expenseMeta.category] : [];
  const isSubcategoryDisabled = !expenseMeta.category || expenseMeta.category === 'Altro' || subcategoryOptions.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-xl h-[90vh] sm:h-auto sm:max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 z-10">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Transazioni Rilevate</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex items-center justify-between mt-1">
            <p className="text-sm text-gray-600">
              {transactions.length} {transactions.length === 1 ? 'transazione' : 'transazioni'} da confermare
            </p>
            <p className="text-sm text-gray-500">
              {currentIndex + 1}/{transactions.length}
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            {/* Transaction Info */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-gray-500 uppercase">{currentTransaction.appName}</span>
                  <span className="text-xs text-gray-400">{formatDate(currentTransaction.timestamp)}</span>
                </div>
                <p className="text-sm font-medium text-gray-900 mb-1 leading-relaxed">{currentTransaction.description}</p>
                <p className={`text-lg font-bold ${selectedType === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                  {formatAmount(currentTransaction.amount, currentTransaction.currency)}
                </p>
              </div>
            </div>

            {/* Rule Match Info */}
            {match && match.rule && match.confidence === 100 && (
              <div className="mb-3 p-2 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-xs font-medium text-green-700">
                  ✅ Regola riconosciuta: {match.rule.type === 'transfer' ? 'Trasferimento' : match.rule.type === 'income' ? 'Entrata' : 'Spesa'}
                </p>
                <p className="text-xs text-green-600 mt-0.5">"{match.rule.destinatario}"</p>
              </div>
            )}
            {match && match.rule && match.confidence === 75 && (
              <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-xs font-medium text-yellow-700">⚠️ Possibile corrispondenza</p>
                <p className="text-xs text-yellow-600 mt-0.5">Simile a "{match.rule.destinatario}"</p>
              </div>
            )}

            {/* Type Selection */}
            <div className="mb-3">
              <p className="text-xs font-medium text-gray-700 mb-2">Seleziona tipo:</p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleTypeChange(currentTransaction.id, 'expense')}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${selectedType === 'expense'
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                >
                  💸 Spesa
                </button>
                <button
                  onClick={() => handleTypeChange(currentTransaction.id, 'income')}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${selectedType === 'income'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                >
                  💰 Entrata
                </button>
                <button
                  onClick={() => handleTypeChange(currentTransaction.id, 'transfer')}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${selectedType === 'transfer'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                >
                  🔄 Trasferimento
                </button>
              </div>
            </div>

            {/* Account selection for expense/income */}
            {selectedType !== 'transfer' && (
              <div className="mb-3">
                <p className="text-xs font-medium text-gray-700 mb-2">Seleziona conto:</p>
                <select
                  value={currentAccountId}
                  onChange={(e) => handleAccountChange(currentTransaction.id, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">-- Seleziona conto --</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Transfer Account Selection */}
            {selectedType === 'transfer' && (
              <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs font-medium text-blue-900 mb-2">Seleziona conti:</p>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-blue-700 font-medium block mb-1">Da (origine):</label>
                    <select
                      value={transferAccountSelection?.from || ''}
                      onChange={(e) =>
                        handleTransferAccountChange(currentTransaction.id, 'from', e.target.value)
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

                  <div>
                    <label className="text-xs text-blue-700 font-medium block mb-1">Verso (destinazione):</label>
                    <select
                      value={transferAccountSelection?.to || ''}
                      onChange={(e) =>
                        handleTransferAccountChange(currentTransaction.id, 'to', e.target.value)
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

                  {!isTransferValid && (
                    <p className="text-xs text-red-600 font-medium mt-1">⚠️ I conti devono essere diversi</p>
                  )}
                </div>
              </div>
            )}

            {/* Expense-only fields */}
            {selectedType === 'expense' && (
              <div className="mb-3 p-3 bg-white border border-gray-200 rounded-lg">
                <p className="text-xs font-medium text-gray-900 mb-2">Dettagli spesa:</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-700 font-medium block mb-1">Categoria (opzionale)</label>
                    <select
                      value={expenseMeta.category || ''}
                      onChange={(e) => handleExpenseCategoryChange(currentTransaction.id, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">-- Seleziona categoria --</option>
                      {categoryOptions.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={`text-xs font-medium block mb-1 ${isSubcategoryDisabled ? 'text-gray-400' : 'text-gray-700'}`}>
                      Sottocategoria (opzionale)
                    </label>
                    <select
                      value={expenseMeta.subcategory || ''}
                      disabled={isSubcategoryDisabled}
                      onChange={(e) => handleExpenseSubcategoryChange(currentTransaction.id, e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${isSubcategoryDisabled ? 'border-gray-200 bg-gray-100 text-gray-400' : 'border-gray-300 bg-white'
                        }`}
                    >
                      <option value="">-- Seleziona sottocategoria --</option>
                      {subcategoryOptions.map((sub) => (
                        <option key={sub} value={sub}>
                          {sub}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-3">
                  <p className="text-xs font-medium text-gray-700 mb-2">Ricevute</p>

                  {expenseMeta.receipts?.length > 0 && (
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      {expenseMeta.receipts.map((receipt, index) => (
                        <div
                          key={index}
                          className="relative rounded-lg overflow-hidden border border-gray-200 shadow-sm aspect-video bg-gray-50"
                        >
                          <img
                            src={`data:image/png;base64,${receipt}`}
                            alt="Ricevuta"
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveReceipt(currentTransaction.id, index)}
                            className="absolute top-1 right-1 p-1 bg-white/90 text-red-600 rounded-full shadow-md hover:bg-red-50 hover:text-red-700 transition-colors"
                            aria-label="Rimuovi ricevuta"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handlePickReceipt(currentTransaction.id, 'camera')}
                      className="w-full py-2 px-3 rounded-lg text-sm font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200"
                    >
                      Fotocamera
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePickReceipt(currentTransaction.id, 'gallery')}
                      className="w-full py-2 px-3 rounded-lg text-sm font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200"
                    >
                      Galleria
                    </button>
                  </div>
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
                    onChange={(e) => handleSaveRuleChange(currentTransaction.id, e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Ricorda per il futuro</span>
                </label>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => handleConfirm(currentTransaction)}
                disabled={!isTransferValid || processingId === currentTransaction.id}
                className={`flex-1 font-medium py-2 px-4 rounded-lg transition-colors ${isTransferValid && processingId !== currentTransaction.id
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
              >
                ✓ Conferma
              </button>
              <button
                onClick={() => handleIgnore(currentTransaction.id)}
                disabled={processingId === currentTransaction.id}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
              >
                ✕ Ignora
              </button>
              {match?.rule && (
                <button
                  onClick={() => handleDeleteRule(currentTransaction.id)}
                  className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 font-medium rounded-lg transition-colors"
                  title="Elimina regola salvata"
                >
                  🗑️
                </button>
              )}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              disabled={currentIndex === 0}
              className="flex-1 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
            >
              ← Precedente
            </button>
            <button
              onClick={() => setCurrentIndex((i) => Math.min(transactions.length - 1, i + 1))}
              disabled={currentIndex >= transactions.length - 1}
              className="flex-1 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
            >
              Successiva →
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-3 z-10">
          <button onClick={onClose} className="w-full text-gray-600 text-sm font-medium py-2">
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
