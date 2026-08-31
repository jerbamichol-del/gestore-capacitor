// services/notification-transaction-parser.ts

import { AutoTransaction } from '../types/transaction';
import { AutoTransactionService } from './auto-transaction-service';
import { BankConfig } from '../types/transaction';
import { BankSyncService } from './bank-sync-service';
import { AutoConfirmService } from './auto-confirm-service';

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
    accountName: 'revolut',
    patterns: {
      // ✅ Allow any text/emojis between keyword, amount, and merchant
      expense: /(?:You\s+spent|Hai\s+speso|Payment|Pagamento).*?€?\s*([\d.,]+)\s*(?:EUR)?.*?(?:at|presso|in|to|a|di)\s+(.+)/i,
      income: /(?:You\s+received|Hai\s+ricevuto|Received|Accredito).*?€?\s*([\d.,]+)\s*(?:EUR)?.*?(?:from|da)\s+(.+)/i,
      transfer: /(?:Transfer|Trasferimento|Bonifico).*?€?\s*([\d.,]+)\s*(?:EUR)?.*?(?:to|a)\s+(.+)/i
    }
  },
  {
    name: 'PayPal',
    identifier: 'paypal',
    accountName: 'paypal',
    patterns: {
      expense: /(?:You\s+sent|Hai\s+inviato|Pagamento).*?€?\s*([\d.,]+)\s*(?:EUR)?.*?(?:to|a)\s+(.+)/i,
      income: /(?:You\s+received|Hai\s+ricevuto).*?€?\s*([\d.,]+)\s*(?:EUR)?.*?(?:from|da)\s+(.+)/i
    }
  },
  {
    name: 'Postepay',
    identifier: 'postepay',
    accountName: 'poste',
    patterns: {
      expense: /(?:Pagamento|Addebito|Autorizzazione).*?€?\s*([\d.,]+)\s*(?:EUR)?.*?(?:presso|at|c\/o)\s+(.+)/i,
      income: /(?:Accredito|Ricarica).*?€?\s*([\d.,]+)\s*(?:EUR)?/i,
      transfer: /Bonifico.*?€?\s*([\d.,]+)\s*(?:EUR)?.*?(?:a|verso)\s+(.+)/i
    }
  },
  {
    name: 'BBVA',
    identifier: 'bbva',
    accountName: 'bank-account',
    patterns: {
      expense: /(?:Compra|Pago|Cargo|Acquisto).*?€?\s*([\d.,]+)\s*(?:EUR)?.*?(?:en|c\/o)\s+(.+)/i,
      income: /(?:Ingreso|Abono|Entrata).*?€?\s*([\d.,]+)\s*(?:EUR)?/i,
      transfer: /Transferencia.*?€?\s*([\d.,]+)\s*(?:EUR)?.*?a\s+(.+)/i
    }
  },
  {
    name: 'Intesa Sanpaolo',
    identifier: 'intesa',
    accountName: 'bank-account',
    patterns: {
      expense: /(?:Addebito|Pagamento|Pos).*?€?\s*([\d.,]+)\s*(?:EUR)?.*?(?:presso|c\/o)\s+(.+)/i,
      income: /Accredito.*?€?\s*([\d.,]+)\s*(?:EUR)?/i,
      transfer: /Bonifico.*?€?\s*([\d.,]+)\s*(?:EUR)?.*?(?:a|favore)\s+(.+)/i
    }
  },
  {
    name: 'BNL',
    identifier: 'bnl',
    accountName: 'bank-account',
    patterns: {
      expense: /(?:Pagamento|Prelievo|Addebito).*?€?\s*([\d.,]+)\s*(?:EUR)?.*?(?:presso|c\/o)\s+(.+)/i,
      income: /Accredito.*?€?\s*([\d.,]+)\s*(?:EUR)?/i
    }
  },
  {
    name: 'UniCredit',
    identifier: 'unicredit',
    accountName: 'bank-account',
    patterns: {
      // ✅ FIX: Pattern for "autorizzata op.Internet 60,40 EUR carta *1210 c/o PAYPAL *KICKKICK.IT"
      // Amount comes BEFORE "carta" or "c/o", so we capture it right after the keyword
      expense: /(?:autorizzata|Addebito|Pagamento|Transazione)\s+(?:op\.?\w*\s+)?(\d+[.,]\d{2})\s*(?:EUR|€).*?(?:c\/o|presso|at)\s+(.+?)(?:\s+\d{6,}|\s+\d{2}\/\d{2}\/\d{2}|Per info|$)/i,
      income: /(?:Accredito|bonifico).*?€?\s*(\d+[.,]\d{2})\s*(?:EUR)?/i,
      transfer: /Bonifico.*?€?\s*(\d+[.,]\d{2})\s*(?:EUR)?.*?(?:verso|a)\s+(.+)/i
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

    // ✅ SUPPRESSION: Se la banca è gestita via API, ignoriamo la notifica per evitare duplicati
    if (BankSyncService.isBankAPIActive(config.name)) {
      console.log(`🔇 Suppressing legacy notification for ${config.name} (handled via API)`);
      return null;
    }

    // Combina title e text per pattern matching
    const fullText = `${title} ${text}`.trim();

    console.log(`🔍 Parsing notification from ${appName}:`, fullText);

    // Prova tutti i pattern
    let parsed = this.tryParseTransaction(config, fullText, timestamp);

    // ✅ AI FALLBACK: Se la regex fallisce, prova Gemini - DISABLED BY USER REQUEST
    /*
    if (!parsed) {
      console.log(`❌ No regex match for ${appName}. Trying AI Fallback...`);
      try {
        const { parseExpenseFromText } = await import('../utils/ai');
        const aiResult = await parseExpenseFromText(fullText);

        if (aiResult && aiResult.amount) {
          console.log('🤖 AI successfully parsed the notification:', aiResult);

          parsed = {
            type: (aiResult.type as 'expense' | 'income' | 'transfer') || 'expense',
            amount: aiResult.amount,
            description: aiResult.description || 'Spesa rilevata (AI)',
            date: aiResult.date || this.formatDate(timestamp),
            account: config.accountName,
            sourceType: 'notification',
            sourceApp: config.name.toLowerCase(),
            rawText: fullText
          };
        }
      } catch (e) {
        console.error('⚠️ AI Fallback failed:', e);
      }
    }
    */

    if (!parsed) {
      console.log(`❌ No match found (Regex + AI) for ${appName} notification`);
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

      // Add as pending (will show dialog to user). Transfers are never
      // auto-registered: choosing the accounts involved is a user decision.
      const added = await AutoTransactionService.addAutoTransaction(pendingTransaction, {
        autoConfirm: false
      });

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

    // Normal flow: if the user enabled auto-registration for this source,
    // notifications are registered directly too (transfer candidates above
    // still go through manual review regardless).
    const autoConfirm = AutoConfirmService.shouldAutoConfirm('notification');
    const added = await AutoTransactionService.addAutoTransaction(parsed, { autoConfirm });

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
