// types/transaction.ts

export type TransactionType = 'expense' | 'income' | 'transfer' | 'adjustment';
export type TransactionStatus = 'pending' | 'confirmed' | 'ignored';
export type TransactionSource = 'sms' | 'notification' | 'manual' | 'bank';
export type ConfirmationType = 'transfer_or_expense' | 'normal';

export interface AutoTransaction {
  id: string;
  type: TransactionType;
  amount: number;
  description: string;
  date: string; // YYYY-MM-DD
  account: string;
  category?: string;

  // Transfer specifico
  toAccount?: string; // Se type='transfer', conto destinazione

  // ✅ NEW: Confirmation required for ambiguous transactions
  requiresConfirmation?: boolean;
  confirmationType?: ConfirmationType;
  linkedTransactionId?: string; // Link to paired transfer transaction

  // Tracking duplicati
  sourceType: TransactionSource;
  sourceApp?: string; // 'revolut', 'paypal', etc.
  sourceHash: string; // Hash MD5 per detect duplicati
  rawText: string; // Testo originale SMS/notifica per debug

  // ✅ Bank API unique ID (entry_reference/transaction_id) - usato per hash stabili
  bankTransactionId?: string;

  // Stato
  status: TransactionStatus;
  createdAt: number;
  confirmedAt?: number;
  validationWarnings?: string[]; // Array di warning generati dal validatore
}

export interface BankConfig {
  name: string;
  identifier: string; // SMS sender o package name
  accountName: string;
  patterns: {
    expense?: RegExp;
    income?: RegExp;
    transfer?: RegExp;
  };
}
