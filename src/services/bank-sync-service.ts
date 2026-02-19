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

    // Sync lock to prevent concurrent syncs
    private static isSyncing = false;

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
        localStorage.removeItem('bank_sync_synced_local_ids');

        // Clear cachedBalance from all local accounts
        try {
            const localAccounts = JSON.parse(localStorage.getItem('accounts_v1') || '[]');
            let changed = false;
            for (const acc of localAccounts) {
                if (acc.cachedBalance !== undefined) {
                    delete acc.cachedBalance;
                    delete acc.lastSyncDate;
                    changed = true;
                }
            }
            if (changed) {
                localStorage.setItem('accounts_v1', JSON.stringify(localAccounts));
                window.dispatchEvent(new CustomEvent('accounts-updated'));
                window.dispatchEvent(new CustomEvent('expenses-updated'));
            }
        } catch (e) {
            console.error('Error clearing cachedBalance:', e);
        }

        console.log('Cleared all bank sync sessions, mappings, and synced state');
    }

    /**
     * Disconnect a specific session by ID.
     * Also recalculates which accounts are still synced and clears stale cachedBalance.
     */
    static async disconnectSession(sessionId: string): Promise<void> {
        const sessions = await this.getSessions();
        const filtered = sessions.filter(s => s !== sessionId);
        localStorage.setItem('bank_sync_sessions', JSON.stringify(filtered));
        console.log(`Disconnected bank session: ${sessionId}`);

        // If no sessions remain, clear all synced state
        if (filtered.length === 0) {
            localStorage.removeItem('bank_sync_synced_local_ids');
            // Clear cachedBalance from all local accounts
            try {
                const localAccounts = JSON.parse(localStorage.getItem('accounts_v1') || '[]');
                let changed = false;
                for (const acc of localAccounts) {
                    if (acc.cachedBalance !== undefined) {
                        delete acc.cachedBalance;
                        delete acc.lastSyncDate;
                        changed = true;
                    }
                }
                if (changed) {
                    localStorage.setItem('accounts_v1', JSON.stringify(localAccounts));
                    window.dispatchEvent(new CustomEvent('accounts-updated'));
                    window.dispatchEvent(new CustomEvent('expenses-updated'));
                }
            } catch (e) {
                console.error('Error clearing cachedBalance on disconnect:', e);
            }
        } else {
            // Recalculate synced IDs by fetching remaining accounts
            try {
                const remainingAccounts = await this.fetchAccounts();
                const stillSyncedIds = new Set<string>();
                for (const acc of remainingAccounts) {
                    const localId = this.resolveLocalAccountId(acc);
                    stillSyncedIds.add(localId);
                }
                localStorage.setItem('bank_sync_synced_local_ids', JSON.stringify(Array.from(stillSyncedIds)));

                // Clear cachedBalance for accounts no longer synced
                const localAccounts = JSON.parse(localStorage.getItem('accounts_v1') || '[]');
                let changed = false;
                for (const acc of localAccounts) {
                    if (acc.cachedBalance !== undefined && !stillSyncedIds.has(acc.id)) {
                        delete acc.cachedBalance;
                        delete acc.lastSyncDate;
                        changed = true;
                    }
                }
                if (changed) {
                    localStorage.setItem('accounts_v1', JSON.stringify(localAccounts));
                }
                window.dispatchEvent(new CustomEvent('accounts-updated'));
                window.dispatchEvent(new CustomEvent('expenses-updated'));
            } catch (e) {
                console.error('Error recalculating synced IDs after disconnect:', e);
            }
        }
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
     * Fetch all authorized accounts, removing expired and stale sessions.
     * Accounts are de-duplicated by UID. Sessions are preserved unless expired or
     * stale (returning 0 accounts and not the newest session).
     */
    static async fetchAccounts(): Promise<any[]> {
        const creds = this.getCredentials();
        if (!creds) throw new Error('Credentials not set');

        const token = await this.generateJWT(creds);
        const sessions = await this.getSessions();
        let allAccounts = new Map<string, any>();
        let expiredSessions: string[] = [];
        let emptySessions: string[] = [];
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
                    const accountsData = data.accounts_data || [];
                    console.log(`Session ${sessionId} returned ${accountsData.length} accounts`);

                    if (accountsData.length === 0) {
                        // Session has no accounts - might be stale or still loading
                        emptySessions.push(sessionId);
                    } else {
                        validSessionCount++;

                        // De-duplicate accounts by UID (keep first seen)
                        for (const acc of accountsData) {
                            const uid = String(acc.uid).toLowerCase();
                            if (!allAccounts.has(uid)) {
                                allAccounts.set(uid, {
                                    ...acc,
                                    _sessionId: sessionId
                                });
                            } else {
                                console.log(`🔄 Duplicate account ${acc.uid} already covered by another session (keeping both sessions)`);
                            }
                        }
                    }
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

        // Clean up stale empty sessions, but ALWAYS keep the newest one
        // (it might still be loading accounts from bank authorization)
        if (emptySessions.length > 0) {
            // The last session in the list is the newest (appended on creation)
            const newestSession = sessions[sessions.length - 1];
            const staleEmpty = emptySessions.filter(s => s !== newestSession);

            for (const staleId of staleEmpty) {
                await this.removeSession(staleId);
                console.log(`🧹 Removed stale empty session: ${staleId}`);
            }

            if (staleEmpty.length > 0) {
                console.log(`🧹 Cleaned ${staleEmpty.length} stale empty sessions`);
            }

            // Log if newest session is empty (still loading)
            if (emptySessions.includes(newestSession)) {
                console.log(`⏳ Newest session ${newestSession} has 0 accounts (may still be loading)`);
            }
        }

        // If all sessions expired, throw specific error
        if (expiredSessions.length > 0 && validSessionCount === 0 && emptySessions.length === 0) {
            throw new Error('SESSION_EXPIRED: Tutte le sessioni bancarie sono scadute. Ricollega la banca dalle impostazioni.');
        }

        if (expiredSessions.length > 0 && validSessionCount > 0) {
            console.warn(`${expiredSessions.length} sessioni scadute rimosse, ${validSessionCount} ancora valide`);
        }

        return Array.from(allAccounts.values());
    }

    /**
     * Fetch RAW transactions for a specific account (not mapped)
     * Returns the raw API response for mapping in syncAll with correct local account ID
     * ✅ Requests BOTH booked AND pending transactions for real-time visibility
     */
    static async fetchRawTransactions(accountUid: string): Promise<any[]> {
        const creds = this.getCredentials();
        if (!creds) throw new Error('Credentials not set');

        const token = await this.generateJWT(creds);

        // ✅ Request both booked and pending transactions
        // This ensures users see transactions immediately (pending) and when finalized (booked)
        // The bankTransactionId-based hash prevents duplicates when status changes
        const response = await this.safeFetch(`${this.BASE_URL}/accounts/${accountUid}/transactions?status=both`, {
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
        console.log(`Found ${transactions.length} raw transactions for account ${accountUid}`);

        return transactions; // Return RAW data, not mapped
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
            // Throw on session expired so callers can decide to skip balance update
            if (response.status === 401) {
                console.warn(`Session expired for account ${accountUid}`);
                throw new Error(`SESSION_EXPIRED: Balance unavailable for ${accountUid}`);
            }
            throw new Error(`Failed to fetch balance: ${error}`);
        }

        const data = await response.json();
        console.log('Balance API response:', JSON.stringify(data, null, 2));

        // Enable Banking API uses balanceType (camelCase) and amount.amount structure
        // ✅ REVOLUT/BBVA FIX: Prioritize 'interimAvailable' or 'closingAvailable' if 'closingBooked' is missing
        // Some Italian banks (like BBVA) might use different types or nested structures.
        const balances = data.balances || [];

        console.log('Available balance types:', balances.map((b: any) => b.balanceType || b.balance_type).join(', '));

        const balance = balances.find((b: any) => b.balanceType === 'closingBooked' || b.balance_type === 'closingBooked')
            || balances.find((b: any) => b.balanceType === 'interimAvailable' || b.balance_type === 'interimAvailable')
            || balances.find((b: any) => b.balanceType === 'interimBooked' || b.balance_type === 'interimBooked')
            || balances.find((b: any) => b.balanceType === 'closingAvailable' || b.balance_type === 'closingAvailable')
            || balances.find((b: any) => b.balanceType === 'openingBooked' || b.balance_type === 'openingBooked')
            || balances.find((b: any) => b.balanceType === 'expected' || b.balance_type === 'expected')
            || balances.find((b: any) => b.balanceType === 'information' || b.balance_type === 'information')
            || balances.find((b: any) => b.balanceType === 'AVAILABLE' || b.balanceType === 'BOOKED')
            || balances[0];

        if (!balance) {
            console.warn('No balance found in response');
            return 0;
        }

        // Log each balance entry for detailed debugging
        for (const b of balances) {
            console.log(`Balance entry: type=${b.balanceType || b.balance_type}, data=${JSON.stringify(b)}`);
        }

        // Handle multiple possible formats
        // Enable Banking typically returns: { balanceType: "...", balanceAmount: { amount: "123.45", currency: "EUR" } }
        // Some banks use: { balance_type: "...", amount: { amount: "123.45" } }  
        // Others use: { balanceType: "...", amount: { value: "123.45" } }
        const extractValue = (obj: any, depth = 0): number | null => {
            if (depth > 5) return null; // Safety limit
            if (obj === null || obj === undefined) return null;
            if (typeof obj === 'number') return obj;
            if (typeof obj === 'string') {
                const parsed = parseFloat(obj);
                return isNaN(parsed) ? null : parsed;
            }
            if (typeof obj === 'object') {
                // 1. Enable Banking standard: balanceAmount.amount
                if (obj.balanceAmount !== undefined && obj.balanceAmount !== null) {
                    return extractValue(obj.balanceAmount, depth + 1);
                }
                // 2. Alternative: balance_amount (snake_case)
                if (obj.balance_amount !== undefined && obj.balance_amount !== null) {
                    return extractValue(obj.balance_amount, depth + 1);
                }
                // 3. Direct amount field (could be number, string, or nested object)
                if (obj.amount !== undefined && obj.amount !== null) {
                    return extractValue(obj.amount, depth + 1);
                }
                // 4. Value field
                if (obj.value !== undefined && obj.value !== null) {
                    return extractValue(obj.value, depth + 1);
                }
                // 5. Other naming conventions
                const fallback = obj.amountValue ?? obj.valueAmount ?? obj.saldo ?? obj.disponibile;
                if (fallback !== undefined && fallback !== null) {
                    return extractValue(fallback, depth + 1);
                }
            }
            return null;
        };

        const balanceValue = extractValue(balance) ?? 0;

        console.log(`Parsed balance value (${balance.balanceType || balance.balance_type}):`, balanceValue);
        return balanceValue;
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

            // 1. Hardcoded Brand Mapping (High Confidence)
            const combinedInfo = [...bankNames, iban].join(' ');

            const internalMappings = [
                { id: 'paypal', keywords: ['paypal'] },
                { id: 'poste', keywords: ['poste', 'bancoposta', 'postepay'] },
                { id: 'revolut', keywords: ['revolut'] },
                { id: 'bbva', keywords: ['bbva', 'bilbao', 'vizcaya', 'argentaria'] },
                { id: 'intesa', keywords: ['intesa', 'sanpaolo', 'fideuram', 'ispy'] },
                { id: 'unicredit', keywords: ['unicredit', 'buddybank'] },
                { id: 'sella', keywords: ['sella', 'hype'] },
                { id: 'mps', keywords: ['monte', 'paschi', 'mps'] },
                { id: 'bper', keywords: ['bper', 'emilia', 'romagna'] },
                { id: 'credem', keywords: ['credem', 'emiliano'] },
                { id: 'mediolanum', keywords: ['mediolanum'] },
                { id: 'fineco', keywords: ['fineco'] },
                { id: 'bpm', keywords: ['bpm', 'popolare', 'milano'] },
                { id: 'illimity', keywords: ['illimity'] },
                { id: 'widiba', keywords: ['widiba'] },
                { id: 'chebanca', keywords: ['chebanca', 'mediobanca'] },
                { id: 'ing', keywords: ['ing', 'arancio'] },
                { id: 'n26', keywords: ['n26'] }
            ];

            for (const brand of internalMappings) {
                if (brand.keywords.some(k => combinedInfo.includes(k))) {
                    const found = accounts.find((a: any) =>
                        a.id.toLowerCase() === brand.id ||
                        brand.keywords.some(k => a.name.toLowerCase().includes(k)) ||
                        a.id.toLowerCase().includes(brand.id)
                    );
                    if (found) {
                        console.log(`✅ Brand match found: ${brand.id} -> ${found.id} (${found.name})`);
                        return found.id;
                    }
                }
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

                // Ignore very generic or extremely short local names for fuzzy matching to avoid noise
                const genericWords = ['conto', 'bank', 'banca', 'corrente', 'risparmio', 'libretto', 'arancio', 'card', 'carta', 'debito', 'credito', 'prepagata'];
                if (localName.length < 4 || genericWords.includes(localName)) continue;

                for (const bn of bankNames) {
                    if (bn.length < 3) continue; // Skip too short bank-provided names
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
     * Includes lock to prevent concurrent syncs
     */
    static async syncAll(): Promise<{ transactions: number, adjustments: number }> {
        // Prevent concurrent syncs
        if (this.isSyncing) {
            console.log('⏳ Sync already in progress, skipping duplicate call');
            return { transactions: 0, adjustments: 0 };
        }

        this.isSyncing = true;

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

                // 1. Sync Transactions - fetch RAW data and map with correct local account ID
                const rawTxs = await this.fetchRawTransactions(acc.uid);
                console.log(`Account ${acc.uid}: ${rawTxs.length} raw transactions fetched`);
                for (const rawTx of rawTxs) {
                    // Map RAW API data with resolved local account ID (single mapping, correct account)
                    const mappedTx = this.mapToAutoTransaction(rawTx, localAccountId);
                    const added = await AutoTransactionService.addAutoTransaction(mappedTx);
                    if (added) totalAdded++;
                }

                // 2. Sync Balance & Reconcile
                let bankBalance: number | null = null;
                try {
                    bankBalance = await this.fetchBalance(acc.uid);
                    console.log(`Account ${localAccountId}: Bank balance = ${bankBalance}`);

                    // ✅ UPDATE LOCAL ACCOUNT WITH CACHED BALANCE
                    const localAccounts = JSON.parse(localStorage.getItem('accounts_v1') || '[]');
                    const accountIndex = localAccounts.findIndex((a: any) => a.id === localAccountId);
                    if (accountIndex !== -1) {
                        localAccounts[accountIndex].cachedBalance = bankBalance;
                        localAccounts[accountIndex].lastSyncDate = new Date().toISOString();
                        localStorage.setItem('accounts_v1', JSON.stringify(localAccounts));
                        console.log(`✅ Updated cached balance for ${localAccountId}: ${bankBalance}`);
                    }
                } catch (balanceError: any) {
                    console.warn(`⚠️ Could not fetch balance for ${localAccountId}, keeping existing cachedBalance:`, balanceError.message);
                }

                // Only reconcile if we successfully got a balance
                if (bankBalance !== null) {
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
            }

            // ✅ Notify app that accounts have changed (so UI updates balance immediately)
            window.dispatchEvent(new CustomEvent('accounts-updated'));

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
        } finally {
            // Always release the lock
            this.isSyncing = false;
        }
    }

    /**
     * Map Enable Banking transaction to our AutoTransaction format
     * ✅ Now handles both booked and pending transactions
     */
    private static mapToAutoTransaction(tx: any, accountUid: string): Omit<AutoTransaction, 'id' | 'createdAt' | 'sourceHash' | 'status'> {
        // ✅ Log transaction status for debugging
        const txStatus = tx.status || tx.entryStatus || tx.entry_status || 'unknown';
        console.log(`📊 Transaction status: ${txStatus}`);
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

        // ✅ CRITICAL: Extract unique transaction ID from API for stable hash generation
        // Enable Banking API can provide these fields as unique identifiers:
        // - entry_reference / entryReference (most reliable)
        // - transaction_id / transactionId
        // - internal_transaction_id / internalTransactionId
        // - end_to_end_id / endToEndId
        const bankTransactionId = tx.entry_reference
            || tx.entryReference
            || tx.transaction_id
            || tx.transactionId
            || tx.internal_transaction_id
            || tx.internalTransactionId
            || tx.end_to_end_id
            || tx.endToEndId
            || undefined; // Se nessuno disponibile, il sistema userà fallback

        if (bankTransactionId) {
            console.log(`✅ Bank transaction ID found: ${bankTransactionId}`);
        } else {
            console.log(`⚠️ No bank transaction ID found, will use fallback hash method`);
        }

        return {
            type,
            amount: Math.abs(amount),
            description,
            date,
            account: accountUid, // Using the resolved localAccountId passed here
            sourceType: 'bank',
            sourceApp: 'enable_banking',
            rawText: JSON.stringify(tx),
            bankTransactionId, // ✅ NEW: Pass unique ID for stable hashing
        };
    }
}
