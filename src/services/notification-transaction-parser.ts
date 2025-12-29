// src/services/notification-transaction-parser.ts

export interface ParsedTransaction {
  amount: number;
  description: string;
  currency: string;
  type: 'expense' | 'income' | 'transfer';
  rawText: string;
}

interface BankPattern {
  amountRegex: RegExp;
  descriptionRegex?: RegExp;
  currencyRegex?: RegExp;
  getType: (text: string, description: string) => 'expense' | 'income' | 'transfer';
}

// Keywords that indicate a transfer between own accounts
const TRANSFER_KEYWORDS = [
  // Italian
  'bonifico', 'trasferimento', 'ricarica', 'prelievo',
  // English
  'transfer', 'withdrawal', 'top up', 'reload',
  // Bank names (transfers to/from banks)
  'intesa', 'unicredit', 'bnl', 'poste', 'postepay',
  'banco', 'banca', 'conto', 'account',
];

// Detect if transaction is to a person (likely own account transfer)
function isProbablyTransferToOwnAccount(description: string): boolean {
  const desc = description.toLowerCase();
  
  // Check for transfer keywords
  if (TRANSFER_KEYWORDS.some(kw => desc.includes(kw))) {
    return true;
  }
  
  // Check if description contains a capitalized name (e.g., "Michol Battistelli")
  // Pattern: Two or more capitalized words (likely a person's name)
  const namePattern = /\b[A-Z][a-z]+\s+[A-Z][a-z]+/;
  if (namePattern.test(description)) {
    console.log('📝 Detected personal name in description - treating as transfer');
    return true;
  }
  
  return false;
}

const BANK_PATTERNS: Record<string, BankPattern> = {
  revolut: {
    amountRegex: /€?\s*([\d,.]+)\s*€?/,
    descriptionRegex: /(?:a|to)\s+([^€\n.]+?)(?:\s+è|\s+has|\s+was|\.|$)/i,
    getType: (text, description) => {
      const lowerText = text.toLowerCase();
      
      // Check if it's a transfer
      if (isProbablyTransferToOwnAccount(description)) {
        return 'transfer';
      }
      
      // Check for income keywords
      if (lowerText.includes('ricevuto') || lowerText.includes('received')) {
        return 'income';
      }
      
      // Default: if it's a payment, it's an expense (unless already detected as transfer)
      if (lowerText.includes('pagamento') || lowerText.includes('payment')) {
        return 'expense';
      }
      
      return 'expense';
    },
  },
  
  paypal: {
    amountRegex: /€?\s*([\d,.]+)\s*EUR/i,
    descriptionRegex: /(?:a|to|per)\s+([^€\n.]+?)(?:\s+è|\s+has|\.|$)/i,
    getType: (text, description) => {
      const lowerText = text.toLowerCase();
      
      if (isProbablyTransferToOwnAccount(description)) {
        return 'transfer';
      }
      
      if (lowerText.includes('ricevuto') || lowerText.includes('received')) {
        return 'income';
      }
      
      if (lowerText.includes('hai inviato') || lowerText.includes('you sent')) {
        return 'expense';
      }
      
      return 'expense';
    },
  },
  
  postepay: {
    amountRegex: /€\s*([\d,.]+)/,
    descriptionRegex: /(?:a|presso|su|at)\s+([^€\n.]+?)(?:\.|$)/i,
    getType: (text, description) => {
      const lowerText = text.toLowerCase();
      
      if (isProbablyTransferToOwnAccount(description)) {
        return 'transfer';
      }
      
      if (lowerText.includes('ricevuto') || lowerText.includes('accreditato')) {
        return 'income';
      }
      
      return 'expense';
    },
  },
  
  bbva: {
    amountRegex: /([\d,.]+)\s*€/,
    descriptionRegex: /(?:en|presso|a)\s+([^€\n.]+?)(?:\.|$)/i,
    getType: (text, description) => {
      const lowerText = text.toLowerCase();
      
      if (isProbablyTransferToOwnAccount(description)) {
        return 'transfer';
      }
      
      if (lowerText.includes('ingreso') || lowerText.includes('abono')) {
        return 'income';
      }
      
      return 'expense';
    },
  },
  
  intesa: {
    amountRegex: /€\s*([\d,.]+)/,
    descriptionRegex: /(?:presso|carta|a)\s+([^€\n.]+?)(?:\.|$)/i,
    getType: (text, description) => {
      const lowerText = text.toLowerCase();
      
      if (isProbablyTransferToOwnAccount(description)) {
        return 'transfer';
      }
      
      if (lowerText.includes('accredito') || lowerText.includes('bonifico in entrata')) {
        return 'income';
      }
      
      return 'expense';
    },
  },
  
  bnl: {
    amountRegex: /€\s*([\d,.]+)/,
    descriptionRegex: /(?:presso|su|a)\s+([^€\n.]+?)(?:\.|$)/i,
    getType: (text, description) => {
      const lowerText = text.toLowerCase();
      
      if (isProbablyTransferToOwnAccount(description)) {
        return 'transfer';
      }
      
      if (lowerText.includes('accredito')) {
        return 'income';
      }
      
      return 'expense';
    },
  },
  
  unicredit: {
    amountRegex: /€\s*([\d,.]+)|EUR\s*([\d,.]+)/i,
    descriptionRegex: /(?:presso|su|merchant|a)\s*[:.:]?\s*([^€\n.]+?)(?:\.|$)/i,
    getType: (text, description) => {
      const lowerText = text.toLowerCase();
      
      if (isProbablyTransferToOwnAccount(description)) {
        return 'transfer';
      }
      
      if (lowerText.includes('accredito') || lowerText.includes('bonifico ricevuto')) {
        return 'income';
      }
      
      return 'expense';
    },
  },
};

