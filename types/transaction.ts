// types/transaction.ts

export type TransactionType = 'expense' | 'income' | 'transfer';
export type TransactionStatus = 'pending' | 'confirmed' | 'ignored';
export type TransactionSource = 'sms' | 'notification' | 'manual';

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
  
  // Tracking duplicati
  sourceType: TransactionSource;
  sourceApp?: string; // 'revolut', 'paypal', etc.
  sourceHash: string; // Hash MD5 per detect duplicati
  rawText: string; // Testo originale SMS/notifica per debug
  
  // Stato
  status: TransactionStatus;
  createdAt: number;
  confirmedAt?: number;
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
