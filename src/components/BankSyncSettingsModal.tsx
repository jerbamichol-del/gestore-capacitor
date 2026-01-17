import React, { useState, useEffect } from 'react';
import { BankSyncService, BankSyncCredentials } from '../services/bank-sync-service';
import { Capacitor } from '@capacitor/core';
import { InAppBrowser } from '@awesome-cordova-plugins/in-app-browser';
import { App } from '@capacitor/app';

interface BankSyncSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    showToast: (msg: { message: string, type: 'success' | 'info' | 'error' }) => void;
}

export const BankSyncSettingsModal: React.FC<BankSyncSettingsModalProps> = ({
    isOpen,
    onClose,
    showToast
}) => {
    const [credentials, setCredentials] = useState<BankSyncCredentials>({
        appId: '',
        clientId: '',
        privateKey: ''
    });
    const [accountsWithBalances, setAccountsWithBalances] = useState<any[]>([]);
    const [isTesting, setIsTesting] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [aspsps, setAspsps] = useState<any[]>([]);
    const [filteredAspsps, setFilteredAspsps] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoadingBanks, setIsLoadingBanks] = useState(false);
    const [isLinking, setIsLinking] = useState(false);
    const [localAccounts, setLocalAccounts] = useState<any[]>([]);
    const [accountMappings, setAccountMappings] = useState<Record<string, string>>({});

    // State for credential visibility
    const [isCredentialsLocked, setIsCredentialsLocked] = useState(false);
    const [editingField, setEditingField] = useState<'appId' | 'clientId' | 'privateKey' | null>(null);

    useEffect(() => {
        if (isOpen) {
            const stored = BankSyncService.getCredentials();
            if (stored) {
                setCredentials(stored);
                // Lock credentials if they are already saved
                setIsCredentialsLocked(!!stored.appId && !!stored.clientId && !!stored.privateKey);
            } else {
                setIsCredentialsLocked(false);
            }
            setEditingField(null);

            // Fetch accounts if credentials exist
            if (stored && stored.appId) {
                handleTestConnection(true);
            }

            // Load local accounts for mapping
            const storedAccounts = JSON.parse(localStorage.getItem('accounts_v1') || '[]');
            setLocalAccounts(storedAccounts);

            // Load current mappings
            setAccountMappings(BankSyncService.getAccountMappings());
        }
    }, [isOpen]);


    const handleSave = () => {
        if (!credentials.appId || !credentials.clientId || !credentials.privateKey) {
            showToast({ message: 'Compila tutti i campi.', type: 'error' });
            return;
        }
        BankSyncService.saveCredentials(credentials);
        setIsCredentialsLocked(true);
        setEditingField(null);
        showToast({ message: 'Credenziali salvate!', type: 'success' });
    };

    const handleTestConnection = async (silent = false) => {
        if (!silent) setIsTesting(true);
        try {
            const currentCreds = BankSyncService.getCredentials();
            if (!currentCreds) return;

            // If we are testing manually, we might want to use what's in the state if it's different
            // But usually we save before testing.

            // First hit /aspsps to verify absolute connectivity
            await BankSyncService.testConnection();

            // If successful, try to fetch accounts
            try {
                const accounts = await BankSyncService.fetchAccounts();
                const withBalances = await Promise.all(accounts.map(async (acc) => ({
                    ...acc,
                    balance: await BankSyncService.fetchBalance(acc.uid).catch(() => null)
                })));
                setAccountsWithBalances(withBalances);
                if (!silent) {
                    showToast({
                        message: "Credenziali valide! Connessione stabilita con Enable Banking.",
                        type: 'success'
                    });
                }
            } catch (err: any) {
                // If /aspsps worked but /accounts failed (e.g. no session), it's still a success of credentials
                if (!silent) {
                    showToast({
                        message: "Credenziali valide, ma nessun conto autorizzato trovato. Verifica i permessi sul portale.",
                        type: 'success'
                    });
                }
            }
        } catch (error: any) {
            console.error(error);
            if (!silent) {
                showToast({ message: `Errore: ${error.message}`, type: 'error' });
            }
        } finally {
            if (!silent) setIsTesting(false);
        }
    };

    const handleSyncNow = async () => {
        setIsSyncing(true);
        try {
            const info = await BankSyncService.syncAll();
            showToast({
                message: `Sync completato: ${info.transactions} tx, ${info.adjustments} rettifiche.`,
                type: 'success'
            });
            // Update balances in UI
            handleTestConnection(true);
        } catch (error: any) {
            // Check for session expired error
            if (error.message?.includes('SESSION_EXPIRED')) {
                showToast({
                    message: 'Sessione bancaria scaduta. Ricollega la banca cliccando "Cerca Banche".',
                    type: 'error'
                });
            } else {
                showToast({ message: `Errore sync: ${error.message}`, type: 'error' });
            }
        } finally {
            setIsSyncing(false);
        }
    };

    const handleSearchBanks = async () => {
        setIsLoadingBanks(true);
        try {
            const list = await BankSyncService.fetchASPSPs('IT');
            setAspsps(list);
            setFilteredAspsps(list);
        } catch (error: any) {
            showToast({ message: `Errore caricamento banche: ${error.message}`, type: 'error' });
        } finally {
            setIsLoadingBanks(false);
        }
    };

    useEffect(() => {
        if (searchQuery.trim() === '') {
            setFilteredAspsps(aspsps);
        } else {
            setFilteredAspsps(aspsps.filter(b =>
                b.name.toLowerCase().includes(searchQuery.toLowerCase())
            ));
        }
    }, [searchQuery, aspsps]);

    const handleLinkBank = async (aspsp: any) => {
        // Check if bank is already linked
        const isAlreadyLinked = accountsWithBalances.some(acc => {
            const accAspspName = (acc.aspsp_name || acc.aspspName || '').toLowerCase().trim();
            const searchAspspName = (aspsp.name || '').toLowerCase().trim();
            return accAspspName === searchAspspName && accAspspName.length > 0;
        });

        if (isAlreadyLinked) {
            const confirm = window.confirm(`La banca ${aspsp.name} sembra essere già collegata. Vuoi aggiungere un'altra sessione per questo istituto?`);
            if (!confirm) return;
        }

        setIsLinking(true);
        try {
            // Use localhost as redirect, we'll intercept it with InAppBrowser on native
            const redirectUrl = 'https://localhost/';

            const authUrl = await BankSyncService.startAuthorization(aspsp, redirectUrl);

            if (Capacitor.isNativePlatform()) {
                let authorizationCompleted = false; // Flag to prevent duplicate authorization attempts

                const browser = InAppBrowser.create(authUrl, '_blank', {
                    location: 'yes',
                    clearcache: 'yes',
                    clearsessioncache: 'yes',
                    hidenavigationbuttons: 'yes',
                    hideurlbar: 'yes',
                    closebuttoncaption: 'Annulla'
                });

                browser.on('loadstart').subscribe(async (event) => {
                    console.log('🌐 InAppBrowser loadstart:', event.url);

                    // Prevent duplicate authorization attempts
                    if (authorizationCompleted) {
                        console.log('⚠️ Authorization already completed, skipping...');
                        return;
                    }

                    // Check for error first
                    if (event.url.includes('error=')) {
                        authorizationCompleted = true;
                        const errorUrl = new URL(event.url);
                        const error = errorUrl.searchParams.get('error');
                        const errorDescription = errorUrl.searchParams.get('error_description');
                        console.error('❌ OAuth Error:', error, errorDescription);
                        showToast({ message: errorDescription || "Autorizzazione negata o errore.", type: 'error' });
                        browser.close();
                        return;
                    }

                    // 1. Strict Hostname Checking
                    // We must capture the code ONLY when we are truly back on our redirect_uri (localhost).
                    // Intercepting on enablebanking.com/tilisy is too early and causes 422 errors 
                    // because the provider hasn't processed the bank's callback yet.
                    let currentHostname = '';
                    try {
                        currentHostname = new URL(event.url).hostname;
                    } catch (e) { }

                    const isCallbackDomain = currentHostname === 'localhost' ||
                        currentHostname === '127.0.0.1';
                    // Removed enablebanking.com to avoid premature capture

                    if (event.url.includes('code=') && isCallbackDomain) {
                        authorizationCompleted = true; // Set flag immediately to prevent duplicates

                        try {
                            // Parse code from URL
                            let code: string | null = null;
                            const callbackUrl = new URL(event.url);
                            code = callbackUrl.searchParams.get('code');

                            if (!code) {
                                const match = event.url.match(/[?&]code=([^&]+)/);
                                if (match) code = decodeURIComponent(match[1]);
                            }

                            // 2. Determine potential redirect_uris for redemption
                            const originalRedirectUrl = redirectUrl; // 'https://localhost/'
                            let dynamicRedirectUrl = redirectUrl;

                            try {
                                const rawUrl = event.url;
                                const fullyDecodedUrl = decodeURIComponent(decodeURIComponent(rawUrl));
                                const nestedMatch = fullyDecodedUrl.match(/redirect_uri=([^& ]+)/i);

                                if (nestedMatch && nestedMatch[1].startsWith('http')) {
                                    dynamicRedirectUrl = nestedMatch[1];
                                } else if (currentHostname.endsWith('enablebanking.com')) {
                                    dynamicRedirectUrl = new URL(event.url).origin + '/';
                                }
                            } catch (e) { }

                            console.log('🕵️ OAuth Debug - Redemption Strategy:');
                            console.log('   Original URL:', originalRedirectUrl);
                            console.log('   Dynamic URL:', dynamicRedirectUrl);
                            console.log('   Final Code:', code ? `${code.substring(0, 10)}...` : 'null');

                            if (code) {
                                // Strategy 1: The original URL sent to /auth
                                console.log('🔄 Strategy 1: Attempting ORIGINAL URL:', originalRedirectUrl);
                                try {
                                    await BankSyncService.authorizeSession(code, originalRedirectUrl);
                                    showToast({ message: "Conto autorizzato!", type: 'success' });
                                    handleTestConnection();
                                } catch (authError: any) {
                                    console.warn('⚠️ Strategy 1 failed:', authError.message);

                                    // Strategy 2: The dynamic proxy URL (if different)
                                    if (dynamicRedirectUrl !== originalRedirectUrl) {
                                        console.log('🔄 Strategy 2: Attempting DYNAMIC URL:', dynamicRedirectUrl);
                                        try {
                                            await BankSyncService.authorizeSession(code, dynamicRedirectUrl);
                                            showToast({ message: "Conto autorizzato!", type: 'success' });
                                            handleTestConnection();
                                            return; // Success
                                        } catch (e2: any) {
                                            console.warn('⚠️ Strategy 2 failed:', e2.message);
                                        }
                                    }

                                    // Strategy 3: No redirect URL
                                    console.log('🔄 Strategy 3: Attempting WITHOUT URL');
                                    try {
                                        await BankSyncService.authorizeSession(code);
                                        showToast({ message: "Conto autorizzato!", type: 'success' });
                                        handleTestConnection();
                                    } catch (e3: any) {
                                        console.error('❌ Strategy 3 failed:', e3.message);
                                        showToast({ message: `Errore: ${authError.message}`, type: 'error' });
                                    }
                                }
                            } else {
                                showToast({ message: "Codice non trovato.", type: 'error' });
                            }
                        } catch (err: any) {
                            console.error('❌ Authorization error:', err);
                        } finally {
                            browser.close();
                        }
                    }
                });

                browser.on('exit').subscribe(() => {
                    setIsLinking(false);
                });
            } else {
                window.location.href = authUrl;
            }
        } catch (error: any) {
            showToast({ message: `Errore autorizzazione: ${error.message}`, type: 'error' });
            setIsLinking(false);
        }
    };

    // Check for authorization code in URL on mount
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        if (code) {
            const finalize = async () => {
                try {
                    await BankSyncService.authorizeSession(code, 'https://localhost/');
                    showToast({ message: "Conto autorizzato con successo!", type: 'success' });
                    // Clean URL
                    window.history.replaceState({}, document.title, window.location.pathname);
                    handleTestConnection();
                } catch (e: any) {
                    showToast({ message: `Errore sincronizzazione sessione: ${e.message}`, type: 'error' });
                }
            };
            finalize();
        }
    }, []);

    const maskValue = (value: string) => {
        if (!value) return '(non impostato)';
        if (value.length <= 8) return '••••••••';
        return value.substring(0, 4) + '••••••••' + value.substring(value.length - 4);
    };

    const renderCredentialField = (
        field: 'appId' | 'clientId' | 'privateKey',
        label: string,
        placeholder: string,
        isTextarea = false
    ) => {
        const isEditing = editingField === field || !isCredentialsLocked;
        const value = credentials[field];

        if (isEditing) {
            return (
                <div className="form-group mb-4">
                    <label className="text-xs font-bold uppercase opacity-60 text-slate-500 dark:text-slate-400">{label}</label>
                    {isTextarea ? (
                        <textarea
                            className="w-full h-32 font-mono text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors"
                            value={value}
                            onChange={e => setCredentials({ ...credentials, [field]: e.target.value })}
                            placeholder={placeholder}
                            autoFocus={editingField === field}
                        />
                    ) : (
                        <input
                            type="text"
                            className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors"
                            value={value}
                            onChange={e => setCredentials({ ...credentials, [field]: e.target.value })}
                            placeholder={placeholder}
                            autoFocus={editingField === field}
                        />
                    )}
                    {isCredentialsLocked && (
                        <button
                            className="text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white mt-1"
                            onClick={() => setEditingField(null)}
                        >
                            Annulla
                        </button>
                    )}
                </div>
            );
        }

        return (
            <div className="form-group mb-4">
                <label className="text-xs font-bold uppercase opacity-60 text-slate-500 dark:text-slate-400">{label}</label>
                <div className="flex items-center gap-2">
                    <div className="flex-1 text-sm opacity-70 font-mono truncate p-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-700 dark:text-slate-300">
                        {maskValue(value)}
                    </div>
                    <button
                        className="px-3 py-2 text-xs font-semibold rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                        onClick={() => setEditingField(field)}
                    >
                        ✏️ Modifica
                    </button>
                </div>
            </div>
        );
    };

    if (!isOpen) return null;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-stretch justify-center bg-slate-900/40 backdrop-blur-sm animate-fade-in transition-opacity duration-200" onClick={onClose}>
            <div className="w-full h-full flex flex-col overflow-hidden bg-white dark:bg-slate-900 text-slate-800 dark:text-white transition-colors duration-300" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex-shrink-0">
                    <h3 className="text-xl font-semibold flex items-center gap-2">
                        <span className="text-2xl">🏦</span>
                        Sync Bancario (Enable Banking)
                    </h3>
                    <button className="text-3xl leading-none text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors" onClick={onClose}>&times;</button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 font-medium">
                        Inserisci i dati ottenuti dal portale Enable Banking per scaricare i movimenti in tempo reale.
                    </p>

                    {renderCredentialField('appId', 'Application ID', 'es. d033182f-...')}
                    {renderCredentialField('clientId', 'Client ID', 'es. client_id_...')}
                    {renderCredentialField('privateKey', 'RSA Private Key (PEM format)', '-----BEGIN PRIVATE KEY----- ...', true)}

                    <div className="flex gap-2 mb-6">
                        <button className="flex-1 py-3 rounded-xl font-bold bg-indigo-600 text-white shadow-md hover:bg-indigo-700 transition-colors" onClick={handleSave}>💾 Salva</button>
                        <button
                            className={`flex-1 py-3 rounded-xl font-bold transition-colors border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 ${isTesting ? 'opacity-70 cursor-wait' : ''}`}
                            onClick={() => handleTestConnection()}
                            disabled={isTesting}
                        >
                            {isTesting ? 'Verifica...' : '🧪 Test'}
                        </button>
                    </div>

                    <hr className="border-slate-200 dark:border-slate-700 mb-6" />

                    {accountsWithBalances.length > 0 && (
                        <div className="mb-6">
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-xs font-bold uppercase opacity-60 text-slate-500 dark:text-slate-400">Conti Collegati</label>
                                <button
                                    className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-500 transition-colors uppercase"
                                    onClick={handleSyncNow}
                                    disabled={isSyncing}
                                >
                                    {isSyncing ? 'Sincronizzazione...' : '🔄 Sincronizza Ora'}
                                </button>
                            </div>
                            <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                                {accountsWithBalances.map((acc, i) => (
                                    <div key={i} className="flex flex-col p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 gap-3">
                                        <div className="flex justify-between items-center">
                                            <div className="flex flex-col min-w-0 flex-1 mr-2">
                                                <span className="text-sm font-bold truncate text-slate-800 dark:text-white">{acc.name || 'Conto'}</span>
                                                <span className="text-[10px] opacity-60 truncate font-mono text-slate-500 dark:text-slate-400">{acc.iban || acc.uid}</span>
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                                <div className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                                                    {acc.balance !== null ? `${acc.balance.toFixed(2)}€` : '---'}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-[10px] font-bold uppercase opacity-60 ml-1 text-slate-500 dark:text-slate-400">Collega a Conto Locale:</label>
                                            <select
                                                className="w-full py-2 px-3 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                value={accountMappings[acc.uid] || ''}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setAccountMappings(prev => ({ ...prev, [acc.uid]: val }));
                                                    BankSyncService.setAccountMapping(acc.uid, val);
                                                    showToast({ message: 'Mapping aggiornato!', type: 'success' });
                                                }}
                                            >
                                                <option value="" className="text-slate-500">Seleziona conto...</option>
                                                {localAccounts.map(la => (
                                                    <option key={la.id} value={la.id}>
                                                        {la.name} ({la.id})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="mb-4">
                        <label className="text-xs font-bold uppercase opacity-60 block mb-2 text-slate-500 dark:text-slate-400">Collega Nuova Banca</label>
                        <div className="flex gap-2 mb-2">
                            <input
                                type="text"
                                className="flex-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors"
                                placeholder="Cerca banca (es. Revolut, Intesa...)"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                onFocus={() => { if (aspsps.length === 0) handleSearchBanks(); }}
                            />
                        </div>

                        <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar bg-slate-50 dark:bg-slate-800/50 rounded-xl p-2 border border-slate-200 dark:border-slate-700">
                            {isLoadingBanks ? (
                                <div className="p-4 text-center opacity-50 text-sm italic text-slate-500">Caricamento banche...</div>
                            ) : filteredAspsps.length === 0 ? (
                                <div className="p-4 text-center opacity-50 text-sm italic text-slate-500">Nessuna banca trovata.</div>
                            ) : (
                                filteredAspsps.map((b, i) => {
                                    const isAlreadyLinked = accountsWithBalances.some(acc => {
                                        const accAspspName = (acc.aspsp_name || acc.aspspName || '').toLowerCase().trim();
                                        const bName = (b.name || '').toLowerCase().trim();
                                        return accAspspName === bName && accAspspName.length > 0;
                                    });

                                    return (
                                        <button
                                            key={i}
                                            className="w-full flex items-center justify-between p-3 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors group bg-white dark:bg-slate-800 border border-transparent hover:border-slate-300 dark:hover:border-slate-600"
                                            onClick={() => handleLinkBank(b)}
                                            disabled={isLinking}
                                        >
                                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                                {b.logo && <img src={b.logo} alt="" className="w-6 h-6 rounded-md flex-shrink-0 bg-white p-0.5 object-contain" />}
                                                <div className="flex flex-col items-start min-w-0">
                                                    <span className="text-sm font-medium truncate text-slate-800 dark:text-white">{b.name}</span>
                                                    {isAlreadyLinked && <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">✓ GIÀ COLLEGATA</span>}
                                                </div>
                                            </div>
                                            <span className="text-xs text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2 font-semibold">
                                                {isLinking ? '...' : (isAlreadyLinked ? 'Ricollega' : 'Collega →')}
                                            </span>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col gap-2 mt-6">
                        <button
                            className="w-full py-3 rounded-xl font-bold bg-emerald-500 text-white shadow-md hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"
                            onClick={handleSyncNow}
                            disabled={isSyncing}
                        >
                            {isSyncing ? 'Sincronizzazione...' : '🔄 Sincronizza Ora'}
                        </button>

                        <button
                            className="text-xs text-red-500 dark:text-red-400 opacity-70 hover:opacity-100 transition-opacity mt-4 py-2 font-semibold bg-red-50 dark:bg-red-900/10 rounded-lg"
                            onClick={async () => {
                                if (window.confirm('Vuoi davvero scollegare TUTTE le banche e resettare le configurazioni?')) {
                                    await BankSyncService.clearAllSessions();
                                    setAccountsWithBalances([]);
                                    setAccountMappings({});
                                    showToast({ message: 'Tutte le banche scollegate.', type: 'info' });
                                }
                            }}
                        >
                            ⚠️ Scollega tutto e resetta
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
