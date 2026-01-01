// services/notification-transaction-parser.ts

import { AutoTransaction } from '../types/transaction';
import { AutoTransactionService } from './auto-transaction-service';
import { BankConfig } from '../types/transaction';

// ✅ BANK/FINANCIAL ACCOUNTS KEYWORDS
// Used to detect transfers between own accounts
const BANK_KEYWORDS = [
  'revolut', 'paypal', 'postepay', 'bbva', 'unicredit', 'intesa', 'bnl',
  'poste', 'postepay', 'banco', 'banca', 'conto', 'carta', 'prepagata',
  'coinbase', 'binance', 'crypto', 'kraken', 'nexo', 'n26', 'wise',
  'transferwise', 'hype', 'satispay', 'tinaba', 'yap', 'buddybank',
  'credit agricole', 'ing', 'webank', 'fineco', 'widiba', 'chebanca',
  'mediolanum', 'monte paschi', 'mps', 'ubi', 'bper', 'carige'
];

// Configurazioni pattern notifiche app bancarie
const NOTIFICATION_CONFIGS: BankConfig[] = [
  {
    name: 'Revolut',
    identifier: 'revolut',
    accountName: 'Revolut',
    patterns: {
      expense: /(?:You\s+spent|Hai\s+speso|Payment|Pagamento\s+riuscito)\s+€?([\d.,]+)\s+(?:at|presso|in|to|a)\s+(.+)/i,
      income: /(?:You\s+received|Hai\s+ricevuto|Received)\s+€?([\d.,]+)\s+(?:from|da)\s+(.+)/i,
      transfer: /(?:Transfer|Trasferimento)\s+€?([\d.,]+)\s+(?:to|a)\s+(.+)/i
    }
  },
  {
    name: 'PayPal',
    identifier: 'paypal',
    accountName: 'PayPal',
    patterns: {
      expense: /(?:You\s+sent|Hai\s+inviato)\s+€?([\d.,]+)\s+(?:to|a)\s+(.+)/i,
      income: /(?:You\s+received|Hai\s+ricevuto)\s+€?([\d.,]+)\s+(?:from|da)\s+(.+)/i
    }
  },
  {
    name: 'Postepay',
    identifier: 'postepay',
    accountName: 'Postepay',
    patterns: {
      expense: /(?:Pagamento|Addebito).*?€?([\d.,]+).*?(?:presso|at|c\/o)\s+(.+)/i,
      income: /(?:Accredito|Ricarica).*?€?([\d.,]+)/i,
      transfer: /Bonifico.*?€?([\d.,]+).*?(?:a|verso)\s+(.+)/i
    }
  },
  {
    name: 'BBVA',
    identifier: 'bbva',
    accountName: 'BBVA',
    patterns: {
      expense: /(?:Compra|Pago|Cargo).*?€?([\d.,]+).*?(?:en|c\/o)\s+(.+)/i,
      income: /(?:Ingreso|Abono).*?€?([\d.,]+)/i,
      transfer: /Transferencia.*?€?([\d.,]+).*?a\s+(.+)/i
    }
  },
  {
    name: 'Intesa Sanpaolo',
    identifier: 'intesa',
    accountName: 'Intesa Sanpaolo',
    patterns: {
      expense: /(?:Addebito|Pagamento)\s+carta.*?€?([\d.,]+).*?(?:presso|c\/o)\s+(.+)/i,
      income: /Accredito.*?€?([\d.,]+)/i,
      transfer: /Bonifico.*?€?([\d.,]+).*?a\s+(.+)/i
    }
  },
  {
    name: 'BNL',
    identifier: 'bnl',
    accountName: 'BNL',
    patterns: {
      expense: /(?:Pagamento|Prelievo).*?€?([\d.,]+).*?(?:presso|c\/o)\s+(.+)/i,
      income: /Accredito.*?€?([\d.,]+)/i
    }
  },
  {
    name: 'UniCredit',
    identifier: 'unicredit',
    accountName: 'UniCredit',
    patterns: {
      // ✅ EXPANDED: "autorizzata op.Internet" + "Bonifico Istantaneo"
      expense: /(?:Addebito|Pagamento|autorizzata\s+op\.Internet|Transazione\s+autorizzata).*?€?([\d.,]+)\s+(?:EUR)?.*?(?:presso|at|c\/o|carta.*?c\/o)\s+(.+?)(?:\s+\d{2}\/\d{2}\/\d{2}|$)/i,
      income: /(?:Accredito|hai\s+appena\s+ricevuto\s+un\s+bonifico).*?€?([\d.,]+)\s+(?:EUR)?/i,
      transfer: /Bonifico(?:\s+Istantaneo)?.*?€?([\d.,]+)\s+(?:EUR)?.*?(?:verso|a)\s+(.+)/i
    }
  }
];

