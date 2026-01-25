// services/auto-transaction-service.ts

import {
  addAutoTransaction as dbAddAutoTransaction,
  getAutoTransactions,
  getAutoTransactionByHash,
  getAutoTransactionsByStatus,
  updateAutoTransaction,
  deleteOldAutoTransactions
} from '../utils/db';
import { AutoTransaction } from '../types/transaction';
import { md5, normalizeForHash } from '../utils/hash';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Expense } from '../types';
import { ValidatorService } from './validator-service';

export class AutoTransactionService {
  private static readonly IGNORED_HASHES_KEY = 'auto_transactions_ignored_hashes';

  /**
   * Genera hash univoco per detect duplicati
   */
  /**
   * Genera hash univoco per detect duplicati.
   * ✅ NEW: Supporta bankTransactionId per hash stabili indipendenti dall'account locale.
   */
  static generateTransactionHash(
    amount: number,
    date: string,
    account: string,
    description: string,
    bankTransactionId?: string
  ): string {
    // 1. Stable Bank Hash (Preferred)
    if (bankTransactionId) {
      // Use ONLY the bank transaction ID for maximum stability
      // Prefix with 'bank-' to avoid collisions with legacy hashes
      return md5(`bank-${bankTransactionId}`);
    }

    // 2. Legacy Hash (Fallback for SMS/Notifications or banks without IDs)
    const normalized = normalizeForHash(description);
    const key = `${amount.toFixed(2)}-${date}-${account}-${normalized}`;
    return md5(key);
  }

  /**
   * Get permanently ignored hashes with timestamps
   */
  private static getIgnoredHashes(): Record<string, number> {
    const stored = localStorage.getItem(this.IGNORED_HASHES_KEY);
    return stored ? JSON.parse(stored) : {};
  }

  /**
   * Save a hash to the permanent ignored list
   */
  private static addIgnoredHash(hash: string): void {
    const ignored = this.getIgnoredHashes();
    ignored[hash] = Date.now();
    localStorage.setItem(this.IGNORED_HASHES_KEY, JSON.stringify(ignored));
    console.log(`📌 Hash permanently ignored: ${hash}`);
  }

  /**
   * Check if a hash is in the permanent ignored list
   */
  private static isHashIgnored(hash: string): boolean {
    const ignored = this.getIgnoredHashes();
    return hash in ignored;
  }

  /**
   * Cleanup ignored hashes older than 90 days (API window)
   */
  static cleanupIgnoredHashes(): number {
    const ignored = this.getIgnoredHashes();
    const ninetyDaysAgo = Date.now() - (90 * 24 * 60 * 60 * 1000);
    let removed = 0;

    const filtered: Record<string, number> = {};
    for (const [hash, timestamp] of Object.entries(ignored)) {
      if (timestamp > ninetyDaysAgo) {
        filtered[hash] = timestamp;
      } else {
        removed++;
      }
    }

    localStorage.setItem(this.IGNORED_HASHES_KEY, JSON.stringify(filtered));
    if (removed > 0) {
      console.log(`🧹 Cleaned up ${removed} ignored hashes older than 90 days`);
    }
    return removed;
  }

  /**
   * Controlla se transazione già esiste (duplicato o ignorato permanentemente)
   */
  static async isDuplicate(hash: string): Promise<boolean> {
    // Check permanent ignored list first (faster)
    if (this.isHashIgnored(hash)) {
      console.log(`⏭️ Transaction hash in permanent ignore list, skipping`);
      return true;
    }

    // Check database for existing transactions
    const existing = await getAutoTransactionByHash(hash);
    return existing !== undefined;
  }

