import * as jose from 'jose';
import { AutoTransaction } from '../types/transaction';
import { AutoTransactionService } from './auto-transaction-service';
import { AutoConfirmService } from './auto-confirm-service';

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
     * Whether a bank sync is currently running. Other writers (cloud sync)
     * use this to avoid overwriting in-flight adjustments.
     */
    static isSyncActive(): boolean {
        return this.isSyncing;
    }

    // ---------------------------------------------------------------------
    // Link diagnostics: the bank authorization happens inside an in-app
    // browser where console logs are not reachable, so every step is
    // persisted and shown in the UI ("Log collegamento").
    // ---------------------------------------------------------------------
    private static readonly LINK_LOG_KEY = 'bank_sync_link_log';
    private static readonly LINK_LOG_MAX = 60;

    static logLink(step: string, detail?: any): void {
        try {
            const log = this.getLinkLog();
            let text = '';
            if (detail !== undefined && detail !== null) {
                text = typeof detail === 'string' ? detail : JSON.stringify(detail);
                if (text.length > 600) text = text.slice(0, 600) + '…';
            }
            log.push({ t: new Date().toISOString(), step, detail: text });
            localStorage.setItem(this.LINK_LOG_KEY, JSON.stringify(log.slice(-this.LINK_LOG_MAX)));
        } catch { /* ignore */ }
        console.log(`🔗 [LINK] ${step}${detail !== undefined ? ' — ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''}`);
    }

    static getLinkLog(): { t: string, step: string, detail?: string }[] {
        try {
            const raw = localStorage.getItem(this.LINK_LOG_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    static clearLinkLog(): void {
        localStorage.removeItem(this.LINK_LOG_KEY);
    }

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
                // NOTE: the OCTET STRING length placeholder sits at offsets 24-25.
                // Offsets 20-21 are the AlgorithmIdentifier NULL parameters (05 00)
                // and must NOT be overwritten.
                preamble[2] = (totalLen >> 8) & 0xff;
                preamble[3] = totalLen & 0xff;
                preamble[24] = (innerLen >> 8) & 0xff;
                preamble[25] = innerLen & 0xff;

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
     * Start authorization process for a bank.
     *
     * Two per-bank constraints from the Enable Banking API must be honoured or the
     * authorization silently yields no accounts (or is rejected outright):
     *  - `access.valid_until` cannot exceed now + the ASPSP's maximum_consent_validity
     *    (seconds). Banks like BBVA allow far less than 90 days.
     *  - `psu_type` default depends on the connector, so it must be sent explicitly;
     *    asking for "business" on a personal account returns an empty account list.
     */
    static async startAuthorization(
        aspsp: { name: string, country: string, psu_types?: string[], maximum_consent_validity?: number },
        redirectUrl: string
    ): Promise<string> {
        const creds = this.getCredentials();
        if (!creds) throw new Error('Credentials not set');

        const token = await this.generateJWT(creds);

        // Clamp consent validity to what the bank supports (default 90 days).
        const NINETY_DAYS_S = 90 * 24 * 60 * 60;
        const maxValidity = typeof aspsp.maximum_consent_validity === 'number' && aspsp.maximum_consent_validity > 0
            ? aspsp.maximum_consent_validity
            : NINETY_DAYS_S;
        // Small safety margin so the request is never rejected for being 1s too long.
        const validitySeconds = Math.max(60, Math.min(NINETY_DAYS_S, maxValidity - 60));
        const validUntil = new Date(Date.now() + validitySeconds * 1000).toISOString();

        // Pick a supported PSU type, preferring personal.
        const supported = Array.isArray(aspsp.psu_types) ? aspsp.psu_types : [];
        const psuType = supported.includes('personal') ? 'personal'
            : (supported.length > 0 ? supported[0] : 'personal');

        const state = (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).substring(2));

        console.log(`🔐 Start auth for ${aspsp.name} (${aspsp.country}): psu_type=${psuType}, valid_until=${validUntil} (max ${maxValidity}s)`);
        this.clearLinkLog();
        this.logLink('POST /auth', { bank: aspsp.name, country: aspsp.country, psu_type: psuType, valid_until: validUntil, redirect_url: redirectUrl });

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
                state,
                psu_type: psuType,
                language: 'it',
                access: {
                    valid_until: validUntil,
                    balances: true,
                    transactions: true
                }
            })
        });

        if (!response.ok) {
            const error = await response.text();
            this.logLink('POST /auth FALLITA', `HTTP ${response.status}: ${error}`);
            throw new Error(`Errore Start Auth (${response.status}): ${error}`);
        }

        const data = await response.json();
        this.logLink('POST /auth OK', { authUrl: String(data.url || '').slice(0, 120) });

        // Remember which bank this authorization belongs to: the redirect back does
        // not carry the bank name, and some banks omit `aspsp` in GET /sessions.
        try {
            localStorage.setItem('bank_sync_pending_aspsp', JSON.stringify({
                name: aspsp.name, country: aspsp.country, state, psu_type: psuType
            }));
        } catch { /* ignore */ }

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
        this.logLink('POST /sessions', { code: code.substring(0, 12) + '…', redirect_url: redirectUrl || '(assente)' });

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
            this.logLink('POST /sessions FALLITA', `HTTP ${response.status}: ${errorText}`);

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
        this.logLink('✅ Sessione autorizzata', { session_id: data.session_id, aspsp: data.aspsp?.name, psu_type: data.psu_type, conti: Array.isArray(data.accounts) ? data.accounts.length : 0 });

        // ⚠️ CRITICAL: POST /sessions is the ONLY response that returns the full
        // AccountResource objects ("some of that data is returned only once").
        // GET /sessions/{id} may return an empty account list for some banks
        // (BBVA), so caching them here is what makes those banks work at all.
        const sessionId: string = data.session_id;
        const aspspName: string = data.aspsp?.name || '';
        const pending = (() => {
            try { return JSON.parse(localStorage.getItem('bank_sync_pending_aspsp') || 'null'); } catch { return null; }
        })();
        const resolvedName = aspspName || pending?.name || '';

        try {
            const accounts = (Array.isArray(data.accounts) ? data.accounts : []).filter((a: any) => a && a.uid);
            if (accounts.length > 0) {
                const cache = this.getCachedSessionAccounts();
                cache[sessionId] = accounts;
                localStorage.setItem('bank_sync_session_accounts', JSON.stringify(cache));
                console.log(`💾 Cached ${accounts.length} account(s) from POST /sessions for ${resolvedName || sessionId}`);
                this.logLink('Conti ricevuti e salvati', accounts.map((a: any) => `${a.name || '?'} [${a.currency || '?'}] ${String(a.uid || '').slice(0, 8)}`));
            } else {
                console.warn('⚠️ POST /sessions returned no accounts');
                this.logLink('⚠️ POST /sessions non ha restituito conti', { psu_type: data.psu_type, aspsp: resolvedName, access: data.access });
            }

            if (resolvedName) {
                const names = this.getSessionAspspNames();
                names[sessionId] = resolvedName;
                localStorage.setItem('bank_sync_session_aspsp', JSON.stringify(names));
            }
            localStorage.removeItem('bank_sync_pending_aspsp');
        } catch (e) {
            console.error('Failed to cache session accounts:', e);
        }

        // Store session ID in list of sessions
        const sessions = await this.getSessions();
        if (!sessions.includes(sessionId)) {
            sessions.push(sessionId);
            localStorage.setItem('bank_sync_sessions', JSON.stringify(sessions));
        }
        this.saveActiveProviders();

        return sessionId;
    }

    /**
     * Accounts captured from POST /sessions, keyed by session id.
     * Used as the source of truth for banks whose GET /sessions/{id} omits them.
     */
    private static getCachedSessionAccounts(): Record<string, any[]> {
        try {
            return JSON.parse(localStorage.getItem('bank_sync_session_accounts') || '{}');
        } catch {
            return {};
        }
    }

    /**
     * Poll GET /sessions/{id} to see how many accounts the session actually exposes.
     *
     * A session can be AUTHORIZED and still expose zero accounts. With an Enable
     * Banking application activated in *restricted mode* ("Activate by linking
     * accounts", the state before a signed contract), only accounts explicitly
     * linked to the application are returned and every other account is stripped
     * from the response — so authorization succeeds for any bank while its data
     * stays unreachable. Detecting it here lets the UI say exactly that.
     *
     * Returns the number of accounts found (0 means nothing usable).
     */
    static async verifySessionAccounts(sessionId: string, attempts = 3, delayMs = 4000): Promise<number> {
        const creds = this.getCredentials();
        if (!creds) return 0;

        for (let i = 1; i <= attempts; i++) {
            try {
                const token = await this.generateJWT(creds);
                const response = await this.safeFetch(`${this.BASE_URL}/sessions/${sessionId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!response.ok) {
                    this.logLink(`GET /sessions tentativo ${i} FALLITO`, `HTTP ${response.status}`);
                } else {
                    const data = await response.json();
                    const uids = Array.isArray(data.accounts) ? data.accounts.length : 0;
                    const full = Array.isArray(data.accounts_data) ? data.accounts_data.length : 0;
                    const count = Math.max(uids, full);
                    this.logLink(`GET /sessions tentativo ${i}`, { status: data.status, conti: count });

                    if (count > 0) {
                        // Persist whatever we got so the sync can use it right away
                        const objects = (Array.isArray(data.accounts_data) && data.accounts_data.length > 0)
                            ? data.accounts_data
                            : (Array.isArray(data.accounts) ? data.accounts.map((uid: any) => ({ uid })) : []);
                        const cache = this.getCachedSessionAccounts();
                        cache[sessionId] = objects.filter((a: any) => a && a.uid);
                        localStorage.setItem('bank_sync_session_accounts', JSON.stringify(cache));
                        return count;
                    }
                }
            } catch (e: any) {
                this.logLink(`GET /sessions tentativo ${i} errore`, String(e?.message || e));
            }

            if (i < attempts) await this.sleep(delayMs);
        }

        // Nothing after every attempt: check whether the cache from POST /sessions has data
        const cached = this.getCachedSessionAccounts()[sessionId];
        if (Array.isArray(cached) && cached.length > 0) {
            this.logLink('Nessun conto da GET /sessions, uso quelli salvati alla autorizzazione', cached.length);
            return cached.length;
        }

        this.logLink('❌ Sessione autorizzata ma NESSUN conto accessibile',
            'Causa tipica: applicazione Enable Banking in modalità RESTRICTED — vengono restituiti solo i conti collegati (linked) all\'applicazione, gli altri sono rimossi dalla risposta.');
        return 0;
    }

    private static async getSessions(): Promise<string[]> {
        const stored = localStorage.getItem('bank_sync_sessions');
        return stored ? JSON.parse(stored) : [];
    }

    /**
     * Persisted map sessionId -> ASPSP (bank) name, captured from GET /sessions/{id}.
     * Used to rebuild the active providers list without extra API calls.
     */
    private static getSessionAspspNames(): Record<string, string> {
        try {
            return JSON.parse(localStorage.getItem('bank_sync_session_aspsp') || '{}');
        } catch {
            return {};
        }
    }

    /**
     * Rebuild and persist the list of banks currently handled via API.
     * The notification/SMS parsers suppress events for these banks to avoid duplicates.
     */
    private static saveActiveProviders(): void {
        const sessions = JSON.parse(localStorage.getItem('bank_sync_sessions') || '[]') as string[];
        const names = this.getSessionAspspNames();
        const active = [...new Set(
            sessions.map(id => (names[id] || '').toLowerCase().trim()).filter(n => n.length > 0)
        )];
        localStorage.setItem(this.STORAGE_KEY_ACTIVE_BANKS, JSON.stringify(active));
        console.log(`🏦 Active API providers: ${active.join(', ') || '(none)'}`);
    }

    private static async removeSession(sessionId: string): Promise<void> {
        const sessions = await this.getSessions();
        const filtered = sessions.filter(s => s !== sessionId);
        localStorage.setItem('bank_sync_sessions', JSON.stringify(filtered));
        const names = this.getSessionAspspNames();
        if (names[sessionId]) {
            delete names[sessionId];
            localStorage.setItem('bank_sync_session_aspsp', JSON.stringify(names));
        }
        const cache = this.getCachedSessionAccounts();
        if (cache[sessionId]) {
            delete cache[sessionId];
            localStorage.setItem('bank_sync_session_accounts', JSON.stringify(cache));
        }
        this.saveActiveProviders();
        console.log(`Removed expired session: ${sessionId}`);
    }

    static async clearAllSessions(): Promise<void> {
        localStorage.removeItem('bank_sync_sessions');
        localStorage.removeItem('bank_sync_session_aspsp');
        localStorage.removeItem('bank_sync_session_accounts');
        localStorage.removeItem('bank_sync_pending_aspsp');
        localStorage.removeItem('bank_sync_last_report');
        localStorage.removeItem(this.STORAGE_KEY_ACTIVE_BANKS);
        localStorage.removeItem(this.STORAGE_KEY_MAPPINGS);
        localStorage.removeItem('bank_sync_synced_local_ids');
        localStorage.removeItem(this.STORAGE_KEY_LAST_SYNC);

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
        const names = this.getSessionAspspNames();
        if (names[sessionId]) {
            delete names[sessionId];
            localStorage.setItem('bank_sync_session_aspsp', JSON.stringify(names));
        }
        this.saveActiveProviders();
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

        if (sessions.length === 0) {
            throw new Error('NO_SESSIONS: Nessuna banca collegata. Usa "Collega Nuova Banca" per autorizzarne una.');
        }

        let allAccounts = new Map<string, any>();
        let expiredSessions: string[] = [];
        const cachedSessionAccounts = this.getCachedSessionAccounts();
        let cacheDirty = false;

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

                    // Capture the ASPSP (bank) name of this session so we can
                    // rebuild the active-providers list for notification suppression.
                    const sessionAspspName: string = data.aspsp?.name || data.aspsp_name || '';
                    if (sessionAspspName) {
                        const names = this.getSessionAspspNames();
                        names[sessionId] = sessionAspspName;
                        localStorage.setItem('bank_sync_session_aspsp', JSON.stringify(names));
                    }

                    // Resolve session accounts.
                    let sessionAccounts: any[] = [];
                    if (Array.isArray(data.accounts_data) && data.accounts_data.length > 0) {
                        // accounts_data items can be sparse (uid only): enrich them
                        // with the full objects from the global /accounts endpoint.
                        for (const acc of data.accounts_data) {
                            const uid = String(acc?.uid || '').toLowerCase();
                            const full = uid ? globalAccountsMap.get(uid) : null;
                            sessionAccounts.push(full ? { ...full, ...acc } : acc);
                        }
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

                    console.log(`Session ${sessionId} (${sessionAspspName || '?'}) resolved ${sessionAccounts.length} accounts`);

                    // Fall back to the accounts captured at authorization time.
                    // Required for banks (BBVA) whose GET /sessions/{id} omits them.
                    if (sessionAccounts.length === 0) {
                        const cached = cachedSessionAccounts[sessionId];
                        if (Array.isArray(cached) && cached.length > 0) {
                            sessionAccounts = cached;
                            console.log(`💾 Using ${cached.length} cached account(s) from authorization for session ${sessionId}`);
                        }
                    } else {
                        // Refresh the cache with the freshest data
                        cachedSessionAccounts[sessionId] = sessionAccounts;
                        cacheDirty = true;
                    }

                    if (sessionAccounts.length === 0) {
                        // Do NOT delete the session: some banks (e.g. BBVA) legitimately
                        // return an empty account list for a while after authorization.
                        // Deleting a valid consent here was destroying working banks.
                        console.warn(`⚠️ Session ${sessionId} returned 0 accounts (session kept, will retry next sync)`);
                    } else {
                        for (const acc of sessionAccounts) {
                            const uid = String(acc.uid).toLowerCase();
                            if (!allAccounts.has(uid)) {
                                // Expose the session's bank name on the account so the UI
                                // (linked-bank badges, local account resolution) can use it.
                                allAccounts.set(uid, { aspsp_name: sessionAspspName, ...acc, _sessionId: sessionId });
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

        // Cleanup ONLY sessions that are truly expired (401): empty ones are kept.
        for (const expiredId of expiredSessions) await this.removeSession(expiredId);

        if (cacheDirty) {
            try {
                localStorage.setItem('bank_sync_session_accounts', JSON.stringify(cachedSessionAccounts));
            } catch { /* ignore */ }
        }

        // Persist which banks are now handled via API (drives notification/SMS suppression)
        this.saveActiveProviders();

        if (allAccounts.size === 0) {
            if (expiredSessions.length > 0) {
                throw new Error('SESSION_EXPIRED: Tutte le sessioni bancarie sono scadute. Ricollega le banche con "Collega Nuova Banca".');
            }
            throw new Error('NO_ACCOUNTS: Le banche collegate non espongono alcun conto. Se l\'app Enable Banking è attivata "by linking accounts" (modalità restricted), devi collegare quel conto specifico all\'applicazione dal pannello Enable Banking: i conti non collegati vengono rimossi dalla risposta.');
        }

        return Array.from(allAccounts.values());
    }

    /**
     * Fetch RAW transactions for a specific account (not mapped)
     * Returns the raw API response for mapping in syncAll with correct local account ID.
     * Handles continuation_key pagination.
     * Pending transactions without entry_reference are skipped: their transaction_id
     * is unstable and the booked version (with a stable id) arrives later — importing
     * both would create duplicates (per Enable Banking FAQ guidance).
     */
    static async fetchRawTransactions(accountUid: string): Promise<any[]> {
        const creds = this.getCredentials();
        if (!creds) throw new Error('Credentials not set');

        const token = await this.generateJWT(creds);

        const MAX_PAGES = 12;
        const transactions: any[] = [];
        let continuationKey: string | null = null;
        let pages = 0;

        do {
            let url = `${this.BASE_URL}/accounts/${accountUid}/transactions`;
            if (continuationKey) {
                url += `?continuation_key=${encodeURIComponent(continuationKey)}`;
            }

            const response = await this.safeFetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                // Session expired: return what we have (possibly nothing) instead of throwing
                if (response.status === 401) {
                    console.warn(`Session expired for account ${accountUid}`);
                    return transactions;
                }
                const error = await response.text();
                throw new Error(`Failed to fetch transactions: ${error}`);
            }

            const data = await response.json();
            const page: any[] = Array.isArray(data.transactions) ? data.transactions : [];
            transactions.push(...page);
            continuationKey = data.continuation_key || null;
            pages++;
        } while (continuationKey && pages < MAX_PAGES);

        if (continuationKey) {
            console.warn(`⚠️ Transaction list truncated after ${MAX_PAGES} pages for account ${accountUid}`);
        }

        // Drop pending transactions without entry_reference (unstable ids -> duplicates)
        const isPending = (tx: any) => /PDNG|PEND/i.test(String(tx.status || tx.transaction_status || ''));
        const hasEntryRef = (tx: any) => !!(tx.entry_reference || tx.entryReference);
        const importable = transactions.filter(tx => {
            if (isPending(tx) && !hasEntryRef(tx)) {
                console.log(`⏭️ Skipping pending transaction without entry_reference: ${tx.transaction_id || tx.transactionId || '?'}`);
                return false;
            }
            return true;
        });

        console.log(`Found ${transactions.length} raw transactions (${importable.length} importable) for account ${accountUid}`);
        return importable; // Return RAW data, not mapped
    }

    /**
     * Fetch balance for a specific account.
     * Returns { value, currency } or null when the balance cannot be determined.
     * Enable Banking uses ISO 20022 balance_type codes (ITBD, CLBD, ITAV, CLAV...):
     * booked balances are preferred because they represent the real account balance;
     * available balances (cards/credit lines) can legitimately be 0 and previously
     * caused wrong "0€" displays.
     */
    static async fetchBalance(accountUid: string): Promise<{ value: number; currency: string } | null> {
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
        const balances = data.balances || [];

        const typeOf = (b: any) => String(b.balance_type || b.balanceType || '').trim();
        const norm = (t: string) => t.toLowerCase().replace(/[_\s]/g, '');
        console.log('Available balance types:', balances.map((b: any) => typeOf(b)).join(', '));

        // Priority groups: ISO 20022 codes first, camelCase variants kept for resilience.
        const PRIORITY: string[][] = [
            ['itbd', 'interimbooked'],              // booked balance of today — the real balance
            ['clbd', 'closingbooked', 'booked'],    // accounting balance
            ['itav', 'interimavailable'],           // available (fallback)
            ['clav', 'closingavailable', 'available'],
            ['fwav', 'forwardavailable'],
            ['valu'],
            ['xpcd', 'expected'],
            ['opbd', 'openingbooked'],
            ['opav', 'openingavailable'],
            ['prcd'],
            ['info', 'information'],
            ['othr', 'other'],
        ];

        let balance: any;
        for (const group of PRIORITY) {
            balance = balances.find((b: any) => group.includes(norm(typeOf(b))));
            if (balance) break;
        }
        if (!balance) balance = balances[0];

        if (!balance) {
            console.warn('No balance found in response');
            return null;
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

        const balanceValue = extractValue(balance);
        if (balanceValue === null) {
            console.warn(`🏦 Balance payload not recognized for ${accountUid}, skipping reconciliation`);
            return null;
        }

        const currency = String(
            balance.balance_amount?.currency
            ?? balance.balanceAmount?.currency
            ?? balance.currency
            ?? 'EUR'
        ).toUpperCase();

        console.log(`🏦 [BALANCE_DEBUG] Parsed ${balanceValue} ${currency} from type=${typeOf(balance)}`);
        return { value: balanceValue, currency };
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

    /** Normalize a name for matching: lowercase, no accents, no punctuation. */
    private static normalizeName(s: string): string {
        return String(s || '')
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();
    }

    /**
     * Resolve which local account a bank account belongs to.
     * Works for any bank: the ASPSP name is matched as well as the account name,
     * so banks without a hardcoded brand entry (UniCredit, Intesa, BNL...) resolve too.
     */
    private static resolveLocalAccountId(acc: any): string {
        try {
            const mappings = JSON.parse(localStorage.getItem(this.STORAGE_KEY_MAPPINGS) || '{}');
            const uid = String(acc.uid || '');
            const uidLower = uid.toLowerCase();

            // 1. Explicit Mapping (accept both original and lowercase key)
            if (mappings[uid] || mappings[uidLower]) {
                const mapped = mappings[uid] || mappings[uidLower];
                console.log(`🏦 [RESOLVE] Explicit mapping found for ${uidLower} -> ${mapped}`);
                return mapped;
            }

            const accName = this.normalizeName(acc.name);
            const aspspName = this.normalizeName(acc.aspsp_name || acc.aspspName);
            const product = this.normalizeName(acc.product);
            const haystack = `${aspspName} ${accName} ${product}`.trim();
            const localAccounts = JSON.parse(localStorage.getItem('accounts_v1') || '[]');

            console.log(`🏦 [RESOLVE] Matching bank account "${accName}" / ASPSP "${aspspName}"`);

            // 2. Brand aliases: map bank naming to well-known local account ids.
            const brands = [
                { id: 'revolut', keywords: ['revolut'] },
                { id: 'paypal', keywords: ['paypal', 'pay pal'] },
                { id: 'bbva', keywords: ['bbva', 'bilbao', 'vizcaya', 'argentaria'] },
                { id: 'poste', keywords: ['poste', 'bancoposta', 'postepay', 'posteitaliane'] },
                { id: 'unicredit', keywords: ['unicredit', 'uni credit'] },
                { id: 'intesa', keywords: ['intesa', 'sanpaolo', 'san paolo'] },
                { id: 'bnl', keywords: ['bnl', 'bnp paribas'] },
                { id: 'fineco', keywords: ['fineco'] },
                { id: 'hype', keywords: ['hype'] },
                { id: 'n26', keywords: ['n26'] },
                { id: 'wise', keywords: ['wise', 'transferwise'] },
                { id: 'satispay', keywords: ['satispay'] },
                { id: 'crypto', keywords: ['binance', 'coinbase', 'crypto com', 'metamask', 'kraken'] }
            ];

            for (const brand of brands) {
                if (brand.keywords.some(k => haystack.includes(k))) {
                    const match = localAccounts.find((la: any) => la.id === brand.id);
                    if (match) {
                        console.log(`🏦 [RESOLVE] Brand match: ${brand.id}`);
                        return match.id;
                    }
                    // Also try matching a custom local account whose name contains the brand
                    const byName = localAccounts.find((la: any) => this.normalizeName(la.name).includes(brand.keywords[0]));
                    if (byName) {
                        console.log(`🏦 [RESOLVE] Brand match by local name: ${byName.id}`);
                        return byName.id;
                    }
                }
            }

            // 3. Generic name matching (works for any bank, scored best-match).
            let best: { id: string, score: number } | null = null;
            for (const la of localAccounts) {
                const localName = this.normalizeName(la.name);
                if (localName.length < 3) continue;

                let score = 0;
                if (aspspName && (aspspName.includes(localName) || localName.includes(aspspName))) score = 3;
                else if (accName && (accName.includes(localName) || localName.includes(accName))) score = 2;
                else {
                    // Token overlap: at least one word of 4+ chars in common
                    const localTokens = localName.split(' ').filter(t => t.length >= 4);
                    const shared = localTokens.filter(t => haystack.includes(t));
                    if (shared.length > 0) score = 1;
                }

                if (score > 0 && (!best || score > best.score)) {
                    best = { id: la.id, score };
                }
            }

            if (best) {
                console.log(`🏦 [RESOLVE] Name match: ${best.id} (score ${best.score})`);
                return best.id;
            }

        } catch (e) {
            console.error('Error in resolveLocalAccountId:', e);
        }

        console.warn(`⚠️ Could not resolve a local account for ${acc.uid} ("${acc.name || ''}" / "${acc.aspsp_name || ''}"). Use the manual mapping in Sync Bancario.`);
        return acc.uid;
    }

    /**
     * Sync all accounts (Transactions + Balances)
     */
    static async syncAll(force = false): Promise<{
        transactions: number, adjustments: number, accounts: number, skipped: number,
        autoRegistered: number, autoLinked: number, toReview: number
    }> {
        const lastSync = localStorage.getItem(this.STORAGE_KEY_LAST_SYNC);
        const cooldown = 60 * 60 * 1000; // 1 hour

        if (!force && lastSync) {
            const timeSinceLastSync = Date.now() - parseInt(lastSync);
            if (timeSinceLastSync < cooldown) {
                const minsLeft = Math.ceil((cooldown - timeSinceLastSync) / 60000);
                console.log(`🛡️ Sync throttled. Prossimo aggiornamento tra ${minsLeft} minuti.`);
                return { transactions: 0, adjustments: 0, accounts: 0, skipped: 0, autoRegistered: 0, autoLinked: 0, toReview: 0 };
            }
        }

        if (this.isSyncing) {
            console.log('⏳ Sync already in progress, skipping duplicate call');
            return { transactions: 0, adjustments: 0, accounts: 0, skipped: 0, autoRegistered: 0, autoLinked: 0, toReview: 0 };
        }

        this.isSyncing = true;
        try {
            const accounts = await this.fetchAccounts();
            let totalAdded = 0;
            let adjustmentsCount = 0;
            const syncedLocalIds = new Set<string>();

            // Diagnostic report of what this sync actually did, per bank account.
            // Stored in localStorage and shown in the Bank Sync modal ("Dettagli ultimo sync").
            const reportAccounts: any[] = [];
            const reportSkipped: any[] = [];

            const localAccountIds = new Set<string>(
                (JSON.parse(localStorage.getItem('accounts_v1') || '[]') as any[]).map(a => a.id)
            );

            // Keep only EUR accounts. Some banks (e.g. Revolut) expose one account per
            // currency: importing non-EUR pockets would mix currencies into euro totals.
            const eurAccounts = accounts.filter(acc => {
                const cur = String(acc.currency || '').toUpperCase();
                if (cur && cur !== 'EUR') {
                    console.log(`⏭️ Skipping non-EUR account "${acc.name || acc.uid}" (${cur})`);
                    reportSkipped.push({ name: acc.name || '', bank: acc.aspsp_name || '', uid: acc.uid, currency: cur, reason: 'valuta non EUR' });
                    return false;
                }
                return true;
            });

            // Group bank accounts by resolved local account: several bank accounts can
            // map to the same local one (main + card, or multiple pockets). Balance and
            // reconciliation must be aggregated per local account, not overwritten by
            // whichever bank account happens to be fetched last.
            const groups = new Map<string, any[]>();
            for (const acc of eurAccounts) {
                const localAccountId = this.resolveLocalAccountId(acc);
                syncedLocalIds.add(localAccountId);
                const list = groups.get(localAccountId) || [];
                list.push(acc);
                groups.set(localAccountId, list);
            }

            for (const [localAccountId, group] of groups) {
                await this.sleep(1000);

                // 1. Transactions (per bank account)
                for (const acc of group) {
                    const entry: any = {
                        bank: acc.aspsp_name || '',
                        name: acc.name || '',
                        uid: acc.uid,
                        currency: String(acc.currency || 'EUR').toUpperCase(),
                        localAccountId,
                        localAccountFound: localAccountIds.has(localAccountId),
                        transactionsAdded: 0,
                        autoRegistered: 0,
                        autoLinked: 0,
                        toReview: 0,
                        balance: null,
                        balanceCurrency: null,
                        status: 'ok'
                    };
                    let rawTxs: any[] = [];
                    try {
                        rawTxs = await this.fetchRawTransactions(acc.uid);
                    } catch (txError: any) {
                        console.warn(`⚠️ Could not fetch transactions for ${acc.name || acc.uid}:`, txError.message);
                        entry.status = 'errore transazioni';
                    }
                    const bankAutoConfirm = AutoConfirmService.shouldAutoConfirm('bank');
                    for (const rawTx of rawTxs) {
                        const mappedTx = this.mapToAutoTransaction(rawTx, localAccountId);
                        const added = await AutoTransactionService.addAutoTransaction(mappedTx, { autoConfirm: bankAutoConfirm });
                        if (added) {
                            totalAdded++;
                            entry.transactionsAdded++;
                            if (added.autoOutcome === 'registered') entry.autoRegistered++;
                            else if (added.autoOutcome === 'linked-recurring') entry.autoLinked++;
                            else entry.toReview++;
                        }
                    }
                    reportAccounts.push(entry);
                }

                // 2. Balances: sum the EUR balances of every bank account in the group
                let bankBalanceSum: number | null = null;
                for (const acc of group) {
                    try {
                        const bal = await this.fetchBalance(acc.uid);
                        const entry = reportAccounts.find(e => e.uid === acc.uid);
                        if (bal !== null) {
                            if (entry) { entry.balance = bal.value; entry.balanceCurrency = bal.currency; }
                            if (bal.currency === 'EUR') {
                                bankBalanceSum = (bankBalanceSum ?? 0) + bal.value;
                            } else {
                                console.log(`⏭️ Ignoring ${bal.currency} balance of "${acc.name || acc.uid}"`);
                                if (entry && entry.status === 'ok') entry.status = `saldo in ${bal.currency} ignorato`;
                            }
                        } else if (entry && entry.status === 'ok') {
                            entry.status = 'saldo non disponibile';
                        }
                    } catch (balanceError: any) {
                        console.warn(`⚠️ Could not fetch balance for ${acc.name || acc.uid}:`, balanceError.message);
                        const entry = reportAccounts.find(e => e.uid === acc.uid);
                        if (entry && entry.status === 'ok') entry.status = 'errore saldo';
                    }
                }

                if (bankBalanceSum !== null) {
                    const localAccounts = JSON.parse(localStorage.getItem('accounts_v1') || '[]');
                    const accountIndex = localAccounts.findIndex((a: any) => a.id === localAccountId);
                    if (accountIndex !== -1) {
                        localAccounts[accountIndex].cachedBalance = bankBalanceSum;
                        localAccounts[accountIndex].lastSyncDate = new Date().toISOString();
                        localStorage.setItem('accounts_v1', JSON.stringify(localAccounts));
                    }

                    // 3. Reconcile once per local account (against the aggregated bank balance)
                    const localBalance = this.calculateLocalBalance(localAccountId);
                    const diff = bankBalanceSum - localBalance;

                    if (Math.abs(diff) > 0.01) {
                        const names = group.map(a => a.name).filter(Boolean).join(' + ');
                        await AutoTransactionService.addAdjustment(
                            localAccountId,
                            diff,
                            `Riconciliazione Automatica ${names || localAccountId}`
                        );
                        adjustmentsCount++;
                    }
                }
            }

            localStorage.setItem(this.STORAGE_KEY_LAST_SYNC, Date.now().toString());
            localStorage.setItem('bank_sync_synced_local_ids', JSON.stringify(Array.from(syncedLocalIds)));

            const autoRegistered = reportAccounts.reduce((n, a) => n + (a.autoRegistered || 0), 0);
            const autoLinked = reportAccounts.reduce((n, a) => n + (a.autoLinked || 0), 0);
            const toReview = reportAccounts.reduce((n, a) => n + (a.toReview || 0), 0);

            localStorage.setItem('bank_sync_last_report', JSON.stringify({
                timestamp: new Date().toISOString(),
                accountsProcessed: reportAccounts.length,
                accountsSkipped: reportSkipped.length,
                accounts: reportAccounts,
                skipped: reportSkipped,
                totals: { transactions: totalAdded, adjustments: adjustmentsCount, autoRegistered, autoLinked, toReview }
            }));

            // One summary notification instead of one per auto-registered movement
            await AutoTransactionService.notifyAutoSummary(autoRegistered, autoLinked);

            // Notify UI
            window.dispatchEvent(new Event('bank-sync-complete'));
            window.dispatchEvent(new Event('accounts-updated'));
            window.dispatchEvent(new Event('expenses-updated'));
            window.dispatchEvent(new Event('auto-transactions-updated'));

            return {
                transactions: totalAdded,
                adjustments: adjustmentsCount,
                accounts: reportAccounts.length,
                skipped: reportSkipped.length,
                autoRegistered,
                autoLinked,
                toReview
            };
        } catch (error) {
            console.error('Bank sync failed:', error);
            throw error;
        } finally {
            this.isSyncing = false;
        }
    }

    private static mapToAutoTransaction(tx: any, accountUid: string): Omit<AutoTransaction, 'id' | 'createdAt' | 'sourceHash' | 'status'> {
        // Enable Banking returns snake_case fields (transaction_amount, booking_date,
        // entry_reference, remittance_information...). camelCase is kept as fallback
        // for resilience against API variations.
        const amountObj = tx.transaction_amount ?? tx.transactionAmount ?? null;
        let rawAmount: any = 0;
        if (amountObj && typeof amountObj === 'object') {
            rawAmount = amountObj.amount ?? amountObj.value ?? 0;
        } else if (amountObj !== null && amountObj !== undefined) {
            // amount passed as plain number/string
            rawAmount = amountObj;
        } else if (tx.amount && typeof tx.amount === 'object') {
            rawAmount = tx.amount.amount ?? tx.amount.value ?? 0;
        } else if (tx.amount !== undefined) {
            rawAmount = tx.amount;
        }

        const amount = parseFloat(String(rawAmount)) || 0;
        let type: 'expense' | 'income' = amount < 0 ? 'expense' : 'income';

        const date = tx.booking_date || tx.bookingDate || tx.value_date || tx.valueDate || new Date().toISOString().split('T')[0];

        // remittance_information is an array of strings in the Enable Banking API
        let description = '';
        const remittance = tx.remittance_information ?? tx.remittanceInformation;
        if (Array.isArray(remittance)) {
            description = remittance.join(' ').trim();
        } else if (typeof remittance === 'string') {
            description = remittance.trim();
        }
        if (!description) {
            description = tx.description || tx.remittance_information_unstructured || tx.remittanceInformationUnstructured || 'Transazione Bancaria';
        }

        const bankTransactionId = tx.entry_reference || tx.entryReference
            || tx.transaction_id || tx.transactionId
            || tx.end_to_end_id || tx.endToEndId
            || undefined;

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
