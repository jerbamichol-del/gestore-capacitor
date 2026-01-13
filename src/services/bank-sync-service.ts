import * as jose from 'jose';
import { AutoTransaction } from '../types/transaction';
import { AutoTransactionService } from './auto-transaction-service';

export interface BankSyncCredentials {
    appId: string;
    clientId: string;
    privateKey: string;
}

export class BankSyncService {
    private static readonly STORAGE_KEY = 'bank_sync_credentials';
    private static readonly BASE_URL = 'https://api.enablebanking.com';

    /**
     * Get stored credentials
     */
    static getCredentials(): BankSyncCredentials | null {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        if (!stored) return null;
        try {
            return JSON.parse(stored);
        } catch {
            return null;
        }
    }

    /**
     * Save credentials
     */
    static saveCredentials(creds: BankSyncCredentials): void {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(creds));
    }

    /**
     * Generate signed JWT for Enable Banking
     */
    private static async generateJWT(creds: BankSyncCredentials): Promise<string> {
        const { appId, clientId, privateKey } = creds;

        // Convert PEM to PrivateKey object
        const rsaPrivateKey = await jose.importPKCS8(privateKey, 'RS256');

        const jwt = await new jose.SignJWT({})
            .setProtectedHeader({
                alg: 'RS256',
                typ: 'JWT',
                kid: appId // Enable Banking expects appId as kid
            })
            .setIssuedAt()
            .setIssuer(clientId)
            .setSubject(clientId)
            .setAudience(this.BASE_URL)
            .setExpirationTime('1h')
            .sign(rsaPrivateKey);

        return jwt;
    }

    /**
     * Fetch all authorized accounts
     */
    static async fetchAccounts(): Promise<any[]> {
        const creds = this.getCredentials();
        if (!creds) throw new Error('Credentials not set');

        const token = await this.generateJWT(creds);

        const response = await fetch(`${this.BASE_URL}/accounts`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to fetch accounts: ${error}`);
        }

        const data = await response.json();
        return data.accounts || [];
    }

    /**
     * Fetch transactions for a specific account
     */
    static async fetchTransactions(accountUid: string): Promise<AutoTransaction[]> {
        const creds = this.getCredentials();
        if (!creds) throw new Error('Credentials not set');

        const token = await this.generateJWT(creds);

        const response = await fetch(`${this.BASE_URL}/accounts/${accountUid}/transactions`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to fetch transactions: ${error}`);
        }

        const data = await response.json();
        const transactions = data.transactions || [];

        return transactions.map((tx: any) => this.mapToAutoTransaction(tx, accountUid));
    }

    /**
     * Fetch balance for a specific account
     */
    static async fetchBalance(accountUid: string): Promise<number> {
        const creds = this.getCredentials();
        if (!creds) throw new Error('Credentials not set');

        const token = await this.generateJWT(creds);

        const response = await fetch(`${this.BASE_URL}/accounts/${accountUid}/balances`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to fetch balance: ${error}`);
        }

        const data = await response.json();
        // Priority: closingBooked, expected, or first available
        const balance = data.balances?.find((b: any) => b.balance_type === 'closingBooked')
            || data.balances?.find((b: any) => b.balance_type === 'expected')
            || data.balances?.[0];

        return balance ? parseFloat(balance.balance_amount.value) : 0;
    }

    /**
     * Calculate current local balance from localStorage
     */
    static calculateLocalBalance(accountId: string): number {
        const expenses = JSON.parse(localStorage.getItem('expenses_v2') || '[]');
        return expenses.reduce((acc: number, e: any) => {
            if (e.accountId !== accountId && e.toAccountId !== accountId) return acc;
            const amt = Number(e.amount) || 0;
            if (e.type === 'expense') {
                if (e.accountId === accountId) return acc - amt;
            } else if (e.type === 'income') {
                if (e.accountId === accountId) return acc + amt;
            } else if (e.type === 'adjustment') {
                if (e.accountId === accountId) return acc + amt;
            } else if (e.type === 'transfer') {
                if (e.accountId === accountId) acc -= amt;
                if (e.toAccountId === accountId) acc += amt;
            }
            return acc;
        }, 0);
    }

    /**
     * Sync all accounts (Transactions + Balances)
     */
    static async syncAll(): Promise<{ transactions: number, adjustments: number }> {
        try {
            const accounts = await this.fetchAccounts();
            let totalAdded = 0;
            let adjustmentsCount = 0;

            for (const acc of accounts) {
                // 1. Sync Transactions
                const txs = await this.fetchTransactions(acc.uid);
                for (const tx of txs) {
                    const added = await AutoTransactionService.addAutoTransaction(tx);
                    if (added) totalAdded++;
                }

                // 2. Sync Balance & Reconcile
                const bankBalance = await this.fetchBalance(acc.uid);
                const localBalance = this.calculateLocalBalance(acc.uid);
                const diff = bankBalance - localBalance;

                if (Math.abs(diff) > 0.01) {
                    await AutoTransactionService.addAdjustment(
                        acc.uid,
                        diff,
                        `Riconciliazione Automatica ${acc.account_id?.iban || acc.uid}`
                    );
                    adjustmentsCount++;
                }
            }

            if (totalAdded > 0 || adjustmentsCount > 0) {
                window.dispatchEvent(new CustomEvent('auto-transactions-updated'));
            }

            return { transactions: totalAdded, adjustments: adjustmentsCount };
        } catch (error) {
            console.error('Bank sync failed:', error);
            throw error;
        }
    }

    /**
     * Map Enable Banking transaction to our AutoTransaction format
     */
    private static mapToAutoTransaction(tx: any, accountUid: string): Omit<AutoTransaction, 'id' | 'createdAt' | 'sourceHash' | 'status'> {
        // Determine type
        const amount = parseFloat(tx.amount.value);
        const type = amount < 0 ? 'expense' : 'income';

        return {
            type,
            amount: Math.abs(amount),
            description: tx.description || 'Transazione Bancaria',
            date: tx.booking_date || tx.value_date || new Date().toISOString().split('T')[0],
            account: tx.account_id?.iban || accountUid,
            sourceType: 'bank',
            sourceApp: 'enable_banking',
            rawText: JSON.stringify(tx)
        };
    }
}
