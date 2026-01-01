// services/sms-transaction-parser.ts

import { AutoTransaction } from '../types/transaction';
import { AutoTransactionService } from './auto-transaction-service';
import { BankConfig } from '../types/transaction';
import { Capacitor } from '@capacitor/core';
import SMSReader from '../plugins/sms-reader';

// Configurazioni banche italiane
const BANK_CONFIGS: BankConfig[] = [
  {
    name: 'Revolut',
    identifier: 'REVOLUT',
    accountName: 'Revolut',
    patterns: {
      expense: /(?:hai\s+speso|payment\s+of|spent).*?([\d.,]+)\s*€?.*?(?:at|presso|da|in)\s+(.+)/i,
      income: /(?:ricevuto|received).*?([\d.,]+)\s*€?.*?(?:from|da)\s+(.+)/i,
      transfer: /(?:trasferimento|transfer).*?([\d.,]+)\s*€?.*?(?:to|a|verso)\s+(.+)/i
    }
  },
  {
    name: 'PayPal',
    identifier: 'PayPal',
    accountName: 'PayPal',
    patterns: {
      expense: /(?:sent|inviato|hai\s+inviato).*?([\d.,]+)\s*€?.*?(?:to|a)\s+(.+)/i,
      income: /(?:received|ricevuto|hai\s+ricevuto).*?([\d.,]+)\s*€?.*?(?:from|da)\s+(.+)/i
    }
  },
  {
    name: 'Postepay',
    identifier: 'POSTEPAY',
    accountName: 'Postepay',
    patterns: {
      expense: /(?:pagamento|addebito).*?([\d.,]+)\s*€?.*?(?:presso|at)\s+(.+)/i,
      income: /(?:accredito|ricarica).*?([\d.,]+)\s*€?/i,
      transfer: /bonifico.*?([\d.,]+)\s*€?.*?(?:a|verso)\s+(.+)/i
    }
  },
  {
    name: 'BBVA',
    identifier: 'BBVA',
    accountName: 'BBVA',
    patterns: {
      expense: /(?:compra|pago|cargo).*?([\d.,]+)\s*€?.*?(?:en|at)\s+(.+)/i,
      income: /(?:ingreso|abono).*?([\d.,]+)\s*€?/i,
      transfer: /transferencia.*?([\d.,]+)\s*€?.*?(?:a|para)\s+(.+)/i
    }
  },
  {
    name: 'Intesa Sanpaolo',
    identifier: 'INTESA',
    accountName: 'Intesa Sanpaolo',
    patterns: {
      expense: /(?:addebito|pagamento)\s+carta.*?([\d.,]+)\s*€?.*?presso\s+(.+)/i,
      income: /accredito.*?([\d.,]+)\s*€?/i,
      transfer: /bonifico.*?([\d.,]+)\s*€?.*?(?:a|verso)\s+(.+)/i
    }
  },
  {
    name: 'UniCredit',
    identifier: 'UNICREDIT',
    accountName: 'UniCredit',
    patterns: {
      expense: /(?:Addebito|Pagamento|autorizzata|Transazione).*?€?\s*([\d.,]+)\s*(?:EUR)?.*?(?:presso|at|c\/o|carta.*?c\/o)\s+(.+)/i,
      income: /(?:Accredito|bonifico).*?€?\s*([\d.,]+)\s*(?:EUR)?/i,
      transfer: /Bonifico.*?€?\s*([\d.,]+)\s*(?:EUR)?.*?(?:verso|a)\s+(.+)/i
    }
  },
  {
    name: 'Mastercard',
    identifier: 'MASTERCARD',
    accountName: 'Carta Mastercard',
    patterns: {
      expense: /(?:Autorizzazione|Spesa|Pagamento).*?€?\s*([\d.,]+)\s*(?:EUR)?.*?(?:presso|at)\s+(.+)/i
    }
  }
];

export class SMSTransactionParser {

  /**
   * Check if SMS permission is granted
   */
  static async checkPermission(): Promise<boolean> {
    if (Capacitor.getPlatform() !== 'android') {
      return false;
    }

    try {
      const result = await SMSReader.checkPermission();
      return result.granted;
    } catch (error) {
      console.error('Error checking SMS permission:', error);
      return false;
    }
  }

