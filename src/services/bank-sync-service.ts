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
    private static readonly STORAGE_KEY_ACTIVE_BANKS = 'bank_sync_active_providers';
    private static readonly BASE_URL = 'https://api.enablebanking.com';

    /**
     * Check if a specific bank is handled by API
     */
    static isBankAPIActive(bankName: string): boolean {
        const active = localStorage.getItem(this.STORAGE_KEY_ACTIVE_BANKS);
        if (!active) return false;
        try {
            const list: string[] = JSON.parse(active);
            // Match if bankName starts with or contains any of the active providers
            return list.some(name =>
                bankName.toLowerCase().includes(name.toLowerCase()) ||
                name.toLowerCase().includes(bankName.toLowerCase())
            );
        } catch {
            return false;
        }
    }

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
     * Ensure the private key is in PKCS#8 format.
     * If it's PKCS#1 (starts with BEGIN RSA PRIVATE KEY), it wraps it in PKCS#8.
     */
    private static ensurePKCS8(privateKey: string): string {
        let trimmed = privateKey.trim();

        // If it starts with BEGIN RSA PRIVATE KEY, it's PKCS#1 and needs wrapping
        if (trimmed.includes('BEGIN RSA PRIVATE KEY')) {
            console.log('🔄 Converting PKCS#1 RSA Private Key to PKCS#8...');

            // Extract the base64 part
            const base64 = trimmed
                .replace('-----BEGIN RSA PRIVATE KEY-----', '')
                .replace('-----END RSA PRIVATE KEY-----', '')
                .replace(/\s/g, '');

            try {
                // PKCS#8 wrapper for RSA (Algorithm OID 1.2.840.113549.1.1.1)
                // This is a simplified ASN.1 encoding for unencrypted RSA private keys
                const der = Uint8Array.from(atob(base64), c => c.charCodeAt(0));

                // PKCS#8 preamble for RSA:
                // SEQUENCE (30)
                //   version (02 01 00)
                //   algorithmIdentifier (30 0d 06 09 2a 86 48 86 f7 0d 01 01 01 05 00)
                //   privateKey (04 [len] [PKCS#1 data])

                const preamble = [
                    0x30, 0x82, 0x00, 0x00, // Sequence + temporary total length
                    0x02, 0x01, 0x00,       // version 0
                    0x30, 0x0d,             // algorithmIdentifier sequence
                    0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, // RSA OID
                    0x05, 0x00,             // null parameters
                    0x04, 0x82, 0x00, 0x00  // privateKey octet string + temporary inner length
                ];

                const innerLen = der.length;
                const totalLen = preamble.length - 4 + innerLen;

                // Update lengths in preamble (Big Endian 16-bit)
                preamble[2] = (totalLen >> 8) & 0xff;
                preamble[3] = totalLen & 0xff;
                preamble[20] = (innerLen >> 8) & 0xff;
                preamble[21] = innerLen & 0xff;

                const wrapped = new Uint8Array(preamble.length + der.length);
                wrapped.set(preamble);
                wrapped.set(der, preamble.length);

                const wrappedBase64 = btoa(String.fromCharCode(...wrapped));
                return `-----BEGIN PRIVATE KEY-----\n${wrappedBase64.match(/.{1,64}/g)?.join('\n')}\n-----END PRIVATE KEY-----`;
            } catch (e) {
                console.error('Failed to convert PKCS#1 to PKCS#8:', e);
                return privateKey; // Fallback to original
            }
        }

        // If it has no headers at all, assume it's PKCS#8 base64 and add headers
        if (!trimmed.includes('-----BEGIN')) {
            console.log('🔧 Adding missing PEM headers to private key...');
            const cleanBase64 = trimmed.replace(/\s/g, '');
            return `-----BEGIN PRIVATE KEY-----\n${cleanBase64.match(/.{1,64}/g)?.join('\n')}\n-----END PRIVATE KEY-----`;
        }

        return trimmed;
    }

    /**
     * Generate signed JWT for Enable Banking
     */
    private static async generateJWT(creds: BankSyncCredentials): Promise<string> {
        const { appId, clientId, privateKey } = creds;

        // Ensure PKCS#8 format for jose
        const pkcs8Key = this.ensurePKCS8(privateKey);

        // Convert PEM to PrivateKey object
        const rsaPrivateKey = await jose.importPKCS8(pkcs8Key, 'RS256');

        const jwt = await new jose.SignJWT({})
            .setProtectedHeader({
                alg: 'RS256',
                typ: 'JWT',
                kid: appId // Enable Banking expects appId as kid
            })
            .setIssuedAt()
            .setIssuer(clientId)
            .setSubject(clientId)
            .setAudience('api.enablebanking.com')
            .setExpirationTime('1h')
            .sign(rsaPrivateKey);

        return jwt;
    }

    /**
     * Helper to perform fetch with better error reporting for CORS/Network issues
     */
    private static async safeFetch(url: string, options: RequestInit): Promise<Response> {
        try {
            console.log(`🌐 Fetching: ${url}`);
            const response = await fetch(url, options);
            console.log(`📡 Response status: ${response.status}`);
            return response;
        } catch (error: any) {
            console.error('❌ Fetch error detailed:', {
                message: error.message,
                stack: error.stack,
                url: url
            });
            if (error.message === 'Failed to fetch') {
                throw new Error('Errore di rete o blocco di sicurezza (CORS). Se hai appena aggiornato l\'app, assicurati di aver installato il NUOVO APK con i fix nativi.');
            }
            throw error;
        }
    }

    /**
     * Diagnostic test to verify credentials and JWT signing.
     * Hits /aspsps which only requires a valid JWT.
     */
    static async testConnection(): Promise<boolean> {
        const creds = this.getCredentials();
        if (!creds) throw new Error('Credentials not set');

        const token = await this.generateJWT(creds);

        console.log('🧪 Testing connection via /aspsps...');
        const response = await this.safeFetch(`${this.BASE_URL}/aspsps`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Errore Connessione (${response.status}): ${error}`);
        }

        console.log('✅ Connection test successful!');
        return true;
    }

    /**
     * Fetch all authorized accounts
     */
    static async fetchAccounts(): Promise<any[]> {
        const creds = this.getCredentials();
        if (!creds) throw new Error('Credentials not set');

        const token = await this.generateJWT(creds);

        const response = await this.safeFetch(`${this.BASE_URL}/accounts`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Errore API (${response.status}): ${error}`);
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

        const response = await this.safeFetch(`${this.BASE_URL}/accounts/${accountUid}/transactions`, {
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

        const response = await this.safeFetch(`${this.BASE_URL}/accounts/${accountUid}/balances`, {
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
            const activeProviders = new Set<string>();

            for (const acc of accounts) {
                // Collect provider name for suppression logic
                if (acc.aspsp_name) activeProviders.add(acc.aspsp_name);
                if (acc.provider?.name) activeProviders.add(acc.provider.name);
                // Fallback to display name if it contains bank keywords
                if (acc.display_name) activeProviders.add(acc.display_name);

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

            // Save active providers for listener suppression
            if (activeProviders.size > 0) {
                localStorage.setItem(this.STORAGE_KEY_ACTIVE_BANKS, JSON.stringify(Array.from(activeProviders)));
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
