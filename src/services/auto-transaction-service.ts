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

export class AutoTransactionService {

  /**
   * Genera hash univoco per detect duplicati
   */
  static generateTransactionHash(
    amount: number,
    date: string,
    account: string,
    description: string
  ): string {
    const normalized = normalizeForHash(description);
    const key = `${amount.toFixed(2)}-${date}-${account}-${normalized}`;
    return md5(key);
  }

  /**
   * Controlla se transazione già esiste (duplicato)
   */
  static async isDuplicate(hash: string): Promise<boolean> {
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
      data.description
    );

    // Check duplicato
    if (await this.isDuplicate(hash)) {
      console.log('⚠️ Duplicate transaction detected, skipping:', {
        hash,
        description: data.description,
        amount: data.amount,
        source: data.sourceType
      });
      return null;
    }

    const transaction: AutoTransaction = {
      ...data,
      id: crypto.randomUUID(),
      sourceHash: hash,
      status: 'pending',
      createdAt: Date.now()
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
   * Ignora transazione
   */
  static async ignoreTransaction(id: string): Promise<void> {
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
   * Pulisci transazioni vecchie (oltre 30 giorni)
   */
  static async cleanupOldTransactions(): Promise<number> {
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    return await deleteOldAutoTransactions(thirtyDaysAgo);
  }
}