  /**
   * Request SMS permission from user
   */
  static async requestPermission(): Promise<boolean> {
    if (Capacitor.getPlatform() !== 'android') {
      return false;
    }

    try {
      const result = await SMSReader.requestPermission();
      return result.granted;
    } catch (error) {
      console.error('Error requesting SMS permission:', error);
      return false;
    }
  }

  /**
   * Scan recent SMS (ultimi X ore)
   */
  static async scanRecentSMS(hours: number = 24): Promise<AutoTransaction[]> {
    // Solo su Android
    if (Capacitor.getPlatform() !== 'android') {
      console.log('⚠️ SMS scanning only available on Android');
      return [];
    }

    try {
      // Check permission
      const hasPermission = await this.checkPermission();
      if (!hasPermission) {
        console.log('⚠️ SMS permission not granted');
        return [];
      }

      console.log(`📱 Scanning SMS from last ${hours} hours...`);

      // Get SMS from native plugin
      const result = await SMSReader.getRecentSMS({ hours });
      console.log(`📥 Found ${result.count} SMS messages`);

      const transactions: AutoTransaction[] = [];

      // Parse each SMS
      for (const sms of result.messages) {
        // ✅ Await parseSMS (async because of AI fallback)
        const transaction = await this.parseSMS(sms.sender, sms.body, sms.timestamp);

        if (transaction) {
          // Check if duplicate
          const isDuplicate = await AutoTransactionService.isDuplicate(
            AutoTransactionService.generateTransactionHash(
              transaction.amount,
              transaction.date,
              transaction.account,
              transaction.description
            )
          );

          if (!isDuplicate) {
            // Add to database
            await AutoTransactionService.addAutoTransaction(transaction);
            transactions.push(transaction as AutoTransaction);
            console.log(`✅ Added transaction: ${transaction.description} - €${transaction.amount}`);
          } else {
            console.log(`⚠️ Skipped duplicate: ${transaction.description}`);
          }
        }
      }

      console.log(`✅ Scan complete: ${transactions.length} new transactions added`);
      return transactions;

    } catch (error) {
      console.error('Error scanning SMS:', error);
      return [];
    }
  }

