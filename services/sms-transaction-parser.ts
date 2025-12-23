// services/sms-transaction-parser.ts

import { AutoTransaction } from '../types/transaction';
import { AutoTransactionService } from './auto-transaction-service';
import { BankConfig } from '../types/transaction';

// Configurazioni banche italiane
const BANK_CONFIGS: BankConfig[] = [
  {
    name: 'Revolut',
    identifier: 'REVOLUT',
    accountName: 'Revolut',
    patterns: {
      expense: /(?:hai\s+speso|payment\s+of|spent)\s+([\d.,]+)\s*€?\s+(?:at|presso|da|in)\s+(.+)/i,
      income: /(?:ricevuto|received)\s+([\d.,]+)\s*€?\s+(?:from|da)\s+(.+)/i,
      transfer: /(?:trasferimento|transfer).*?([\d.,]+)\s*€?\s+(?:to|a|verso)\s+(.+)/i
    }
  },
  {
    name: 'PayPal',
    identifier: 'PayPal',
    accountName: 'PayPal',
    patterns: {
      expense: /(?:sent|inviato|hai\s+inviato)\s+([\d.,]+)\s*€?\s+(?:to|a)\s+(.+)/i,
      income: /(?:received|ricevuto|hai\s+ricevuto)\s+([\d.,]+)\s*€?\s+(?:from|da)\s+(.+)/i
    }
  },
  {
    name: 'Postepay',
    identifier: 'POSTEPAY',
    accountName: 'Postepay',
    patterns: {
      expense: /(?:pagamento|addebito).*?([\d.,]+)\s*€.*?(?:presso|at)\s+(.+)/i,
      income: /accredito.*?([\d.,]+)\s*€/i,
      transfer: /bonifico.*?([\d.,]+)\s*€.*?(?:a|verso)\s+(.+)/i
    }
  },
  {
    name: 'BBVA',
    identifier: 'BBVA',
    accountName: 'BBVA',
    patterns: {
      expense: /(?:compra|pago|cargo).*?([\d.,]+)\s*€?.*?(?:en|at)\s+(.+)/i,
      income: /(?:ingreso|abono).*?([\d.,]+)\s*€/i,
      transfer: /transferencia.*?([\d.,]+)\s*€.*?(?:a|para)\s+(.+)/i
    }
  },
  {
    name: 'Intesa Sanpaolo',
    identifier: 'INTESA',
    accountName: 'Intesa Sanpaolo',
    patterns: {
      expense: /(?:addebito|pagamento)\s+carta.*?([\d.,]+)\s*€.*?presso\s+(.+)/i,
      income: /accredito.*?([\d.,]+)\s*€/i,
      transfer: /bonifico.*?([\d.,]+)\s*€.*?(?:a|verso)\s+(.+)/i
    }
  }
];

export class SMSTransactionParser {
  
  /**
   * Scan recent SMS (ultimi X ore)
   */
  static async scanRecentSMS(hours: number = 24): Promise<AutoTransaction[]> {
    try {
      // Importa dinamicamente il plugin SMS
      const { SmsRetriever } = await import('cap-read-sms');
      
      // Ottieni SMS recenti
      const result = await SmsRetriever.requestReadSmsPermission();
      if (result.granted !== true) {
        console.log('⚠️ SMS permission denied');
        return [];
      }

      const messages = await SmsRetriever.getMessages({ 
        maxCount: 100 
      });

      const cutoff = Date.now() - (hours * 60 * 60 * 1000);
      const recentMessages = messages.messages.filter(
        (sms: any) => sms.date && sms.date > cutoff
      );

      const transactions: AutoTransaction[] = [];

      for (const sms of recentMessages) {
        const parsed = this.parseSMS(
          sms.address || '',
          sms.body || '',
          sms.date || Date.now()
        );
        
        if (parsed) {
          // Aggiungi solo se non duplicato
          const added = await AutoTransactionService.addAutoTransaction(parsed);
          if (added) transactions.push(added);
        }
      }

      console.log(`📱 Scanned ${recentMessages.length} SMS, found ${transactions.length} new transactions`);
      return transactions;
      
    } catch (error) {
      console.error('Error scanning SMS:', error);
      return [];
    }
  }

  /**
   * Parse singolo SMS
   */
  static parseSMS(
    sender: string,
    body: string,
    timestamp: number
  ): Omit<AutoTransaction, 'id' | 'createdAt' | 'sourceHash' | 'status'> | null {
    
    // Trova config banca
    const config = BANK_CONFIGS.find(c => 
      sender.toUpperCase().includes(c.identifier)
    );

    if (!config) {
      return null;
    }

    // Prova pattern expense
    if (config.patterns.expense) {
      const match = body.match(config.patterns.expense);
      if (match) {
        return {
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
    if (config.patterns.income) {
      const match = body.match(config.patterns.income);
      if (match) {
        return {
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
    if (config.patterns.transfer) {
      const match = body.match(config.patterns.transfer);
      if (match) {
        return {
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

    return null;
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
