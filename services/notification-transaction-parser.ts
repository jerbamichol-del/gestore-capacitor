// services/notification-transaction-parser.ts

import { AutoTransaction } from '../types/transaction';
import { AutoTransactionService } from './auto-transaction-service';
import { BankConfig } from '../types/transaction';

// Configurazioni pattern notifiche app bancarie
const NOTIFICATION_CONFIGS: BankConfig[] = [
  {
    name: 'Revolut',
    identifier: 'revolut',
    accountName: 'Revolut',
    patterns: {
      expense: /(?:You\s+spent|Hai\s+speso|Payment)\s+€?([\d.,]+)\s+(?:at|presso|in)\s+(.+)/i,
      income: /(?:You\s+received|Hai\s+ricevuto|Received)\s+€?([\d.,]+)\s+(?:from|da)\s+(.+)/i,
      transfer: /(?:Transfer|Trasferimento)\s+€?([\d.,]+)\s+(?:to|a)\s+(.+)/i
    }
  },
  {
    name: 'PayPal',
    identifier: 'paypal',
    accountName: 'PayPal',
    patterns: {
      expense: /(?:You\s+sent|Hai\s+inviato)\s+€?([\d.,]+)\s+to\s+(.+)/i,
      income: /(?:You\s+received|Hai\s+ricevuto)\s+€?([\d.,]+)\s+from\s+(.+)/i
    }
  },
  {
    name: 'Postepay',
    identifier: 'postepay',
    accountName: 'Postepay',
    patterns: {
      expense: /(?:Pagamento|Addebito).*?€?([\d.,]+).*?(?:presso|at)\s+(.+)/i,
      income: /(?:Accredito|Ricarica).*?€?([\d.,]+)/i,
      transfer: /Bonifico.*?€?([\d.,]+).*?(?:a|verso)\s+(.+)/i
    }
  },
  {
    name: 'BBVA',
    identifier: 'bbva',
    accountName: 'BBVA',
    patterns: {
      expense: /(?:Compra|Pago|Cargo).*?€?([\d.,]+).*?en\s+(.+)/i,
      income: /(?:Ingreso|Abono).*?€?([\d.,]+)/i,
      transfer: /Transferencia.*?€?([\d.,]+).*?a\s+(.+)/i
    }
  },
  {
    name: 'Intesa Sanpaolo',
    identifier: 'intesa',
    accountName: 'Intesa Sanpaolo',
    patterns: {
      expense: /(?:Addebito|Pagamento)\s+carta.*?€?([\d.,]+).*?presso\s+(.+)/i,
      income: /Accredito.*?€?([\d.,]+)/i,
      transfer: /Bonifico.*?€?([\d.,]+).*?a\s+(.+)/i
    }
  },
  {
    name: 'BNL',
    identifier: 'bnl',
    accountName: 'BNL',
    patterns: {
      expense: /(?:Pagamento|Prelievo).*?€?([\d.,]+).*?presso\s+(.+)/i,
      income: /Accredito.*?€?([\d.,]+)/i
    }
  },
  {
    name: 'Unicredit',
    identifier: 'unicredit',
    accountName: 'Unicredit',
    patterns: {
      expense: /(?:Addebito|Pagamento).*?€?([\d.,]+).*?(?:presso|at)\s+(.+)/i,
      income: /Accredito.*?€?([\d.,]+)/i
    }
  }
];

export class NotificationTransactionParser {

  /**
   * Parse notifica bancaria
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

    // Aggiungi tramite AutoTransactionService (con check duplicati)
    const added = await AutoTransactionService.addAutoTransaction(parsed);
    
    if (added) {
      console.log(`✅ Auto transaction added from ${appName} notification`);
    } else {
      console.log(`⚠️ Duplicate transaction skipped from ${appName}`);
    }

    return added;
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
          description: match[2]?.trim() || 'Pagamento',
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
}
