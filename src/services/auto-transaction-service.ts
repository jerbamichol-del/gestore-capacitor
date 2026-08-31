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
import { DeduplicationService } from './deduplication-service';
import { AutoConfirmService } from './auto-confirm-service';

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
  static addIgnoredHash(hash: string): void {
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
   * Aggiungi transazione automatica (con check duplicati).
   *
   * Con opts.autoConfirm la transazione viene registrata direttamente nelle spese
   * quando è affidabile (dati bancari con identificatore stabile):
   *  - collegata a una spesa già generata da una ricorrenza → quest'ultima viene
   *    marcata come confermata dalla banca (nessun nuovo movimento);
   *  - possibile giroconto tra conti propri → resta in coda di revisione;
   *  - altrimenti → spesa/entrata creata subito, categoria dalle regole apprese
   *    o "Da Categorizzare".
   */
  static async addAutoTransaction(
    data: Omit<AutoTransaction, 'id' | 'createdAt' | 'sourceHash' | 'status'>,
    opts: { autoConfirm?: boolean } = {}
  ): Promise<AutoTransaction | null> {

    const hash = this.generateTransactionHash(
      data.amount,
      data.date,
      data.account,
      data.description,
      data.bankTransactionId // ✅ Pass unique bank ID if available
    );

    // Permanent ignore list always wins
    if (this.isHashIgnored(hash)) {
      console.log('⏭️ Transaction hash in permanent ignore list, skipping');
      return null;
    }

    // Check duplicato (Primary Hash)
    const existing = await getAutoTransactionByHash(hash);
    if (existing) {
      // Upgrade path: a bank transaction left pending by older builds gets
      // auto-registered now that auto mode is enabled.
      if (opts.autoConfirm && existing.status === 'pending' && existing.sourceType === 'bank') {
        const upgrade = await this.tryAutoRegister(existing);
        if (upgrade.registered) {
          await updateAutoTransaction(existing.id, {
            status: 'confirmed',
            confirmedAt: Date.now(),
            autoConfirmed: true,
            autoOutcome: upgrade.reason
          });
          console.log(`⏫ Upgraded pending bank transaction to auto-confirmed (${upgrade.reason}):`, existing.description);
          return { ...existing, status: 'confirmed', autoConfirmed: true, autoOutcome: upgrade.reason };
        }
      }
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

    // ✅ Auto-registration path
    if (opts.autoConfirm) {
      const outcome = await this.tryAutoRegister(transaction);
      if (outcome.registered) {
        transaction.status = 'confirmed';
        transaction.confirmedAt = Date.now();
        transaction.autoConfirmed = true;
        transaction.autoOutcome = outcome.reason;
        await dbAddAutoTransaction(transaction);
        window.dispatchEvent(new CustomEvent('auto-transactions-updated'));
        return transaction;
      }
      // Not registered (e.g. transfer candidate): falls through to the review queue
      transaction.autoOutcome = outcome.reason;
    }

    await dbAddAutoTransaction(transaction);

    console.log('✅ New auto transaction added:', transaction);

    // Notifica utente (solo per la coda di revisione: le auto-registrate
    // vengono riassunte in una notifica unica a fine sync)
    if (!transaction.autoConfirmed) {
      await this.notifyNewTransaction(transaction);
    }

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
   * Notifica di riepilogo dopo un sync con auto-registrazione
   */
  static async notifyAutoSummary(registered: number, linked: number): Promise<void> {
    if (registered + linked === 0) return;
    const parts: string[] = [];
    if (registered > 0) parts.push(`${registered} movimenti registrati`);
    if (linked > 0) parts.push(`${linked} collegati a ricorrenze`);
    try {
      await LocalNotifications.schedule({
        notifications: [{
          id: Date.now(),
          title: '🏦 Sync bancario completato',
          body: parts.join(', '),
          smallIcon: 'ic_stat_notification'
        }]
      });
    } catch (error) {
      console.error('Failed to send summary notification:', error);
    }
  }

  /**
   * Tenta la registrazione automatica di una transazione bancaria.
   * Restituisce registered=false quando la transazione va in coda di revisione.
   */
  private static async tryAutoRegister(tx: AutoTransaction): Promise<{ registered: boolean, reason: string }> {
    try {
      const expenses: Expense[] = JSON.parse(localStorage.getItem('expenses_v2') || '[]');

      // 1. Se corrisponde a una spesa generata da una ricorrenza, non duplicare:
      //    marca quella esistente come confermata dalla banca.
      if (tx.type === 'expense') {
        const match = DeduplicationService.findMatchingRecurringExpense(
          { description: tx.description, amount: tx.amount, date: tx.date },
          expenses
        );
        if (match) {
          const updated = expenses.map(e => e.id === match.id
            ? { ...e, tags: [...new Set([...(e.tags || []), 'bank-confirmed'])] }
            : e);
          localStorage.setItem('expenses_v2', JSON.stringify(updated));
          window.dispatchEvent(new CustomEvent('expenses-updated'));
          console.log('🔗 Auto-linked bank transaction to recurring expense:', match.description);
          return { registered: true, reason: 'linked-recurring' };
        }
      }

      // 2. Possibile giroconto tra conti propri: decisione dell'utente
      if (AutoConfirmService.isTransferCandidate(tx.description)) {
        console.log('🔁 Transfer candidate sent to review queue:', tx.description);
        return { registered: false, reason: 'review-transfer' };
      }

      // 3. Registrazione diretta (categoria dalle regole apprese o Da Categorizzare)
      const rule = AutoConfirmService.findCategoryRule(tx.description);
      const category = tx.type === 'expense' ? (rule?.category || 'Da Categorizzare') : 'Altro';

      const expense: Expense = {
        id: crypto.randomUUID(),
        type: tx.type as 'expense' | 'income',
        amount: tx.amount,
        description: tx.description,
        date: tx.date,
        accountId: tx.account,
        category,
        subcategory: rule?.subcategory,
        tags: ['auto', 'bank', ...(rule ? ['auto-categoria'] : [])],
        frequency: 'single'
      };

      expenses.unshift(expense);
      localStorage.setItem('expenses_v2', JSON.stringify(expenses));
      window.dispatchEvent(new CustomEvent('expenses-updated'));
      console.log(`⚡ Auto-registered ${tx.type} €${tx.amount} (${category}): ${tx.description}`);
      return { registered: true, reason: 'registered' };

    } catch (e) {
      console.error('Auto-registration failed, falling back to review queue:', e);
      return { registered: false, reason: 'error' };
    }
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
