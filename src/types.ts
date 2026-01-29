
export interface Account {
  id: string;
  name: string;
  icon?: string;
}

export interface Expense {
  id: string;
  type: 'expense' | 'income' | 'transfer' | 'adjustment'; // Added adjustment
  description: string;
  amount: number;
  date: string;
  time?: string;
  category: string;
  subcategory?: string;
  accountId: string;
  toAccountId?: string; // Added for transfers
  tags?: string[];
  receipts?: string[];
  frequency?: 'single' | 'recurring';
  recurrence?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  monthlyRecurrenceType?: 'dayOfMonth' | 'dayOfWeek';
  recurrenceInterval?: number;
  recurrenceDays?: number[];
  recurrenceEndType?: 'forever' | 'date' | 'count';
  recurrenceEndDate?: string;
  recurrenceCount?: number;
  recurringExpenseId?: string;
  lastGeneratedDate?: string;
}

export type Budgets = Record<string, number>; // e.g., { 'Alimentari': 500, 'total': 2000 }

export interface EventBudget {
  id: string;
  name: string;
  totalBudget: number;
  startDate: string;
  endDate: string;
  // Opzionale: filtrare per categorie specifiche. Se vuoto, include tutte le spese nel range temporale.
  categories?: string[];
  icon?: string;
  color?: string;
}
