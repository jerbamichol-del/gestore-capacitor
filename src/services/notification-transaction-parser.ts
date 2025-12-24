// src/services/notification-transaction-parser.ts

export interface ParsedTransaction {
  amount: number;
  description: string;
  currency: string;
  type: 'expense' | 'income';
  rawText: string;
}

interface BankPattern {
  amountRegex: RegExp;
  descriptionRegex?: RegExp;
  currencyRegex?: RegExp;
  isExpense: (text: string) => boolean;
}

const BANK_PATTERNS: Record<string, BankPattern> = {
  revolut: {
    amountRegex: /€?\s*([\d,.]+)\s*€?/,
    descriptionRegex: /(?:presso|at|a)\s+([^€\n]+)/i,
    isExpense: (text) => 
      text.toLowerCase().includes('pagamento') || 
      text.toLowerCase().includes('spesa') ||
      text.toLowerCase().includes('payment'),
  },
  
  paypal: {
    amountRegex: /€?\s*([\d,.]+)\s*EUR/i,
    descriptionRegex: /(?:a|to|per)\s+([^€\n]+)/i,
    isExpense: (text) => 
      text.toLowerCase().includes('hai inviato') ||
      text.toLowerCase().includes('pagamento') ||
      text.toLowerCase().includes('you sent'),
  },
  
  postepay: {
    amountRegex: /€\s*([\d,.]+)/,
    descriptionRegex: /(?:presso|su|at)\s+([^€\n]+)/i,
    isExpense: (text) => 
      text.toLowerCase().includes('pagamento') ||
      text.toLowerCase().includes('spesa'),
  },
  
  bbva: {
    amountRegex: /([\d,.]+)\s*€/,
    descriptionRegex: /(?:en|presso)\s+([^€\n]+)/i,
    isExpense: (text) => 
      text.toLowerCase().includes('compra') ||
      text.toLowerCase().includes('pago') ||
      text.toLowerCase().includes('pagamento'),
  },
  
  intesa: {
    amountRegex: /€\s*([\d,.]+)/,
    descriptionRegex: /(?:presso|carta)\s+([^€\n]+)/i,
    isExpense: (text) => 
      text.toLowerCase().includes('pagamento') ||
      text.toLowerCase().includes('addebito'),
  },
  
  bnl: {
    amountRegex: /€\s*([\d,.]+)/,
    descriptionRegex: /(?:presso|su)\s+([^€\n]+)/i,
    isExpense: (text) => 
      text.toLowerCase().includes('pagamento') ||
      text.toLowerCase().includes('spesa'),
  },
  
  unicredit: {
    amountRegex: /€\s*([\d,.]+)|EUR\s*([\d,.]+)/i,
    descriptionRegex: /(?:presso|su|merchant)\s*[:.]?\s*([^€\n]+)/i,
    isExpense: (text) => 
      text.toLowerCase().includes('pagamento') ||
      text.toLowerCase().includes('spesa') ||
      text.toLowerCase().includes('addebito') ||
      text.toLowerCase().includes('carta'),
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

  // Extract description
  let description = 'Transazione';
  if (pattern.descriptionRegex) {
    const descMatch = fullText.match(pattern.descriptionRegex);
    if (descMatch && descMatch[1]) {
      description = descMatch[1].trim();
      // Clean up description
      description = description
        .replace(/\s+/g, ' ')
        .replace(/[€\n]/g, '')
        .trim()
        .substring(0, 50);
    }
  }

  // If no description found, try to extract from title
  if (description === 'Transazione' && title) {
    const cleanTitle = title
      .replace(/pagamento|spesa|payment|transazione/gi, '')
      .replace(/€?\s*[\d,.]+\s*€?/g, '')
      .trim();
    if (cleanTitle.length > 3) {
      description = cleanTitle.substring(0, 50);
    }
  }

  // Determine type
  const type = pattern.isExpense(fullText) ? 'expense' : 'income';

  // Extract currency
  const currency = fullText.includes('EUR') ? 'EUR' : '€';

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