  /**
   * Aggiungi transazione automatica (con check duplicati)
   */
  static async addAutoTransaction(
    data: Omit<AutoTransaction, 'id' | 'createdAt' | 'sourceHash' | 'status'>
  ): Promise<AutoTransaction | null> {

    const hash = this.generateTransactionHash(
      data.amount,
      data.date,
      data.account,
      data.description,
      data.bankTransactionId // ✅ Pass unique bank ID if available
    );

    // Check duplicato (Primary Hash)
    if (await this.isDuplicate(hash)) {
      console.log('⚠️ Duplicate transaction detected (Primary Hash), skipping:', { hash, desc: data.description });
      return null;
    }

    // ✅ SAFETY CHECK: If using new Bank Hash, also check Legacy Hash to prevent duplicates with OLD transactions
    if (data.bankTransactionId) {
      const legacyHash = this.generateTransactionHash(data.amount, data.date, data.account, data.description);
      if (await this.isDuplicate(legacyHash)) {
        console.log('⚠️ Duplicate transaction detected (Legacy Hash Match), skipping:', { legacyHash, desc: data.description });
        // We found a match with an old transaction that didn't have the new hash logic.
        // We should treat this as a duplicate.
        // Optional: We could update the old transaction with the new hash/ID here, but skipping is safer/simpler.
        return null;
      }
    }



    // Validate
    const warnings = ValidatorService.validate(data);
    if (warnings.length > 0) {
      console.warn('⚠️ Transaction validation warnings:', warnings);
    }

    const transaction: AutoTransaction = {
      ...data,
      id: crypto.randomUUID(),
      sourceHash: hash,
      status: 'pending', // could force 'review_needed' if we had that status
      createdAt: Date.now(),
      validationWarnings: warnings
    };

    await dbAddAutoTransaction(transaction);

    console.log('✅ New auto transaction added:', transaction);

    // Notifica utente
    await this.notifyNewTransaction(transaction);

    // ✅ NEW: Dispatch custom event for confirmation-required transactions
    if (transaction.requiresConfirmation) {
      const event = new CustomEvent('auto-transaction-confirmation-needed', {
        detail: { transaction }
      });
      window.dispatchEvent(event);
    }

    // ✅ NEW: Dispatch generic update event for UI refresh
    window.dispatchEvent(new CustomEvent('auto-transactions-updated'));

    return transaction;
  }

  /**
   * Notifica nuova transazione rilevata
   */
  static async notifyNewTransaction(tx: AutoTransaction): Promise<void> {
    const emoji = tx.type === 'expense' ? '💸' :
      tx.type === 'income' ? '💰' : '🔄';
    const action = tx.type === 'expense' ? 'Spesa' :
      tx.type === 'income' ? 'Entrata' : 'Trasferimento';

    // ✅ Different notification for confirmation-required transactions
    const title = tx.requiresConfirmation
      ? `${emoji} Transazione da Confermare`
      : `${emoji} ${action} Rilevata`;

    const body = tx.requiresConfirmation
      ? `${tx.description} - €${tx.amount.toFixed(2)} (richiede conferma)`
      : `${tx.description} - €${tx.amount.toFixed(2)}`;

    try {
      await LocalNotifications.schedule({
        notifications: [{
          id: Date.now(),
          title,
          body,
          actionTypeId: 'REVIEW_TRANSACTION',
          extra: { transactionId: tx.id },
          smallIcon: 'ic_stat_notification'
        }]
      });
    } catch (error) {
      console.error('Failed to send notification:', error);
    }
  }

