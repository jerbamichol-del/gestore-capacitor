// src/services/deduplication-service.ts
// Prevents duplicate expenses when a bank transaction matches a recurring-generated expense.

import { Expense } from '../types';
import { parseLocalYYYYMMDD } from '../utils/date';

interface BankTransaction {
    description: string;
    amount: number;
    date: string; // YYYY-MM-DD
}

interface MatchResult {
    expense: Expense;
    score: number; // 0-1, higher = better match
}

/**
 * Tolerance thresholds for matching bank transactions to recurring expenses.
 */
const AMOUNT_TOLERANCE = 0.05; // ±5%
const DATE_TOLERANCE_DAYS = 7;  // ±7 days
const MIN_DESCRIPTION_SIMILARITY = 0.4; // 40% similarity threshold

export class DeduplicationService {

    /**
     * Find a recurring-generated expense that matches a bank transaction.
     * Returns the best matching expense, or null if no match found.
     */
    static findMatchingRecurringExpense(
        bankTx: BankTransaction,
        existingExpenses: Expense[]
    ): Expense | null {
        // Only consider expenses that were auto-generated from a recurring template
        const recurringGenerated = existingExpenses.filter(e =>
            e.recurringExpenseId && e.frequency === 'single'
        );

        if (recurringGenerated.length === 0) return null;

        const matches: MatchResult[] = [];

        for (const expense of recurringGenerated) {
            const score = this.calculateMatchScore(bankTx, expense);
            if (score > 0) {
                matches.push({ expense, score });
            }
        }

        if (matches.length === 0) return null;

        // Return highest scoring match
        matches.sort((a, b) => b.score - a.score);
        return matches[0].expense;
    }

    /**
     * Calculate a match score between a bank transaction and a recurring expense.
     * Returns 0 if any hard criteria fail, otherwise a score between 0 and 1.
     */
    private static calculateMatchScore(bankTx: BankTransaction, expense: Expense): number {
        // --- Hard criteria (must ALL pass) ---

        // 1. Amount within tolerance
        const amountDiff = Math.abs(bankTx.amount - expense.amount);
        const amountThreshold = expense.amount * AMOUNT_TOLERANCE;
        if (amountDiff > amountThreshold) return 0;

        // 2. Date within tolerance
        const bankDate = parseLocalYYYYMMDD(bankTx.date);
        const expenseDate = parseLocalYYYYMMDD(expense.date);
        if (!bankDate || !expenseDate) return 0;

        const daysDiff = Math.abs(
            (bankDate.getTime() - expenseDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysDiff > DATE_TOLERANCE_DAYS) return 0;

        // --- Soft criteria (contribute to score) ---

        // Amount score: closer = better (1.0 at exact, 0.0 at tolerance edge)
        const amountScore = 1 - (amountDiff / Math.max(amountThreshold, 0.01));

        // Date score: closer = better
        const dateScore = 1 - (daysDiff / DATE_TOLERANCE_DAYS);

        // Description similarity
        const descScore = this.calculateStringSimilarity(
            this.normalizeDescription(bankTx.description),
            this.normalizeDescription(expense.description)
        );

        // If description is very dissimilar, still allow match if amount+date are very close
        const hasStrongAmountDateMatch = amountScore > 0.9 && dateScore > 0.7;
        if (descScore < MIN_DESCRIPTION_SIMILARITY && !hasStrongAmountDateMatch) return 0;

        // Weighted final score
        return (amountScore * 0.4) + (dateScore * 0.3) + (descScore * 0.3);
    }

    /**
     * Normalize a description for comparison:
     * - lowercase
     * - remove special characters
     * - trim whitespace
     */
    private static normalizeDescription(desc: string): string {
        return desc
            .toLowerCase()
            .replace(/[^a-z0-9àèéìòùáéíóú\s]/gi, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Calculate Dice coefficient similarity between two strings.
     * Returns a value between 0 (no similarity) and 1 (identical).
     */
    private static calculateStringSimilarity(a: string, b: string): number {
        if (a === b) return 1;
        if (a.length === 0 || b.length === 0) return 0;

        // Check if one contains the other
        if (a.includes(b) || b.includes(a)) return 0.85;

        // Bigram-based Dice coefficient
        const bigramsA = this.getBigrams(a);
        const bigramsB = this.getBigrams(b);

        if (bigramsA.size === 0 || bigramsB.size === 0) return 0;

        let intersectionSize = 0;
        for (const bigram of bigramsA) {
            if (bigramsB.has(bigram)) intersectionSize++;
        }

        return (2 * intersectionSize) / (bigramsA.size + bigramsB.size);
    }

    /**
     * Get bigrams (pairs of adjacent characters) from a string.
     */
    private static getBigrams(str: string): Set<string> {
        const bigrams = new Set<string>();
        for (let i = 0; i < str.length - 1; i++) {
            bigrams.add(str.substring(i, i + 2));
        }
        return bigrams;
    }
}
