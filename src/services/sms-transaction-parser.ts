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
  },
  {
    name: 'UniCredit',
    identifier: 'UNICREDIT',
    accountName: 'UniCredit',
    patterns: {
      // ✅ FIX: Pattern migliorato per supportare "c/o", "presso", "carta", etc.
      expense: /(?:autorizzata|addebito).*?([\d.,]+)\s*EUR.*?(?:carta|presso|c\/o)\s+(.+?)(?:\s+\d{2}\/\d{2}\/\d{2}|$)/i,
      income: /accredito.*?([\d.,]+)\s*EUR/i,
      transfer: /bonifico.*?([\d.,]+)\s*EUR.*?(?:a|verso)\s+(.+)/i
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
        const transaction = this.parseSMS(sms.sender, sms.body, sms.timestamp);
        
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
  static parseSMS(
    sender: string,
    body: string,
    timestamp: number
  ): Omit<AutoTransaction, 'id' | 'createdAt' | 'sourceHash' | 'status'> | null {
    
    console.log(`📨 Parsing SMS from: ${sender}`);
    console.log(`📄 Body: ${body}`);
    
    // Trova config banca
    const config = BANK_CONFIGS.find(c => 
      sender.toUpperCase().includes(c.identifier)
    );

    if (!config) {
      console.log(`⚠️ No bank config found for sender: ${sender}`);
      return null;
    }

    console.log(`🏦 Matched bank: ${config.name}`);

    // Prova pattern expense
    if (config.patterns.expense) {
      const match = body.match(config.patterns.expense);
      if (match) {
        console.log(`✅ Matched expense pattern`);
        console.log(`💶 Amount: ${match[1]}, Merchant: ${match[2]}`);
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
        console.log(`✅ Matched income pattern`);
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
        console.log(`✅ Matched transfer pattern`);
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

    console.log(`⚠️ No pattern matched for SMS`);
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
