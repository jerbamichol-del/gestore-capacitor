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
    private static readonly STORAGE_KEY_LAST_SYNC = 'bank_sync_last_sync_timestamp';
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

    private static sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Helper to perform fetch with better error reporting for CORS/Network issues.
     * ✅ NEW: Implements automatic retry with exponential backoff for 429 (Too Many Requests).
     */
    private static async safeFetch(url: string, options: RequestInit, retries = 3, backoff = 1500): Promise<Response> {
        try {
            console.log(`🌐 Fetching: ${url}`);
            const response = await fetch(url, options);
            console.log(`📡 Response status: ${response.status}`);

            // Handle rate limiting (429) with retry logic
            if (response.status === 429 && retries > 0) {
                console.warn(`⏳ Rate limit (429) detected. Retrying in ${backoff}ms... (${retries} retries remaining)`);
                await this.sleep(backoff);
                return this.safeFetch(url, options, retries - 1, backoff * 2);
            }

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

        // ✅ 1. Fetch all global accounts first (Standard Enable Banking way to get full objects)
        let globalAccountsMap = new Map<string, any>();
        try {
            console.log('🌐 Fetching global accounts...');
            const response = await this.safeFetch(`${this.BASE_URL}/accounts`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (Array.isArray(data.accounts)) {
                    data.accounts.forEach((acc: any) => {
                        if (acc.uid) globalAccountsMap.set(String(acc.uid).toLowerCase(), acc);
                    });
                    console.log(`✅ Loaded ${globalAccountsMap.size} accounts from global /accounts endpoint`);
                }
            } else {
                console.warn(`⚠️ Global /accounts fetch failed (or 404): ${response.status}`);
            }
        } catch (e) {
            console.error('Failed to fetch global accounts:', e);
        }

        // ✅ 2. Fetch accounts session by session
        for (const sessionId of sessions) {
            try {
                const response = await this.safeFetch(`${this.BASE_URL}/sessions/${sessionId}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (response.ok) {
                    const data = await response.json();

                    // Resolve session accounts. 
                    let sessionAccounts: any[] = [];
                    if (Array.isArray(data.accounts_data) && data.accounts_data.length > 0) {
                        sessionAccounts = data.accounts_data;
                    } else if (Array.isArray(data.accounts)) {
                        for (const accIdOrObj of data.accounts) {
                            if (typeof accIdOrObj === 'string') {
                                const uid = accIdOrObj.toLowerCase();
                                const fullAcc = globalAccountsMap.get(uid);
                                if (fullAcc) {
                                    sessionAccounts.push(fullAcc);
                                } else {
                                    // Fallback: Try individual fetch
                                    try {
                                        console.log(`🔍 UID fallback: individual fetch for ${accIdOrObj}`);
                                        const accRes = await this.safeFetch(`${this.BASE_URL}/accounts/${accIdOrObj}`, {
                                            headers: { 'Authorization': `Bearer ${token}` }
                                        });
                                        if (accRes.ok) {
                                            sessionAccounts.push(await accRes.json());
                                        } else {
                                            sessionAccounts.push({ uid: accIdOrObj, name: 'Account details unavailable' });
                                        }
                                    } catch (err) {
                                        sessionAccounts.push({ uid: accIdOrObj, name: 'Account details unavailable' });
                                    }
                                }
                            } else if (typeof accIdOrObj === 'object' && accIdOrObj !== null) {
                                const uid = String(accIdOrObj.uid || '').toLowerCase();
                                const fullAcc = uid ? globalAccountsMap.get(uid) : null;
                                sessionAccounts.push(fullAcc ? { ...fullAcc, ...accIdOrObj } : accIdOrObj);
                            }
                        }
                    }

                    console.log(`Session ${sessionId} resolved ${sessionAccounts.length} accounts`);

                    if (sessionAccounts.length === 0) {
                        emptySessions.push(sessionId);
                    } else {
                        validSessionCount++;
                        for (const acc of sessionAccounts) {
                            const uid = String(acc.uid).toLowerCase();
                            if (!allAccounts.has(uid)) {
                                allAccounts.set(uid, { ...acc, _sessionId: sessionId });
                            }
                        }
                    }
                } else if (response.status === 401) {
                    expiredSessions.push(sessionId);
                }
            } catch (e) {
                console.error(`Failed to fetch session ${sessionId}:`, e);
            }
        }

        // Cleanup
        for (const expiredId of expiredSessions) await this.removeSession(expiredId);
        if (emptySessions.length > 0) {
            const newestSession = sessions[sessions.length - 1];
            for (const staleId of emptySessions.filter(s => s !== newestSession)) {
                await this.removeSession(staleId);
            }
        }

        if (expiredSessions.length > 0 && validSessionCount === 0 && emptySessions.length === 0) {
            throw new Error('SESSION_EXPIRED: Tutte le sessioni bancarie sono scadute.');
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
        let response = await this.safeFetch(`${this.BASE_URL}/accounts/${accountUid}/transactions?status=both`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            // Check if session expired
            if (response.status === 401) {
                console.warn(`Session expired for account ${accountUid}`);
                return []; // Return empty instead of throwing
            }

            // Fallback for banks that don't support status=both (like BBVA)
            console.warn(`?status=both failed with status ${response.status}, retrying without status...`);
            response = await this.safeFetch(`${this.BASE_URL}/accounts/${accountUid}/transactions`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Failed to fetch transactions after fallback: ${error}`);
            }
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

        const balance = balances.find((b: any) => b.balanceType === 'interimAvailable' || b.balance_type === 'interimAvailable')
            || balances.find((b: any) => b.balanceType === 'closingAvailable' || b.balance_type === 'closingAvailable')
            || balances.find((b: any) => b.balanceType === 'interimBooked' || b.balance_type === 'interimBooked')
            || balances.find((b: any) => b.balanceType === 'closingBooked' || b.balance_type === 'closingBooked')
            || balances.find((b: any) => b.balanceType === 'expected' || b.balance_type === 'expected')
            || balances.find((b: any) => b.balanceType === 'openingBooked' || b.balance_type === 'openingBooked')
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
                let normalized = obj;
                if (normalized.includes(',') && normalized.includes('.')) {
                    normalized = normalized.replace(/\./g, '').replace(',', '.');
                } else if (normalized.includes(',')) {
                    normalized = normalized.replace(',', '.');
                }
                const parsed = parseFloat(normalized);
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

        console.log(`🏦 [BALANCE_DEBUG] Parsed ${balanceValue} from ${JSON.stringify(balance)}`);
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

    private static resolveLocalAccountId(acc: any): string {
        try {
            const mappings = JSON.parse(localStorage.getItem(this.STORAGE_KEY_MAPPINGS) || '{}');
            const uid = String(acc.uid || '').toLowerCase();

            // 1. Explicit Mapping
            if (mappings[uid]) {
                console.log(`🏦 [RESOLVE] Explicit mapping found for ${uid} -> ${mappings[uid]}`);
                return mappings[uid];
            }

            const bankName = (acc.name || '').toLowerCase();
            const aspspName = (acc.aspsp_name || acc.aspspName || '').toLowerCase();
            const localAccounts = JSON.parse(localStorage.getItem('accounts_v1') || '[]');

            console.log(`🏦 [RESOLVE] Searching match for bankAcc: "${bankName}" (ASPSP: "${aspspName}")`);

            // 2. Specific Brand Keywords
            const brands = [
                { id: 'revolut', keywords: ['revolut'] },
                { id: 'paypal', keywords: ['paypal', 'pay pal'] },
                { id: 'bbva', keywords: ['bbva', 'bilbao', 'vizcaya', 'argentaria'] },
                { id: 'poste', keywords: ['poste', 'bancoposta', 'postepay'] },
                { id: 'crypto', keywords: ['binance', 'coinbase', 'crypto.com', 'metamask'] }
            ];

            for (const brand of brands) {
                if (brand.keywords.some(k => bankName.includes(k) || aspspName.includes(k))) {
                    const match = localAccounts.find((la: any) => la.id === brand.id);
                    if (match) {
                        console.log(`🏦 [RESOLVE] Brand match found: ${brand.id}`);
                        return match.id;
                    }
                }
            }

            // 3. Fuzzy Match (Last resort)
            for (const la of localAccounts) {
                const localName = la.name.toLowerCase().trim();
                if (localName.length < 3) continue;
                if (bankName.includes(localName) || localName.includes(bankName)) {
                    console.log(`🏦 [RESOLVE] Fuzzy match found: ${la.id}`);
                    return la.id;
                }
            }

        } catch (e) {
            console.error('Error in resolveLocalAccountId:', e);
        }

        console.warn(`Could not resolve local account for ${acc.uid}, using UID as is.`);
        return acc.uid;
    }

    /**
     * Sync all accounts (Transactions + Balances)
     */
    static async syncAll(force = false): Promise<{ transactions: number, adjustments: number }> {
        const lastSync = localStorage.getItem(this.STORAGE_KEY_LAST_SYNC);
        const cooldown = 60 * 60 * 1000; // 1 hour

        if (!force && lastSync) {
            const timeSinceLastSync = Date.now() - parseInt(lastSync);
            if (timeSinceLastSync < cooldown) {
                const minsLeft = Math.ceil((cooldown - timeSinceLastSync) / 60000);
                console.log(`🛡️ Sync throttled. Prossimo aggiornamento tra ${minsLeft} minuti.`);
                return { transactions: 0, adjustments: 0 };
            }
        }

        if (this.isSyncing) {
            console.log('⏳ Sync already in progress, skipping duplicate call');
            return { transactions: 0, adjustments: 0 };
        }

        this.isSyncing = true;
        try {
            const accounts = await this.fetchAccounts();
            let totalAdded = 0;
            let adjustmentsCount = 0;
            const syncedLocalIds = new Set<string>();

            for (const acc of accounts) {
                const localAccountId = this.resolveLocalAccountId(acc);
                syncedLocalIds.add(localAccountId);

                await this.sleep(1000);

                // 1. Transactions
                const rawTxs = await this.fetchRawTransactions(acc.uid);
                for (const rawTx of rawTxs) {
                    const mappedTx = this.mapToAutoTransaction(rawTx, localAccountId);
                    const added = await AutoTransactionService.addAutoTransaction(mappedTx);
                    if (added) totalAdded++;
                }

                // 2. Balance & Reconcile
                let bankBalance: number | null = null;
                try {
                    bankBalance = await this.fetchBalance(acc.uid);

                    const localAccounts = JSON.parse(localStorage.getItem('accounts_v1') || '[]');
                    const accountIndex = localAccounts.findIndex((a: any) => a.id === localAccountId);
                    if (accountIndex !== -1) {
                        localAccounts[accountIndex].cachedBalance = bankBalance;
                        localAccounts[accountIndex].lastSyncDate = new Date().toISOString();
                        localStorage.setItem('accounts_v1', JSON.stringify(localAccounts));
                    }
                } catch (balanceError: any) {
                    console.warn(`⚠️ Could not fetch balance for ${localAccountId}:`, balanceError.message);
                }

                if (bankBalance !== null) {
                    const localBalance = this.calculateLocalBalance(localAccountId);
                    const diff = bankBalance - localBalance;

                    if (Math.abs(diff) > 0.01) {
                        await AutoTransactionService.addAdjustment(
                            localAccountId,
                            diff,
                            `Riconciliazione Automatica ${acc.name || localAccountId}`
                        );
                        adjustmentsCount++;
                    }
                }
            }

            localStorage.setItem(this.STORAGE_KEY_LAST_SYNC, Date.now().toString());
            localStorage.setItem('bank_sync_synced_local_ids', JSON.stringify(Array.from(syncedLocalIds)));

            // Notify UI
            window.dispatchEvent(new Event('bank-sync-complete'));
            window.dispatchEvent(new Event('accounts-updated'));
            window.dispatchEvent(new Event('expenses-updated'));
            window.dispatchEvent(new Event('auto-transactions-updated'));

            return { transactions: totalAdded, adjustments: adjustmentsCount };
        } catch (error) {
            console.error('Bank sync failed:', error);
            throw error;
        } finally {
            this.isSyncing = false;
        }
    }

    private static mapToAutoTransaction(tx: any, accountUid: string): Omit<AutoTransaction, 'id' | 'createdAt' | 'sourceHash' | 'status'> {
        let rawAmount: any = 0;
        if (tx.transactionAmount && typeof tx.transactionAmount === 'object') {
            rawAmount = tx.transactionAmount.amount ?? tx.transactionAmount.value ?? 0;
        } else if (tx.amount && typeof tx.amount === 'object') {
            rawAmount = tx.amount.amount ?? tx.amount.value ?? 0;
        } else {
            rawAmount = tx.amount ?? 0;
        }

        const amount = parseFloat(String(rawAmount)) || 0;
        let type: 'expense' | 'income' = amount < 0 ? 'expense' : 'income';

        const date = tx.bookingDate || tx.valueDate || new Date().toISOString().split('T')[0];
        const description = tx.description || tx.remittanceInformationUnstructured || 'Transazione Bancaria';
        const bankTransactionId = tx.entryReference || tx.transactionId || tx.endToEndId || undefined;

        return {
            type,
            amount: Math.abs(amount),
            description,
            date,
            account: accountUid,
            sourceType: 'bank',
            sourceApp: 'enable_banking',
            rawText: JSON.stringify(tx),
            bankTransactionId,
        };
    }
}
