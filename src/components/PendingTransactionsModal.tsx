import React, { useState, useEffect } from 'react';
import { PendingTransaction } from '../services/notification-listener-service';
import { Account, Expense } from '../types';
import { pickImage, processImageFile } from '../utils/fileHelper';
import { CategoryService } from '../services/category-service';
import { DeduplicationService } from '../services/deduplication-service';
import { toYYYYMMDD } from '../utils/date';

// Type for pending transaction types (excludes 'adjustment' which is system-only)
type PendingTransactionType = 'expense' | 'income' | 'transfer';

// Helper to safely get transaction type for UI (defaults to 'expense' if 'adjustment')
const getUITransactionType = (type: string): PendingTransactionType => {
  if (type === 'expense' || type === 'income' || type === 'transfer') {
    return type;
  }
  return 'expense'; // Default for 'adjustment' or any other unexpected type
};

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
  accounts: Account[];
  expenses: Expense[];
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
  onIgnoreAll?: () => void;
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
      return { rule, confidence: 100 };
    }

    // PARTIAL match - surname only (75%)
    const tokens = dest.split(' ');
    const cognome = tokens.length > 1 ? tokens[tokens.length - 1] : null;
    if (cognome && cognome.length > 3 && desc.includes(cognome)) {
      return { rule, confidence: 75 };
    }
  }

  return { rule: null, confidence: 0 };
}