/**
 * Parse notification text to extract transaction details
 */
export function parseNotificationTransaction(
  appName: string,
  title: string,
  text: string
): ParsedTransaction | null {
  const fullText = `${title} ${text}`;
  const pattern = BANK_PATTERNS[appName.toLowerCase()];

  if (!pattern) {
    console.warn(`No pattern for bank: ${appName}`);
    return null;
  }

  // Extract amount
  const amountMatch = fullText.match(pattern.amountRegex);
  if (!amountMatch) {
    console.warn(`Could not extract amount from: ${fullText}`);
    return null;
  }

  const amountStr = amountMatch[1] || amountMatch[2] || amountMatch[0];
  const amount = parseFloat(amountStr.replace(',', '.').replace(/[^\d.]/g, ''));

  if (isNaN(amount) || amount <= 0) {
    console.warn(`Invalid amount: ${amountStr}`);
    return null;
  }

  // Extract description - USE FULL TEXT, NO TRUNCATION
  let description = text.trim(); // Default to full notification text
  
  if (pattern.descriptionRegex) {
    const descMatch = fullText.match(pattern.descriptionRegex);
    if (descMatch && descMatch[1]) {
      description = descMatch[1].trim();
    }
  }

  // Clean up description but DON'T truncate
  description = description
    .replace(/\s+/g, ' ')
    .replace(/[€\n]/g, '')
    .trim();

  // If description is empty or too short, use title
  if (description.length < 3 && title) {
    const cleanTitle = title
      .replace(/pagamento|spesa|payment|transazione/gi, '')
      .replace(/€?\s*[\d,.]+\s*€?/g, '')
      .trim();
    if (cleanTitle.length > 3) {
      description = cleanTitle;
    }
  }

  // Determine type (expense, income, or transfer)
  const type = pattern.getType(fullText, description);

  // Extract currency
  const currency = fullText.includes('EUR') ? 'EUR' : '€';

  console.log(`📝 Parsed transaction: ${type} - ${description} - ${amount} ${currency}`);

  return {
    amount,
    description,
    currency,
    type,
    rawText: fullText,
  };
}

/**
 * Generate a unique hash for deduplication
 */
export function generateTransactionHash(
  appName: string,
  amount: number,
  timestamp: number
): string {
  const str = `${appName}-${amount}-${Math.floor(timestamp / 60000)}`;
  return btoa(str).substring(0, 16);
}