export class NotificationTransactionParser {

  /**
   * Parse notifica bancaria
   * ✅ NEW: Returns parsed data + flag if requires user confirmation
   */
  static async parseNotification(
    appName: string,
    title: string,
    text: string,
    timestamp: number
  ): Promise<AutoTransaction | null> {

    // Trova configurazione banca
    const config = NOTIFICATION_CONFIGS.find(c =>
      c.identifier.toLowerCase() === appName.toLowerCase()
    );

    if (!config) {
      console.log(`⚠️ No config for app: ${appName}`);
      return null;
    }

    // Combina title e text per pattern matching
    const fullText = `${title} ${text}`.trim();

    console.log(`🔍 Parsing notification from ${appName}:`, fullText);

    // Prova tutti i pattern
    const parsed = this.tryParseTransaction(config, fullText, timestamp);

    if (!parsed) {
      console.log(`❌ No match found for ${appName} notification`);
      return null;
    }

    // ✅ CRITICAL: Check if merchant/recipient is another bank account
    const requiresConfirmation = this.isLikelyTransfer(parsed);

    if (requiresConfirmation) {
      console.log(`⚠️ Transaction looks like transfer between accounts - requires user confirmation`);
      console.log(`   From: ${parsed.account}`);
      console.log(`   To: ${parsed.description}`);

      // Mark as pending with special flag
      const pendingTransaction = {
        ...parsed,
        requiresConfirmation: true,
        confirmationType: 'transfer_or_expense' as const
      };

      // Add as pending (will show dialog to user)
      const added = await AutoTransactionService.addAutoTransaction(pendingTransaction);

      if (added) {
        console.log(`✅ Pending transaction added - awaiting user confirmation`);
        // Dispatch event per mostrare dialog
        this.dispatchConfirmationNeeded(added);
      }

      return added;
    }

    // Filter out 0 or invalid amounts - DISABLED to debug "missing transactions"
    // if (parsed.amount <= 0) {
    //   console.log(`⚠️ Transaction skipped: Amount is ${parsed.amount} (likely system message or parse error)`);
    //   return null;
    // }

    // Normal flow: add transaction directly
    const added = await AutoTransactionService.addAutoTransaction(parsed);

    if (added) {
      console.log(`✅ Auto transaction added from ${appName} notification`);
    } else {
      console.log(`⚠️ Duplicate transaction skipped from ${appName}`);
    }

    return added;
  }

  /**
   * ✅ NEW: Check if transaction is likely a transfer between own accounts
   * Returns true if merchant/recipient contains bank keywords
   */
  private static isLikelyTransfer(
    parsed: Omit<AutoTransaction, 'id' | 'createdAt' | 'sourceHash' | 'status'>
  ): boolean {
    // Solo per transazioni expense (uscite)
    if (parsed.type !== 'expense') return false;

    const merchantLower = (parsed.description || '').toLowerCase();

    // Check se contiene keyword bancaria
    const containsBankKeyword = BANK_KEYWORDS.some(keyword =>
      merchantLower.includes(keyword.toLowerCase())
    );

    if (containsBankKeyword) {
      console.log(`🏦 Detected bank keyword in merchant: "${parsed.description}"`);
      return true;
    }

    return false;
  }

  /**
   * ✅ NEW: Dispatch event per mostrare dialog conferma
   */
  private static dispatchConfirmationNeeded(transaction: AutoTransaction): void {
    const event = new CustomEvent('auto-transaction-confirmation-needed', {
      detail: { transaction }
    });
    window.dispatchEvent(event);
  }