  /**
   * Ottieni tutte le transazioni pending
   */
  static async getPendingTransactions(): Promise<AutoTransaction[]> {
    const pending = await getAutoTransactionsByStatus('pending');
    return pending.sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * ✅ NEW: Update transaction type (for transfer confirmation)
   */
  static async updateTransactionType(
    id: string,
    newType: 'expense' | 'income' | 'transfer'
  ): Promise<void> {
    await updateAutoTransaction(id, { type: newType });
    console.log(`✅ Transaction ${id} type updated to ${newType}`);
    window.dispatchEvent(new CustomEvent('auto-transactions-updated'));
  }

  /**
   * ✅ NEW: Confirm transaction without requiring expense creation callback
   * (Used by TransferConfirmationModal)
   */
  static async confirmTransaction(id: string): Promise<void> {
    await updateAutoTransaction(id, {
      status: 'confirmed',
      confirmedAt: Date.now(),
      requiresConfirmation: false
    });
    console.log('✅ Transaction confirmed:', id);
    window.dispatchEvent(new CustomEvent('auto-transactions-updated'));
  }

  /**
   * Conferma transazione → crea expense/income/transfer reale
   * (Legacy method - kept for backward compatibility with PendingTransactionsModal)
   */
  static async confirmTransactionWithCallback(
    id: string,
    createExpenseFn: (data: Omit<Expense, 'id'>) => void
  ): Promise<void> {
    const allTransactions = await getAutoTransactions();
    const tx = allTransactions.find(t => t.id === id);

    if (!tx) {
      throw new Error('Transaction not found');
    }

    if (tx.type === 'transfer') {
      await this.createTransfer(tx, createExpenseFn);
    } else {
      await this.createExpenseOrIncome(tx, createExpenseFn);
    }

    // Aggiorna stato
    await updateAutoTransaction(id, {
      status: 'confirmed',
      confirmedAt: Date.now()
    });

    console.log('✅ Transaction confirmed:', id);
  }

  /**
   * Ignora transazione e salva hash permanentemente
   */
  static async ignoreTransaction(id: string): Promise<void> {
    // Get transaction to extract hash
    const allTransactions = await getAutoTransactions();
    const tx = allTransactions.find(t => t.id === id);

    if (tx) {
      // Add hash to permanent ignored list
      this.addIgnoredHash(tx.sourceHash);
    }

    await updateAutoTransaction(id, {
      status: 'ignored',
      confirmedAt: Date.now()
    });
    console.log('⏭️ Transaction ignored:', id);
    window.dispatchEvent(new CustomEvent('auto-transactions-updated'));
  }

  /**
   * Crea trasferimento tra account (non spesa/entrata)
   */
  private static async createTransfer(
    tx: AutoTransaction,
    createExpenseFn: (data: Omit<Expense, 'id'>) => void
  ): Promise<void> {
    if (!tx.toAccount) {
      throw new Error('Transfer requires toAccount');
    }

    // Sottrai da account sorgente
    createExpenseFn({
      type: 'expense',
      amount: tx.amount,
      description: `Trasferimento → ${tx.toAccount}`,
      date: tx.date,
      accountId: tx.account,
      category: 'Trasferimenti',
      notes: `Auto-rilevato da ${tx.sourceType}`,
      tags: ['transfer', 'auto']
    } as any);

    // Aggiungi a account destinazione
    createExpenseFn({
      type: 'income',
      amount: tx.amount,
      description: `Trasferimento ← ${tx.account}`,
      date: tx.date,
      accountId: tx.toAccount,
      category: 'Trasferimenti',
      notes: `Auto-rilevato da ${tx.sourceType}`,
      tags: ['transfer', 'auto']
    } as any);
  }

  /**
   * Crea expense o income normale
   */
  private static async createExpenseOrIncome(
    tx: AutoTransaction,
    createExpenseFn: (data: Omit<Expense, 'id'>) => void
  ): Promise<void> {
    createExpenseFn({
      type: tx.type as 'expense' | 'income',
      amount: tx.amount,
      description: tx.description,
      date: tx.date,
      accountId: tx.account,
      category: tx.category || 'Da Categorizzare',
      notes: `Auto-rilevato da ${tx.sourceType}`,
      tags: ['auto']
    } as any);
  }

  /**
   * Ottieni statistiche transazioni auto
   */
  static async getStats(): Promise<{
    pending: number;
    confirmed: number;
    ignored: number;
    total: number;
  }> {
    const all = await getAutoTransactions();

    return {
      pending: all.filter(t => t.status === 'pending').length,
      confirmed: all.filter(t => t.status === 'confirmed').length,
      ignored: all.filter(t => t.status === 'ignored').length,
      total: all.length
    };
  }

  /**
   * Pulisci transazioni vecchie (oltre 30 giorni) e hash ignorati oltre 90 giorni
   */
  static async cleanupOldTransactions(): Promise<number> {
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const deletedTx = await deleteOldAutoTransactions(thirtyDaysAgo);
    const deletedHashes = this.cleanupIgnoredHashes();

    console.log(`🧹 Cleanup complete: ${deletedTx} old transactions, ${deletedHashes} old ignored hashes`);
    return deletedTx;
  }

  /**
   * Crea una rettifica (adjustment) direttamente nelle spese confermate
   */
  static async addAdjustment(accountId: string, amount: number, description: string): Promise<void> {
    const expenses: Expense[] = JSON.parse(localStorage.getItem('expenses_v2') || '[]');

    const adjustment: Expense = {
      id: crypto.randomUUID(),
      type: 'adjustment',
      amount: amount,
      description: description,
      date: new Date().toISOString().split('T')[0],
      accountId: accountId,
      category: 'Altro',
      tags: ['auto', 'reconciliation']
    };

    expenses.unshift(adjustment);
    localStorage.setItem('expenses_v2', JSON.stringify(expenses));

    console.log('✅ Automatic balance adjustment added:', adjustment);

    // Dispatch both events to refresh pending count and confirmed balance/patrimonio
    window.dispatchEvent(new CustomEvent('auto-transactions-updated'));
    window.dispatchEvent(new CustomEvent('expenses-updated'));
  }
}
