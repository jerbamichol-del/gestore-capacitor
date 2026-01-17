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
    private static readonly STORAGE_KEY_MAPPINGS = 'bank_sync_account_mappings';
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
     */
    static async testConnection(): Promise<boolean> {
        const aspsps = await this.fetchASPSPs();
        return aspsps.length > 0;
    }

    /**
     * Fetch list of supported banks
     */
    static async fetchASPSPs(country?: string): Promise<any[]> {
        const creds = this.getCredentials();
        if (!creds) throw new Error('Credentials not set');

        const token = await this.generateJWT(creds);
        let url = `${this.BASE_URL}/aspsps`;
        if (country) url += `?country=${country}`;

        const response = await this.safeFetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Errore API (${response.status}): ${error}`);
        }

        const data = await response.json();
        return data.aspsps || [];
    }

    /**
     * Start authorization process for a bank
     */
    static async startAuthorization(aspsp: { name: string, country: string }, redirectUrl: string): Promise<string> {
        const creds = this.getCredentials();
        if (!creds) throw new Error('Credentials not set');

        const token = await this.generateJWT(creds);
        const response = await this.safeFetch(`${this.BASE_URL}/auth`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                aspsp: {
                    name: aspsp.name,
                    country: aspsp.country
                },
                redirect_url: redirectUrl,
                state: Math.random().toString(36).substring(7),
                access: {
                    valid_until: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
                    balances: true,
                    transactions: true
                }
            })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Errore Start Auth (${response.status}): ${error}`);
        }

        const data = await response.json();
        return data.url; // Redirect user to this URL
    }

    /**
     * Authorize session with code from redirect
     */
    static async authorizeSession(code: string, redirectUrl?: string): Promise<string> {
        const creds = this.getCredentials();
        if (!creds) throw new Error('Credentials not set');

        const token = await this.generateJWT(creds);

        const body: any = { code };
        // Some banks (Revolut) require redirect_url to be present + match the one used in /auth
        if (redirectUrl) {
            body.redirect_url = redirectUrl;
        }

        console.log('📤 POST /sessions request:', {
            code: code.substring(0, 10) + '...',
            redirect_url: redirectUrl
        });

        const response = await this.safeFetch(`${this.BASE_URL}/sessions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ POST /sessions failed:', response.status, errorText);

            // Try to parse JSON error for better message
            try {
                const errorJson = JSON.parse(errorText);
                const message = errorJson.message || errorJson.error || errorJson.detail || errorText;
                throw new Error(`Auth Session (${response.status}): ${message}`);
            } catch (parseError) {
                throw new Error(`Errore Auth Session (${response.status}): ${errorText}`);
            }
        }

        const data = await response.json();
        console.log('✅ Session authorized:', data.session_id);

        // Store session ID in list of sessions
        const sessions = await this.getSessions();
        if (!sessions.includes(data.session_id)) {
            sessions.push(data.session_id);
            localStorage.setItem('bank_sync_sessions', JSON.stringify(sessions));
        }

        return data.session_id;
    }

    private static async getSessions(): Promise<string[]> {
        const stored = localStorage.getItem('bank_sync_sessions');
        return stored ? JSON.parse(stored) : [];
    }

    private static async removeSession(sessionId: string): Promise<void> {
        const sessions = await this.getSessions();
        const filtered = sessions.filter(s => s !== sessionId);
        localStorage.setItem('bank_sync_sessions', JSON.stringify(filtered));
        console.log(`Removed expired session: ${sessionId}`);
    }

    static async clearAllSessions(): Promise<void> {
        localStorage.removeItem('bank_sync_sessions');
        localStorage.removeItem(this.STORAGE_KEY_ACTIVE_BANKS);
        localStorage.removeItem(this.STORAGE_KEY_MAPPINGS);
        console.log('Cleared all bank sync sessions and mappings');
    }

    /**
     * Get manual mappings for accounts
     */
    static getAccountMappings(): Record<string, string> {
        const stored = localStorage.getItem(this.STORAGE_KEY_MAPPINGS);
        return stored ? JSON.parse(stored) : {};
    }

    /**
     * Save a manual mapping for a bank account
     */
    static setAccountMapping(bankUid: string, localId: string): void {
        const mappings = this.getAccountMappings();
        mappings[bankUid] = localId;
        localStorage.setItem(this.STORAGE_KEY_MAPPINGS, JSON.stringify(mappings));
    }

    /**
     * Fetch all authorized accounts, removing expired sessions
     */
    static async fetchAccounts(): Promise<any[]> {
        const creds = this.getCredentials();
        if (!creds) throw new Error('Credentials not set');

        const token = await this.generateJWT(creds);
        const sessions = await this.getSessions();
        let allAccounts = new Map<string, any>();
        let expiredSessions: string[] = [];
        let validSessionCount = 0;

        for (const sessionId of sessions) {
            try {
                const response = await this.safeFetch(`${this.BASE_URL}/sessions/${sessionId}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.accounts_data) {
                        // De-duplicate accounts by UID
                        for (const acc of data.accounts_data) {
                            if (!allAccounts.has(acc.uid)) {
                                allAccounts.set(acc.uid, {
                                    ...acc,
                                    _sessionId: sessionId
                                });
                            } else {
                                console.log(`Skipping duplicate account ${acc.uid} from session ${sessionId}`);
                            }
                        }
                    }
                    validSessionCount++;
                } else if (response.status === 401) {
                    // Session expired
                    const errorText = await response.text();
                    console.warn(`Session ${sessionId} expired:`, errorText);
                    expiredSessions.push(sessionId);
                }
            } catch (e) {
                console.error(`Failed to fetch session ${sessionId}:`, e);
            }
        }

        // Remove expired sessions
        for (const expiredId of expiredSessions) {
            await this.removeSession(expiredId);
        }

        // If all sessions expired, throw specific error
        if (expiredSessions.length > 0 && validSessionCount === 0) {
            throw new Error('SESSION_EXPIRED: Tutte le sessioni bancarie sono scadute. Ricollega la banca dalle impostazioni.');
        }

        if (expiredSessions.length > 0 && validSessionCount > 0) {
            console.warn(`${expiredSessions.length} sessioni scadute rimosse, ${validSessionCount} ancora valide`);
        }

        return Array.from(allAccounts.values());
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
            // Check if session expired
            if (response.status === 401) {
                console.warn(`Session expired for account ${accountUid}`);
                return []; // Return empty instead of throwing
            }
            throw new Error(`Failed to fetch transactions: ${error}`);
        }

        const data = await response.json();
        console.log('Transactions API response:', JSON.stringify(data, null, 2));
        const transactions = data.transactions || [];
        console.log(`Found ${transactions.length} transactions for account ${accountUid}`);

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
            // Check if session expired
            if (response.status === 401) {
                console.warn(`Session expired for account ${accountUid}`);
                return 0; // Return 0 instead of throwing
            }
            throw new Error(`Failed to fetch balance: ${error}`);
        }

        const data = await response.json();
        console.log('Balance API response:', JSON.stringify(data, null, 2));

        // Enable Banking API uses balanceType (camelCase) and amount.amount structure
        const balance = data.balances?.find((b: any) => b.balanceType === 'closingBooked' || b.balance_type === 'closingBooked')
            || data.balances?.find((b: any) => b.balanceType === 'expected' || b.balance_type === 'expected')
            || data.balances?.find((b: any) => b.balanceType === 'AVAILABLE' || b.balanceType === 'BOOKED')
            || data.balances?.[0];

        if (!balance) {
            console.warn('No balance found in response');
            return 0;
        }

        // Handle multiple possible formats: amount.amount, balance_amount.amount, balance_amount.value
        const balanceValue = balance.amount?.amount
            ?? balance.balance_amount?.amount
            ?? balance.balance_amount?.value
            ?? balance.amount?.value
            ?? balance.amount
            ?? 0;

        console.log('Parsed balance value:', balanceValue);
        return parseFloat(String(balanceValue)) || 0;
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
     * Resolve the local account ID from an Enable Banking account object.
     * Tries to find matching local storage accounts to avoid using cryptic UIDs in the UI.
     */
    /**
     * Resolve the local account ID from an Enable Banking account object.
     * Tries to find matching local storage accounts to avoid using cryptic UIDs in the UI.
     */
    private static resolveLocalAccountId(acc: any): string {
        try {
            const mappings = this.getAccountMappings();
            if (mappings[acc.uid]) {
                console.log(`Explicit mapping found for ${acc.uid} -> ${mappings[acc.uid]}`);
                return mappings[acc.uid];
            }

            const accounts = JSON.parse(localStorage.getItem('accounts_v1') || '[]');

            // Extract all possible names from the bank account object
            const aspspName = (acc.aspsp_name || acc.aspspName || '').toLowerCase().trim();
            const displayName = (acc.display_name || acc.displayName || '').toLowerCase().trim();
            const officialName = (acc.name || '').toLowerCase().trim();
            const iban = (acc.account_id?.iban || acc.accountId?.iban || '').toLowerCase().trim();

            const bankNames = Array.from(new Set([aspspName, displayName, officialName])).filter(n => n.length > 0);
            console.log(`Resolving local account for: ASPSP=${aspspName}, Display=${displayName}, Official=${officialName}, IBAN=${iban}`);

            // 1. Hardcoded Brand Matching (High Confidence)
            const combinedInfo = [...bankNames, iban].join(' ');
            if (combinedInfo.includes('revolut')) {
                const found = accounts.find((a: any) => a.id === 'revolut' || a.name.toLowerCase().includes('revolut'));
                if (found) return found.id;
            }
            if (combinedInfo.includes('paypal')) {
                const found = accounts.find((a: any) => a.id === 'paypal' || a.name.toLowerCase().includes('paypal'));
                if (found) return found.id;
            }
            if (combinedInfo.includes('poste')) {
                const found = accounts.find((a: any) => a.id === 'poste' || a.name.toLowerCase().includes('poste'));
                if (found) return found.id;
            }

            // 2. Exact Name Match (Solid Confidence)
            for (const la of accounts) {
                const localName = la.name.toLowerCase().trim();

                // Never match to "Contanti" or "Cash" automatically unless it's a very specific intentional match
                if (la.id === 'cash' || localName.includes('contanti')) continue;

                if (bankNames.some(bn => bn === localName)) {
                    console.log(`Exact name match found: ${la.id} (${la.name})`);
                    return la.id;
                }
            }

            // 3. ID match (If internal UID matches local ID)
            if (accounts.some((la: any) => la.id === acc.uid)) return acc.uid;

            // 4. Fuzzy Match (Last resort, very strict)
            // We want to avoid matching generic bank words with specific local accounts like "Contanti"
            for (const la of accounts) {
                const localName = la.name.toLowerCase().trim();

                // Never fuzzy-match to "Contanti" (cash is almost always manual)
                if (la.id === 'cash' || localName.includes('contanti')) continue;

                // Ignore very generic or short local names for fuzzy matching to avoid noise
                if (localName.length < 5 || localName === 'conto' || localName === 'bank') continue;

                for (const bn of bankNames) {
                    if (bn.length < 4) continue; // Skip too short bank-provided names
                    if (bn.includes(localName) || localName.includes(bn)) {
                        console.log(`Fuzzy match found: ${la.id} matches bank information "${bn}"`);
                        return la.id;
                    }
                }
            }

        } catch (e) {
            console.error('Error in resolveLocalAccountId:', e);
        }

        console.warn(`Could not resolve local account for ${acc.uid}, using UID as is.`);
        return acc.uid; // Fallback to provided UID
    }

    /**
     * Sync all accounts (Transactions + Balances)
     */
    static async syncAll(): Promise<{ transactions: number, adjustments: number }> {
        try {
            const accounts = await this.fetchAccounts();
            console.log('Fetched accounts:', JSON.stringify(accounts, null, 2));
            let totalAdded = 0;
            let adjustmentsCount = 0;
            const activeProviders = new Set<string>();

            const syncedLocalIds = new Set<string>();

            for (const acc of accounts) {
                const localAccountId = this.resolveLocalAccountId(acc);
                syncedLocalIds.add(localAccountId);
                console.log(`Mapping API account ${acc.uid} to local ID: ${localAccountId}`);

                // Collect provider name for suppression logic
                if (acc.aspsp_name) activeProviders.add(acc.aspsp_name);
                if (acc.provider?.name) activeProviders.add(acc.provider.name);
                if (acc.aspspName) activeProviders.add(acc.aspspName);
                if (acc.display_name) activeProviders.add(acc.display_name);
                if (acc.displayName) activeProviders.add(acc.displayName);

                // 1. Sync Transactions
                const txs = await this.fetchTransactions(acc.uid);
                console.log(`Account ${acc.uid}: ${txs.length} transactions fetched`);
                for (const tx of txs) {
                    // Inject the resolved local account ID into the mapped transaction
                    const mappedTx = this.mapToAutoTransaction(tx, localAccountId);
                    const added = await AutoTransactionService.addAutoTransaction(mappedTx);
                    if (added) totalAdded++;
                }

                // 2. Sync Balance & Reconcile
                const bankBalance = await this.fetchBalance(acc.uid);
                console.log(`Account ${localAccountId}: Bank balance = ${bankBalance}`);

                const localBalance = this.calculateLocalBalance(localAccountId);
                console.log(`Account ${localAccountId}: Local balance = ${localBalance}`);

                const diff = bankBalance - localBalance;
                console.log(`Account ${localAccountId}: Difference = ${diff}`);

                if (Math.abs(diff) > 0.01) {
                    await AutoTransactionService.addAdjustment(
                        localAccountId,
                        diff,
                        `Riconciliazione Automatica ${acc.account_id?.iban || acc.accountId?.iban || acc.name || localAccountId}`
                    );
                    adjustmentsCount++;
                }
            }

            if (totalAdded > 0 || adjustmentsCount > 0) {
                window.dispatchEvent(new CustomEvent('auto-transactions-updated'));
                window.dispatchEvent(new CustomEvent('expenses-updated')); // Ensure screens like AccountsScreen refresh
            }

            // Save active providers for listener suppression
            if (activeProviders.size > 0) {
                localStorage.setItem(this.STORAGE_KEY_ACTIVE_BANKS, JSON.stringify(Array.from(activeProviders)));
            }

            // Save specifically which LOCAL IDEs are synced to disable manual edits
            localStorage.setItem('bank_sync_synced_local_ids', JSON.stringify(Array.from(syncedLocalIds)));

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
        console.log('Mapping transaction:', JSON.stringify(tx, null, 2));

        // Handle multiple possible amount formats from Enable Banking API
        let rawAmount: string | number = 0;
        if (tx.transaction_amount && typeof tx.transaction_amount === 'object') {
            rawAmount = tx.transaction_amount.amount ?? tx.transaction_amount.value ?? 0;
        } else if (tx.transactionAmount && typeof tx.transactionAmount === 'object') {
            rawAmount = tx.transactionAmount.amount ?? tx.transactionAmount.value ?? 0;
        } else if (tx.amount && typeof tx.amount === 'object') {
            rawAmount = tx.amount.amount ?? tx.amount.value ?? 0;
        } else if (tx.amount !== undefined) {
            rawAmount = tx.amount;
        }

        const amount = parseFloat(String(rawAmount)) || 0;
        console.log('Parsed transaction amount:', amount, 'from raw:', rawAmount);

        // Determine type based on transaction type field or amount sign
        let type: 'expense' | 'income' = amount < 0 ? 'expense' : 'income';
        if (tx.transactionType === 'DEBIT' || tx.creditDebitIndicator === 'DBIT' || tx.credit_debit_indicator === 'DBIT') {
            type = 'expense';
        } else if (tx.transactionType === 'CREDIT' || tx.creditDebitIndicator === 'CRDT' || tx.credit_debit_indicator === 'CRDT') {
            type = 'income';
        }

        // Handle multiple date formats
        const date = tx.bookingDate || tx.booking_date
            || tx.transactionDate || tx.transaction_date
            || tx.valueDate || tx.value_date
            || new Date().toISOString().split('T')[0];

        // Get description from multiple possible fields
        let remittanceInfo = tx.remittance_information || tx.remittanceInformation;
        if (Array.isArray(remittanceInfo)) {
            remittanceInfo = remittanceInfo.join(' ');
        }
        let description = tx.description || remittanceInfo
            || tx.remittanceInformationUnstructured
            || tx.creditorName || tx.creditor_name
            || tx.debtorName || tx.debtor_name
            || 'Transazione Bancaria';

        // Truncate description to prevent UI overflow
        if (description && description.length > 80) {
            description = description.substring(0, 77) + '...';
        }

        return {
            type,
            amount: Math.abs(amount),
            description,
            date,
            account: accountUid, // Using the resolved localAccountId passed here
            sourceType: 'bank',
            sourceApp: 'enable_banking',
            rawText: JSON.stringify(tx)
        };
    }
}