  /**
   * Parse singolo SMS
   */
  static async parseSMS(
    sender: string,
    body: string,
    timestamp: number
  ): Promise<Omit<AutoTransaction, 'id' | 'createdAt' | 'sourceHash' | 'status'> | null> {

    // Trova config banca specifica
    let config = BANK_CONFIGS.find(c =>
      sender.toUpperCase().includes(c.identifier)
    );

    // 🧠 UNIVERSAL DETECTION: Se non troviamo una banca nota, cerchiamo segnali di "Finanza"
    if (!config) {
      // Parole chiave nei mittenti (Case insensitive)
      const FINANCIAL_SENDERS = [
        'BANK', 'BANCA', 'PAY', 'CARD', 'CARTA', 'CREDIT', 'DEBIT', 'ALERT', 'INFO', 'CONTO',
        'POSTE', 'HYPE', 'N26', 'REVOLUT', 'CURVE', 'WISE', 'SATISPAY', 'AMEX', 'VISA',
        'MASTERCARD', 'ING', 'BNL', 'BPER', 'FINECO', 'WEBANK', 'WIDIBA', 'ILLIMITY',
        'NEXI', 'FINDOMESTIC', 'COMPASS', 'SANTANDER', 'UBI', 'CREDEM', 'MEDIOLANUM'
      ];

      // Parole chiave nel testo (Money signals)
      const MONEY_SIGNALS = [
        '€', 'EUR', 'SPESO', 'PAGATO', 'ADDEBITO', 'ACCREDITO', 'BONIFICO', 'AUTHORIZED',
        'SPENT', 'PURCHASE', 'TRANSAZIONE', 'TRANSACTION', 'PAGAMENTO'
      ];

      const isFinancialSender = FINANCIAL_SENDERS.some(k => sender.toUpperCase().includes(k));
      const hasMoneySignal = MONEY_SIGNALS.some(k => body.toUpperCase().includes(k));

      if (isFinancialSender || hasMoneySignal) {
        console.log(`🧠 Universal Parser detected potential financial SMS from: "${sender}"`);
        // Usiamo una configurazione generica
        config = {
          name: sender, // Usiamo il nome del mittente come nome banca
          identifier: 'GENERIC',
          accountName: 'Conto ' + sender, // Fallback account name
          patterns: {
            // Pattern ultra-generici
            expense: /(?:speso|pagato|addebito|autorizzata|transazione|purchase|sent|spent|payment).*?([\d.,]+)\s*€?.*?(?:presso|at|c\/o|to|a)\s+(.+)/i,
            income: /(?:ricevuto|accredito|ricarica|received|credit).*?([\d.,]+)\s*€?.*?(?:da|from)\s*(.*)/i,
            transfer: /(?:bonifico|transfer).*?([\d.,]+)\s*€?/i
          }
        };
      }
    }

    if (!config) {
      // ✅ LOGGING PER DEBUG: Vediamo chi stiamo ignorando
      console.log(`⚠️ Ignored SMS from non-financial sender: "${sender}"`);
      return null;
    }

    let parsed: Omit<AutoTransaction, 'id' | 'createdAt' | 'sourceHash' | 'status'> | null = null;

    // Prova pattern expense
    if (config.patterns.expense) {
      const match = body.match(config.patterns.expense);
      if (match) {
        parsed = {
          type: 'expense',
          amount: this.parseAmount(match[1]),
          description: match[2]?.trim() || 'Pagamento',
          date: this.formatDate(timestamp),
          account: config.accountName,
          sourceType: 'sms',
          sourceApp: config.name.toLowerCase(),
          rawText: body
        };
      }
    }

    // Prova pattern income
    if (!parsed && config.patterns.income) {
      const match = body.match(config.patterns.income);
      if (match) {
        parsed = {
          type: 'income',
          amount: this.parseAmount(match[1]),
          description: match[2]?.trim() || 'Accredito',
          date: this.formatDate(timestamp),
          account: config.accountName,
          sourceType: 'sms',
          sourceApp: config.name.toLowerCase(),
          rawText: body
        };
      }
    }

    // Prova pattern transfer
    if (!parsed && config.patterns.transfer) {
      const match = body.match(config.patterns.transfer);
      if (match) {
        parsed = {
          type: 'transfer',
          amount: this.parseAmount(match[1]),
          description: 'Trasferimento',
          toAccount: match[2]?.trim(),
          date: this.formatDate(timestamp),
          account: config.accountName,
          sourceType: 'sms',
          sourceApp: config.name.toLowerCase(),
          rawText: body
        };
      }
    }

    // ✅ AI FALLBACK
    if (!parsed) {
      console.log(`❌ No regex match for SMS from ${sender}. Trying AI Fallback...`);
      try {
        const { parseExpenseFromText } = await import('../utils/ai');
        const aiResult = await parseExpenseFromText(body);

        if (aiResult && aiResult.amount) {
          console.log('🤖 AI successfully parsed the SMS:', aiResult);
          parsed = {
            type: (aiResult.type as 'expense' | 'income' | 'transfer') || 'expense',
            amount: aiResult.amount,
            description: aiResult.description || 'Spesa rilevata (AI)',
            date: aiResult.date || this.formatDate(timestamp),
            account: config.accountName,
            sourceType: 'sms',
            sourceApp: config.name.toLowerCase(),
            rawText: body
          };
        }
      } catch (e) {
        console.error('AI Fallback failed for SMS:', e);
      }
    }

    return parsed;
  }

  /**
   * Parse amount da stringa (supporta virgola e punto)
   */
  private static parseAmount(amountStr: string): number {
    // Sostituisci virgola con punto e rimuovi spazi
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
   * Ottieni lista banche supportate
   */
  static getSupportedBanks(): string[] {
    return BANK_CONFIGS.map(c => c.name);
  }

  /**
   * Aggiungi configurazione banca custom
   */
  static addBankConfig(config: BankConfig): void {
    BANK_CONFIGS.push(config);
  }
}
