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
     * Sync all accounts
     */
    static async syncAll(): Promise<number> {
        try {
            const accounts = await this.fetchAccounts();
            let totalAdded = 0;

            for (const acc of accounts) {
                const txs = await this.fetchTransactions(acc.uid);
                for (const tx of txs) {
                    const added = await AutoTransactionService.addAutoTransaction(tx);
                    if (added) totalAdded++;
                }
            }

            if (totalAdded > 0) {
                window.dispatchEvent(new CustomEvent('auto-transactions-updated'));
            }

            return totalAdded;
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
