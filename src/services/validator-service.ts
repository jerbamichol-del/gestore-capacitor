
import { AutoTransaction } from '../types/transaction';

export class ValidatorService {

    // Configurable thresholds
    private static THRESHOLD_HIGH_AMOUNT = 1000;
    private static SUSPICIOUS_CATEGORIES = ['Altro', 'Da Categorizzare'];

    /**
     * Run all checks on a transaction
     */
    static validate(tx: Partial<AutoTransaction>): string[] {
        const warnings: string[] = [];

        this.checkAmount(tx, warnings);
        this.checkCategory(tx, warnings);
        this.checkSuspiciousDescription(tx, warnings);

        return warnings;
    }

    private static checkAmount(tx: Partial<AutoTransaction>, warnings: string[]) {
        if (tx.amount && tx.amount > this.THRESHOLD_HIGH_AMOUNT) {
            warnings.push(`⚠️ Importo elevato (> €${this.THRESHOLD_HIGH_AMOUNT})`);
        }
        if (tx.amount === 0) {
            warnings.push(`⚠️ Importo zero detected`);
        }
    }

    private static checkCategory(tx: Partial<AutoTransaction>, warnings: string[]) {
        if (tx.category && this.SUSPICIOUS_CATEGORIES.includes(tx.category) && (tx.amount || 0) > 50) {
            warnings.push(`⚠️ Categoria generica per importo rilevante`);
        }
    }

    private static checkSuspiciousDescription(tx: Partial<AutoTransaction>, warnings: string[]) {
        const lowerDesc = (tx.description || '').toLowerCase();
        if (lowerDesc.length < 3) {
            warnings.push(`⚠️ Descrizione troppo breve`);
        }
        // Example: logic to detect internal transfer keywords in expenses
        if (tx.type === 'expense' && (lowerDesc.includes('giroconto') || lowerDesc.includes('trasferimento'))) {
            warnings.push(`⚠️ Possibile trasferimento classificato come spesa`);
        }
    }
}