export function PendingTransactionsModal({
  isOpen,
  transactions,
  accounts,
  expenses,
  onClose,
  onConfirm,
  onIgnore,
  onIgnoreAll,
}: PendingTransactionsModalProps) {
  const [savedRules, setSavedRules] = useState<SavedRule[]>([]);
  const [categoriesList, setCategoriesList] = useState<any[]>([]);

  // Load categories
  useEffect(() => {
    const load = () => setCategoriesList(CategoryService.getCategories());
    load();
    window.addEventListener('categories-updated', load);
    return () => window.removeEventListener('categories-updated', load);
  }, []);

  // Selected type per transaction
  const [selectedTypes, setSelectedTypes] = useState<Record<string, 'expense' | 'income' | 'transfer'>>({});

  // ✅ Lock manual choice to avoid auto-reset
  const [lockedTypes, setLockedTypes] = useState<Record<string, boolean>>({});

  const [saveRuleFlags, setSaveRuleFlags] = useState<Record<string, boolean>>({});
  const [matchedRules, setMatchedRules] = useState<Record<string, { rule: SavedRule | null; confidence: number }>>({});
  const [recurringMatches, setRecurringMatches] = useState<Record<string, Expense | null>>({});

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
    const nextRecurringMatches: Record<string, Expense | null> = {};

    // Build match maps
    transactions.forEach((transaction) => {
      const textForRules = getTextForRules(transaction);
      nextMatchedRules[transaction.id] = findMatchingRule(transaction.sourceApp || 'Note', textForRules, savedRules);

      // Check for recurring match using DeduplicationService
      // Need to construct a mock BankTransaction
      const bankTx = {
        description: transaction.description,
        amount: transaction.amount,
        date: toYYYYMMDD(new Date(transaction.createdAt))
      };

      const recurringMatch = DeduplicationService.findMatchingRecurringExpense(bankTx, expenses);
      nextRecurringMatches[transaction.id] = recurringMatch;
    });

    setMatchedRules(nextMatchedRules);
    setRecurringMatches(nextRecurringMatches);

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

        // Default to detected type (safely cast to UI type)
        if (!next[transaction.id]) {
          next[transaction.id] = getUITransactionType(transaction.type);
        }
      });
      return next;
    });
  }, [isOpen, transactions, savedRules, accounts, lockedTypes, expenses]);

  if (!isOpen || transactions.length === 0) return null;

  // Ensure currentIndex is within valid range
  if (currentIndex >= transactions.length) return null;

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
    const selectedType = selectedTypes[transaction.id] || getUITransactionType(transaction.type);
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
          appName: transaction.sourceApp || 'Sconosciuto',
          destinatario: destinatario.toLowerCase().trim(),
          type: getUITransactionType(selectedType),
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

  const selectedType = selectedTypes[currentTransaction.id] || getUITransactionType(currentTransaction.type);
  const saveRule = saveRuleFlags[currentTransaction.id] || false;
  const match = matchedRules[currentTransaction.id];
  const recurringMatch = recurringMatches[currentTransaction.id];
  const transferAccountSelection = transferAccounts[currentTransaction.id];

  // Duplicate check (only if NO recurring match found - because recurring match IS a duplicate we want to link)
  const duplicateCandidate = !recurringMatch ? expenses.find(e =>
    e.amount === currentTransaction.amount &&
    (Math.abs(new Date(e.date + ' ' + (e.time || '00:00')).getTime() - currentTransaction.createdAt) < 2 * 60 * 60 * 1000 || // Within 2 hours
      e.date === toYYYYMMDD(new Date(currentTransaction.createdAt)))
  ) : null;

  const isTransferValid =
    selectedType !== 'transfer' ||
    (transferAccountSelection?.from &&
      transferAccountSelection?.to &&
      transferAccountSelection.from !== transferAccountSelection.to);

  const currentAccountId = accountByTx[currentTransaction.id] || accounts[0]?.id || '';
  const expenseMeta = expenseMetaByTx[currentTransaction.id] || { category: '', subcategory: '', receipts: [] };

  const categoryOptions = categoriesList.map(c => c.name);
  const selectedCatObj = categoriesList.find(c => c.name === expenseMeta.category);
  const subcategoryOptions = selectedCatObj ? selectedCatObj.subcategories : [];
  const isSubcategoryDisabled = !expenseMeta.category || subcategoryOptions.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-midnight/80 backdrop-blur-md transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Modal - Full screen on mobile, centered on desktop */}
      <div className="relative w-full sm:max-w-lg midnight-card sm:rounded-3xl shadow-2xl h-full sm:h-auto sm:max-h-[85vh] overflow-hidden flex flex-col border border-white/10 dark:border-electric-violet/20 animate-slide-up-fade">
        {/* Header */}
        <div className="sticky top-0 bg-white/5 dark:bg-black/20 backdrop-blur-md border-b border-white/5 dark:border-white/5 px-6 py-4 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                Transazioni Rilevate
              </h2>
              <p className="text-sm text-slate-500 dark:text-gray-400 mt-0.5">
                {transactions.length} {transactions.length === 1 ? 'da verificare' : 'da verificare'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-slate-400 dark:text-slate-400 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Progress Bar */}
          <div className="mt-4 h-1 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-sunset-orange to-sunset-pink dark:from-electric-blue dark:to-electric-purple transition-all duration-300 ease-out"
              style={{ width: `${((currentIndex + 1) / transactions.length) * 100}%` }}
            />
          </div>
          <div className="text-right mt-1">
            <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
              {currentIndex + 1} di {transactions.length}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700">

          {/* Main Card */}
          <div className="bg-white/50 dark:bg-white/5 backdrop-blur-sm rounded-2xl p-5 border border-slate-200/50 dark:border-white/10 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow duration-300">
            {/* Background Glow */}
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-32 h-32 bg-sunset-peach/30 dark:bg-electric-violet/20 rounded-full blur-3xl group-hover:bg-sunset-peach/40 dark:group-hover:bg-electric-violet/30 transition-all duration-500" />

            {/* Transaction Info */}
            <div className="relative z-10">
              <div className="flex items-start justify-between mb-2">
                <span className="inline-flex items-center px-2 py-1 rounded-md bg-slate-100 dark:bg-white/10 text-[10px] font-bold tracking-wider uppercase text-slate-600 dark:text-slate-300">
                  {currentTransaction.sourceApp || 'APP'}
                </span>
                <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                  {formatDate(currentTransaction.createdAt)}
                </span>
              </div>

              <p className="text-base font-medium text-slate-800 dark:text-slate-100 mb-2 leading-relaxed">
                {currentTransaction.description}
              </p>

              <div className="flex items-baseline gap-1">
                <span className={`text-3xl font-bold tracking-tight ${selectedType === 'income' ? 'text-emerald-500 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
                  {formatAmount(currentTransaction.amount, '€')}
                </span>
                {selectedType === 'income' && <span className="text-xs font-medium text-emerald-600 dark:text-emerald-500 bg-emerald-100 dark:bg-emerald-500/20 px-1.5 py-0.5 rounded">Entrata</span>}
              </div>
            </div>
          </div>

          {/* Smart Matches & Insights */}
          <div className="mt-4 space-y-3">

            {/* 🔗 Recurring Match Found */}
            {recurringMatch && (
              <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-sky-900/20 dark:to-indigo-900/20 border border-blue-100 dark:border-sky-500/30 flex items-start gap-3 relative overflow-hidden">
                <div className="absolute inset-0 bg-grid-slate-200/50 dark:bg-grid-slate-700/20 [mask-image:linear-gradient(to_bottom,white,transparent)]" />
                <div className="p-2 bg-white dark:bg-sky-500/20 rounded-lg text-blue-600 dark:text-sky-400 relative z-10">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                </div>
                <div className="relative z-10 flex-1">
                  <h3 className="text-sm font-bold text-blue-900 dark:text-sky-100">Scadenza Ricorrente Trovata</h3>
                  <p className="text-xs text-blue-700 dark:text-sky-300 mt-1">
                    Questa spesa sembra essere <b>{recurringMatch.description}</b> prevista per il {recurringMatch.date}.
                  </p>
                  <p className="text-xs font-medium text-blue-800 dark:text-sky-200 mt-2">
                    Verrà collegata automaticamente invece di creare un duplicato.
                  </p>
                </div>
              </div>
            )}

            {/* Rule Match Info */}
            {!recurringMatch && match && match.rule && match.confidence === 100 && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/30 rounded-xl flex items-center gap-3">
                <div className="p-1.5 bg-emerald-100 dark:bg-emerald-500/20 rounded-full text-emerald-600 dark:text-emerald-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">Regola Applicata</p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400/80">
                    Riconosciuto come <b>{match.rule.type === 'transfer' ? 'Trasferimento' : match.rule.type === 'income' ? 'Entrata' : 'Spesa'}</b> per "{match.rule.destinatario}"
                  </p>
                </div>
              </div>
            )}

            {/* Warning: Possible Duplicate */}
            {duplicateCandidate && (
              <div className="p-3 bg-red-50 dark:bg-rose-900/20 border border-red-100 dark:border-rose-800/50 rounded-xl flex items-start gap-3">
                <div className="p-1.5 bg-red-100 dark:bg-rose-500/20 rounded-full text-red-600 dark:text-rose-400 mt-0.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-bold text-red-800 dark:text-rose-300">Possibile Duplicato</p>
                  <p className="text-xs text-red-600 dark:text-rose-400/80 mt-1">
                    Esiste già una spesa simile di <b>{formatAmount(duplicateCandidate.amount, '€')}</b> del {duplicateCandidate.date}.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 space-y-6">

            {/* Type Selector (Segmented Control) */}
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 ml-1 mb-2 block uppercase tracking-wider">Tipo Transazione</label>
              <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-white/5 rounded-xl">
                {(['expense', 'income', 'transfer'] as const).map((type) => {
                  const isSelected = selectedType === type;
                  return (
                    <button
                      key={type}
                      onClick={() => handleTypeChange(currentTransaction.id, type)}
                      className={`py-2 px-2 text-sm font-medium rounded-lg transition-all duration-200 ${isSelected
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                        }`}
                    >
                      {type === 'expense' && '💸 Spesa'}
                      {type === 'income' && '💰 Entrata'}
                      {type === 'transfer' && '🔄 Giroconto'}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Account Selector */}
            {selectedType !== 'transfer' && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 ml-1 block uppercase tracking-wider">Conto</label>
                <div className="relative">
                  <select
                    value={currentAccountId}
                    onChange={(e) => handleAccountChange(currentTransaction.id, e.target.value)}
                    className="w-full appearance-none bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-xl px-4 py-3 pr-10 focus:outline-none focus:ring-2 focus:ring-electric-violet/50 transition-shadow"
                  >
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id} className="dark:bg-slate-800">
                        {account.name}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
            )}

            {/* Transfer Fields */}
            {selectedType === 'transfer' && (
              <div className="p-4 bg-blue-50/50 dark:bg-sky-900/10 border border-blue-100 dark:border-sky-500/20 rounded-2xl space-y-4">
                <div className="grid grid-cols-[1fr,auto,1fr] gap-2 items-center">
                  {/* From */}
                  <div className="bg-white dark:bg-white/5 border border-blue-200/50 dark:border-white/10 rounded-xl p-2">
                    <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Da</p>
                    <select
                      value={transferAccountSelection?.from || ''}
                      onChange={(e) => handleTransferAccountChange(currentTransaction.id, 'from', e.target.value)}
                      className="w-full bg-transparent text-sm font-medium text-slate-900 dark:text-white focus:outline-none p-0"
                    >
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id} className="dark:bg-slate-800">{account.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Arrow */}
                  <div className="text-blue-400 dark:text-sky-500/50">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </div>

                  {/* To */}
                  <div className="bg-white dark:bg-white/5 border border-blue-200/50 dark:border-white/10 rounded-xl p-2">
                    <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Verso</p>
                    <select
                      value={transferAccountSelection?.to || ''}
                      onChange={(e) => handleTransferAccountChange(currentTransaction.id, 'to', e.target.value)}
                      className="w-full bg-transparent text-sm font-medium text-slate-900 dark:text-white focus:outline-none p-0"
                    >
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id} className="dark:bg-slate-800">{account.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {!isTransferValid && (
                  <p className="text-xs text-red-500 font-medium text-center">⚠️ Seleziona due conti diversi</p>
                )}
              </div>
            )}

            {/* Expense Fields */}
            {selectedType === 'expense' && (
              <div className="space-y-4 pt-2">
                {/* Category Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-500 dark:text-slate-400 ml-1 block uppercase tracking-wider">Categoria</label>
                    <div className="relative">
                      <select
                        value={expenseMeta.category || ''}
                        onChange={(e) => handleExpenseCategoryChange(currentTransaction.id, e.target.value)}
                        className="w-full appearance-none bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-electric-violet/50"
                      >
                        <option value="" className="text-slate-400">Seleziona...</option>
                        {categoryOptions.map((cat) => (
                          <option key={cat} value={cat} className="dark:bg-slate-800">{cat}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-500 dark:text-slate-400 ml-1 block uppercase tracking-wider">Sottocategoria</label>
                    <div className="relative">
                      <select
                        value={expenseMeta.subcategory || ''}
                        disabled={isSubcategoryDisabled}
                        onChange={(e) => handleExpenseSubcategoryChange(currentTransaction.id, e.target.value)}
                        className={`w-full appearance-none border rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-electric-violet/50 ${isSubcategoryDisabled
                          ? 'bg-slate-100 dark:bg-white/5 border-transparent text-slate-400'
                          : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white'
                          }`}
                      >
                        <option value="">Opzionale</option>
                        {subcategoryOptions.map((sub) => (
                          <option key={sub} value={sub} className="dark:bg-slate-800">{sub}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Receipts */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-slate-500 dark:text-slate-400 ml-1 uppercase tracking-wider">Ricevute</label>
                    <div className="flex gap-2">
                      <button onClick={() => handlePickReceipt(currentTransaction.id, 'camera')} className="p-1.5 bg-indigo-50 dark:bg-white/10 rounded-lg text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-white/20 transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      </button>
                      <button onClick={() => handlePickReceipt(currentTransaction.id, 'gallery')} className="p-1.5 bg-purple-50 dark:bg-white/10 rounded-lg text-purple-600 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-white/20 transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      </button>
                    </div>
                  </div>

                  {expenseMeta.receipts?.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                      {expenseMeta.receipts.map((receipt, index) => (
                        <div key={index} className="relative flex-shrink-0 w-24 h-16 rounded-lg overflow-hidden border border-slate-200 dark:border-white/10 group">
                          <img src={`data:image/png;base64,${receipt}`} alt="Receipt" className="w-full h-full object-cover" />
                          <button
                            onClick={() => handleRemoveReceipt(currentTransaction.id, index)}
                            className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Save Rule Toggle */}
            {(!match?.rule && !recurringMatch) && (
              <div className="flex items-center gap-3 py-2">
                <div className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
                  <input
                    type="checkbox"
                    name="toggle"
                    id={`toggle-${currentTransaction.id}`}
                    className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer checked:right-0 checked:border-electric-violet"
                    checked={saveRule}
                    onChange={(e) => handleSaveRuleChange(currentTransaction.id, e.target.checked)}
                    style={{ right: saveRule ? '0' : 'auto', left: saveRule ? 'auto' : '0' }}
                  />
                  <label
                    htmlFor={`toggle-${currentTransaction.id}`}
                    className={`toggle-label block overflow-hidden h-5 rounded-full cursor-pointer transition-colors ${saveRule ? 'bg-electric-violet' : 'bg-slate-300 dark:bg-slate-700'}`}
                  ></label>
                </div>
                <label htmlFor={`toggle-${currentTransaction.id}`} className="text-sm text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                  Ricorda questa regola
                </label>
              </div>
            )}

          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t border-slate-200/50 dark:border-white/10 bg-slate-50/50 dark:bg-black/20 backdrop-blur-md p-4">
          <div className="flex gap-3">
            <button
              onClick={() => handleIgnore(currentTransaction.id)}
              disabled={processingId === currentTransaction.id}
              className="flex-1 py-3.5 px-4 rounded-xl font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-white/5 transition-colors"
            >
              Ignora
            </button>
            <button
              onClick={() => handleConfirm(currentTransaction)}
              disabled={!isTransferValid || processingId === currentTransaction.id}
              className={`flex-[2] py-3.5 px-4 rounded-xl font-bold shadow-lg shadow-electric-violet/20 flex items-center justify-center gap-2 transition-all transform active:scale-[0.98] ${isTransferValid && processingId !== currentTransaction.id
                // If recurring match -> different color/text to signify Link
                ? recurringMatch
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-indigo-500/30'
                  : 'bg-gradient-to-r from-sunset-orange to-sunset-pink dark:from-electric-violet dark:to-electric-purple text-white hover:brightness-110'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed shadow-none'
                }`}
            >
              {processingId === currentTransaction.id ? (
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <>
                  {recurringMatch ? (
                    <>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                      Collega & Conferma
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      Conferma
                    </>
                  )}
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

export function PendingTransactionsBadge({ count, onClick }: { count: number; onClick: () => void }) {
  if (count <= 0) return null;
  return (
    <button
      onClick={onClick}
      className="relative p-2 text-slate-400 hover:text-slate-500 transition-colors"
    >
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
      <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white dark:ring-midnight">
        {count}
      </span>
    </button>
  );
}