  /**
   * ✅ NEW: Conferma transazione come trasferimento
   * Crea 2 movimenti: uscita da account origine + entrata su account destinazione
   */
  static async confirmAsTransfer(
    transactionId: string,
    fromAccount: string,
    toAccount: string,
    amount: number,
    date: string
  ): Promise<boolean> {
    try {
      console.log(`✅ Confirming as transfer: ${fromAccount} -> ${toAccount} (€${amount})`);

      // 1. Aggiorna transazione originale come "trasferimento" (uscita)
      await AutoTransactionService.updateTransactionType(transactionId, 'transfer');

      // 2. Crea movimento di entrata sul conto destinazione
      const incomeTransaction = {
        type: 'income' as const,
        amount,
        description: `Trasferimento da ${fromAccount}`,
        date,
        account: toAccount,
        sourceType: 'notification' as const,
        sourceApp: 'transfer_confirmation',
        rawText: `Transfer from ${fromAccount} to ${toAccount}`,
        linkedTransactionId: transactionId // Link alla transazione originale
      };

      await AutoTransactionService.addAutoTransaction(incomeTransaction);

      console.log(`✅ Transfer confirmed: created 2 linked transactions`);
      return true;

    } catch (error) {
      console.error('❌ Error confirming transfer:', error);
      return false;
    }
  }

  /**
   * ✅ NEW: Conferma transazione come spesa normale
   */
  static async confirmAsExpense(transactionId: string): Promise<boolean> {
    try {
      console.log(`✅ Confirming as regular expense: ${transactionId}`);
      // Rimuovi flag "requiresConfirmation" e marca come confermata
      await AutoTransactionService.confirmTransaction(transactionId);
      return true;
    } catch (error) {
      console.error('❌ Error confirming expense:', error);
      return false;
    }
  }

  /**
   * Prova a parsare con tutti i pattern
   */
  private static tryParseTransaction(
    config: BankConfig,
    text: string,
    timestamp: number
  ): Omit<AutoTransaction, 'id' | 'createdAt' | 'sourceHash' | 'status'> | null {

    // Prova pattern expense
    if (config.patterns.expense) {
      const match = text.match(config.patterns.expense);
      if (match) {
        return {
          type: 'expense',
          amount: this.parseAmount(match[1]),
          description: this.cleanMerchantName(match[2]?.trim() || 'Pagamento'),
          date: this.formatDate(timestamp),
          account: config.accountName,
          sourceType: 'notification',
          sourceApp: config.name.toLowerCase(),
          rawText: text
        };
      }
    }

    // Prova pattern income
    if (config.patterns.income) {
      const match = text.match(config.patterns.income);
      if (match) {
        return {
          type: 'income',
          amount: this.parseAmount(match[1]),
          description: match[2]?.trim() || 'Accredito',
          date: this.formatDate(timestamp),
          account: config.accountName,
          sourceType: 'notification',
          sourceApp: config.name.toLowerCase(),
          rawText: text
        };
      }
    }

    // Prova pattern transfer
    if (config.patterns.transfer) {
      const match = text.match(config.patterns.transfer);
      if (match) {
        return {
          type: 'transfer',
          amount: this.parseAmount(match[1]),
          description: 'Trasferimento',
          toAccount: match[2]?.trim(),
          date: this.formatDate(timestamp),
          account: config.accountName,
          sourceType: 'notification',
          sourceApp: config.name.toLowerCase(),
          rawText: text
        };
      }
    }

    return null;
  }

  /**
   * ✅ NEW: Clean merchant name (remove trailing info)
   */
  private static cleanMerchantName(merchant: string): string {
    // Remove trailing info like city, dates, reference numbers
    let cleaned = merchant
      .replace(/\s+\d{2}\/\d{2}\/\d{2,4}.*$/i, '') // Remove dates
      .replace(/\s+\d{2}:\d{2}.*$/i, '') // Remove times
      .replace(/Per info.*$/i, '') // Remove "Per info o blocco..."
      .replace(/\*+\d+\*+/g, '') // Remove card numbers like **7215*
      .trim();

    return cleaned || merchant; // Fallback to original if cleaning removed everything
  }

  /**
   * Parse amount da stringa
   */
  private static parseAmount(amountStr: string): number {
    const cleaned = amountStr.replace(/,/g, '.').replace(/\s/g, '');
    const amount = parseFloat(cleaned);
    return isNaN(amount) ? 0 : amount;
  }

  /**
   * Formatta timestamp in YYYY-MM-DD
   */
  private static formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toISOString().split('T')[0];
  }

  /**
   * Ottieni lista app supportate
   */
  static getSupportedApps(): string[] {
    return NOTIFICATION_CONFIGS.map(c => c.name);
  }

  /**
   * Aggiungi configurazione app custom
   */
  static addAppConfig(config: BankConfig): void {
    NOTIFICATION_CONFIGS.push(config);
  }

  /**
   * ✅ NEW: Get list of all bank keywords (for UI)
   */
  static getBankKeywords(): string[] {
    return [...BANK_KEYWORDS];
  }
}
