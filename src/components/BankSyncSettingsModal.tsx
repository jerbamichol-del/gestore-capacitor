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
        }
    }, [isOpen]);

    // Native back button support
    useEffect(() => {
        if (!isOpen) return;

        let backButtonListener: { remove: () => void } | null = null;

        const setupBackButton = async () => {
            backButtonListener = await App.addListener('backButton', () => {
                onClose();
            });
        };

        if (Capacitor.isNativePlatform()) {
            setupBackButton();
        }

        return () => {
            if (backButtonListener) {
                backButtonListener.remove();
            }
        };
    }, [isOpen, onClose]);

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

    const handleTestConnection = async () => {
        setIsTesting(true);
        try {
            BankSyncService.saveCredentials(credentials);
            // First hit /aspsps to verify absolute connectivity
            await BankSyncService.testConnection();

            // If successful, try to fetch accounts (might be empty/404 if no session, but /aspsps success is enough)
            try {
                const accounts = await BankSyncService.fetchAccounts();
                const withBalances = await Promise.all(accounts.map(async (acc) => ({
                    ...acc,
                    balance: await BankSyncService.fetchBalance(acc.uid).catch(() => null)
                })));
                setAccountsWithBalances(withBalances);
                showToast({
                    message: "Credenziali valide! Connessione stabilita con Enable Banking.",
                    type: 'success'
                });
            } catch (err: any) {
                // If /aspsps worked but /accounts failed (e.g. no session), it's still a success of credentials
                showToast({
                    message: "Credenziali valide, ma nessun conto autorizzato trovato. Verifica i permessi sul portale.",
                    type: 'success'
                });
            }
        } catch (error: any) {
            console.error(error);
            showToast({ message: `Errore: ${error.message}`, type: 'error' });
        } finally {
            setIsTesting(false);
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
            handleTestConnection();
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

                    // Check for authorization code
                    if (event.url.includes('code=')) {
                        authorizationCompleted = true; // Set flag immediately to prevent duplicates

                        try {
                            // Parse code from URL - handle both proper URL format and edge cases
                            let code: string | null = null;
                            try {
                                const callbackUrl = new URL(event.url);
                                code = callbackUrl.searchParams.get('code');
                            } catch (urlError) {
                                // Fallback: extract code manually using regex
                                console.log('⚠️ URL parsing failed, using regex fallback...');
                                const match = event.url.match(/[?&]code=([^&]+)/);
                                if (match) {
                                    code = decodeURIComponent(match[1]);
                                }
                            }

                            // Create dynamic redirect URL from the actual event URL
                            // This defines the 'redirect_uri' sent to /sessions, which must match the one used in the callback
                            let dynamicRedirectUrl = redirectUrl; // Default to the one we requested
                            try {
                                const callbackUrl = new URL(event.url);
                                // Construct base URL (origin + path)
                                dynamicRedirectUrl = callbackUrl.origin + callbackUrl.pathname;

                                console.log('🕵️ OAuth Debug - Dynamic URL Detection:');
                                console.log('   Original Event URL:', event.url);
                                console.log('   Callback Origin:', callbackUrl.origin);
                                console.log('   Callback Pathname:', callbackUrl.pathname);
                                console.log('   Initial Dynamic URL:', dynamicRedirectUrl);

                                // INTELLIGENT DETECTION: Check if the URL contains a nested 'redirect_uri' 
                                // This happens when banks redirect back to Enable Banking (tilisy) proxy
                                // We look for redirect_uri followed by =, %3D or %253D
                                const nestedMatch = event.url.match(/redirect_uri(?:=|%3D|%253D)([^&% ]+)/i);

                                if (nestedMatch) {
                                    let extracted = nestedMatch[1];
                                    console.log('   🔍 Found potential nested redirect_uri:', extracted);

                                    // Deep decode (handle multiple levels of encoding like Revolut's %253D)
                                    let decoded = extracted;
                                    let previous;
                                    let iterations = 0;
                                    do {
                                        previous = decoded;
                                        decoded = decodeURIComponent(decoded);
                                        iterations++;
                                    } while (decoded !== previous && iterations < 5);

                                    if (decoded.startsWith('http') && decoded.includes('enablebanking.com')) {
                                        dynamicRedirectUrl = decoded;
                                        console.log('   🎯 Successfully extracted and decoded:', dynamicRedirectUrl);
                                    }
                                }

                                // CLEANUP: If we didn't find a nested URI, and we are using origin+pathname from the proxy
                                if (dynamicRedirectUrl === (callbackUrl.origin + callbackUrl.pathname)) {
                                    // (Legacy logic for simple proxy redirects like PayPal)
                                }

                                console.log('📍 FINAL Detected actual redirect URL:', dynamicRedirectUrl);
                            } catch (e) {
                                console.warn('⚠️ Could not derive dynamic redirect URL, using default:', redirectUrl);
                                console.error(e);
                            }

                            console.log('🔑 Extracted authorization code:', code ? `${code.substring(0, 10)}...` : 'null');

                            if (code) {
                                console.log('🔄 Calling authorizeSession with redirectUrl:', dynamicRedirectUrl);
                                await BankSyncService.authorizeSession(code, dynamicRedirectUrl);
                                showToast({ message: "Conto autorizzato con successo!", type: 'success' });
                                handleTestConnection();
                            } else {
                                showToast({ message: "Errore: codice di autorizzazione non trovato", type: 'error' });
                            }
                        } catch (e: any) {
                            console.error('❌ Authorization failed:', e);
                            showToast({ message: `Errore: ${e.message}`, type: 'error' });
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
                    <label className="text-xs font-bold uppercase opacity-60">{label}</label>
                    {isTextarea ? (
                        <textarea
                            className="glass-input w-full h-32 font-mono text-xs"
                            value={value}
                            onChange={e => setCredentials({ ...credentials, [field]: e.target.value })}
                            placeholder={placeholder}
                            autoFocus={editingField === field}
                        />
                    ) : (
                        <input
                            type="text"
                            className="glass-input w-full"
                            value={value}
                            onChange={e => setCredentials({ ...credentials, [field]: e.target.value })}
                            placeholder={placeholder}
                            autoFocus={editingField === field}
                        />
                    )}
                    {isCredentialsLocked && (
                        <button
                            className="text-xs text-gray-400 hover:text-white mt-1"
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
                <label className="text-xs font-bold uppercase opacity-60">{label}</label>
                <div className="flex items-center gap-2">
                    <div className="glass-input flex-1 text-sm opacity-70 font-mono truncate">
                        {maskValue(value)}
                    </div>
                    <button
                        className="glass-btn px-3 py-2 text-xs"
                        onClick={() => setEditingField(field)}
                    >
                        ✏️ Modifica
                    </button>
                </div>
            </div>
        );
    };

    if (!isOpen) return null;

    return (
        <div className="bank-sync-modal-overlay" onClick={onClose}>
            <div className="bank-sync-modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>
                        <span className="icon">🏦</span>
                        Sync Bancario (Enable Banking)
                    </h3>
                    <button className="close-btn" onClick={onClose}>&times;</button>
                </div>

                <div className="modal-body p-4">
                    <p className="text-sm opacity-70 mb-4">
                        Inserisci i dati ottenuti dal portale Enable Banking per scaricare i movimenti in tempo reale.
                    </p>

                    {renderCredentialField('appId', 'Application ID', 'es. d033182f-...')}
                    {renderCredentialField('clientId', 'Client ID', 'es. client_id_...')}
                    {renderCredentialField('privateKey', 'RSA Private Key (PEM format)', '-----BEGIN PRIVATE KEY----- ...', true)}

                    <div className="flex gap-2 mb-6">
                        <button className="glass-btn flex-1 py-3" onClick={handleSave}>💾 Salva</button>
                        <button
                            className="glass-btn flex-1 py-3 bg-blue-500/20"
                            onClick={handleTestConnection}
                            disabled={isTesting}
                        >
                            {isTesting ? 'Verifica...' : '🧪 Test'}
                        </button>
                    </div>

                    <hr className="border-white/10 mb-6" />

                    {accountsWithBalances.length > 0 && (
                        <div className="mb-6">
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-xs font-bold uppercase opacity-60">Conti Collegati</label>
                                <button
                                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                                    onClick={handleSyncNow}
                                    disabled={isSyncing}
                                >
                                    {isSyncing ? 'Sincronizzazione...' : '🔄 Sincronizza Ora'}
                                </button>
                            </div>
                            <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                                {accountsWithBalances.map((acc, i) => (
                                    <div key={i} className="flex justify-between items-center p-3 bg-black/20 rounded-xl border border-white/10">
                                        <div className="flex flex-col min-w-0 flex-1 mr-2">
                                            <span className="text-sm font-medium truncate">{acc.name || 'Conto'}</span>
                                            <span className="text-xs opacity-50 truncate">{acc.iban || acc.uid}</span>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <div className="text-sm font-bold">
                                                {acc.balance !== null ? `${acc.balance.toFixed(2)}€` : '---'}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="mb-4">
                        <label className="text-xs font-bold uppercase opacity-60 block mb-2">Collega Nuova Banca</label>
                        <div className="flex gap-2 mb-2">
                            <input
                                type="text"
                                className="glass-input flex-1"
                                placeholder="Cerca banca (es. Revolut, Intesa...)"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                onFocus={() => { if (aspsps.length === 0) handleSearchBanks(); }}
                            />
                        </div>

                        <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar bg-black/10 rounded-xl p-2 border border-white/5">
                            {isLoadingBanks ? (
                                <div className="p-4 text-center opacity-50 text-sm">Caricamento banche...</div>
                            ) : filteredAspsps.length === 0 ? (
                                <div className="p-4 text-center opacity-50 text-sm">Nessuna banca trovata.</div>
                            ) : (
                                filteredAspsps.map((b, i) => (
                                    <button
                                        key={i}
                                        className="w-full flex items-center justify-between p-3 hover:bg-white/5 rounded-lg transition-colors group"
                                        onClick={() => handleLinkBank(b)}
                                        disabled={isLinking}
                                    >
                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                            {b.logo && <img src={b.logo} alt="" className="w-6 h-6 rounded-md flex-shrink-0" />}
                                            <span className="text-sm truncate">{b.name}</span>
                                        </div>
                                        <span className="text-xs text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2">
                                            {isLinking ? '...' : 'Collega →'}
                                        </span>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col gap-2 mt-6">
                        <button
                            className="btn-accent w-full py-3 font-bold flex items-center justify-center gap-2"
                            onClick={handleSyncNow}
                            disabled={isSyncing}
                        >
                            {isSyncing ? 'Sincronizzazione...' : '🔄 Sincronizza Ora'}
                        </button>
                    </div>
                </div>
            </div>

            <style>{`
        .bank-sync-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.95);
          display: flex;
          align-items: stretch;
          justify-content: center;
          z-index: 9999;
          opacity: 0;
          visibility: hidden;
          transition: opacity 0.2s ease-in-out;
          animation: fadeIn 0.2s ease-in-out forwards;
        }
        @keyframes fadeIn {
          to {
            opacity: 1;
            visibility: visible;
          }
        }
        .bank-sync-modal-content {
          background: rgba(30, 41, 59, 1);
          color: white;
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .bank-sync-modal-content .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(30, 41, 59, 1);
          flex-shrink: 0;
        }
        .bank-sync-modal-content .modal-header h3 {
          font-size: 1.25rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .bank-sync-modal-content .modal-header .icon {
          font-size: 1.5rem;
        }
        .bank-sync-modal-content .modal-header .close-btn {
          font-size: 2rem;
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.6);
          cursor: pointer;
          line-height: 1;
          padding: 0;
        }
        .bank-sync-modal-content .modal-header .close-btn:hover {
          color: white;
        }
        .bank-sync-modal-content .modal-body {
          flex: 1;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior: contain;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 10px;
        }
        .glass-input {
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 12px;
          color: white;
          outline: none;
        }
        .glass-input:focus {
          border-color: rgba(99, 102, 241, 0.5);
        }
        .glass-btn {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          color: white;
          cursor: pointer;
          transition: background 0.2s;
        }
        .glass-btn:hover {
          background: rgba(255, 255, 255, 0.15);
        }
        .btn-accent {
          background: #10b981;
          border-radius: 12px;
          color: white;
          border: none;
        }
        .btn-accent:hover {
          background: #059669;
        }
        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
        </div>
    );
};
