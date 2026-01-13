import React, { useState, useEffect } from 'react';
import { BankSyncService, BankSyncCredentials } from '../services/bank-sync-service';
import { Capacitor } from '@capacitor/core';
import { InAppBrowser } from '@awesome-cordova-plugins/in-app-browser';

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

    useEffect(() => {
        if (isOpen) {
            const stored = BankSyncService.getCredentials();
            if (stored) {
                setCredentials(stored);
            }
        }
    }, [isOpen]);

    const handleSave = () => {
        if (!credentials.appId || !credentials.clientId || !credentials.privateKey) {
            showToast({ message: 'Compila tutti i campi.', type: 'error' });
            return;
        }
        BankSyncService.saveCredentials(credentials);
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
            showToast({ message: `Errore sync: ${error.message}`, type: 'error' });
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
                    if (event.url.includes('code=')) {
                        const code = new URL(event.url).searchParams.get('code');
                        if (code) {
                            try {
                                await BankSyncService.authorizeSession(code);
                                showToast({ message: "Conto autorizzato con successo!", type: 'success' });
                                handleTestConnection();
                            } catch (e: any) {
                                showToast({ message: `Errore: ${e.message}`, type: 'error' });
                            } finally {
                                browser.close();
                            }
                        }
                    } else if (event.url.includes('error=')) {
                        showToast({ message: "Autorizzazione negata o errore.", type: 'error' });
                        browser.close();
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
                    await BankSyncService.authorizeSession(code);
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

    if (!isOpen) return null;

    return (
        <div className="modal-overlay active" onClick={onClose}>
            <div className="modal-content glass-modal active" onClick={e => e.stopPropagation()}>
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

                    <div className="form-group mb-4">
                        <label className="text-xs font-bold uppercase opacity-60">Application ID</label>
                        <input
                            type="text"
                            className="glass-input w-full"
                            value={credentials.appId}
                            onChange={e => setCredentials({ ...credentials, appId: e.target.value })}
                            placeholder="es. d033182f-..."
                        />
                    </div>

                    <div className="form-group mb-4">
                        <label className="text-xs font-bold uppercase opacity-60">Client ID</label>
                        <input
                            type="text"
                            className="glass-input w-full"
                            value={credentials.clientId}
                            onChange={e => setCredentials({ ...credentials, clientId: e.target.value })}
                            placeholder="es. client_id_..."
                        />
                    </div>

                    <div className="form-group mb-4">
                        <label className="text-xs font-bold uppercase opacity-60">RSA Private Key (PEM format)</label>
                        <textarea
                            className="glass-input w-full h-32 font-mono text-xs"
                            value={credentials.privateKey}
                            onChange={e => setCredentials({ ...credentials, privateKey: e.target.value })}
                            placeholder="-----BEGIN PRIVATE KEY----- ..."
                        />
                    </div>

                    <div className="flex gap-2 mb-6">
                        <button className="glass-btn flex-1 py-3" onClick={handleSave}>Salva</button>
                        <button
                            className="glass-btn flex-1 py-3 bg-blue-500/20"
                            onClick={handleTestConnection}
                            disabled={isTesting}
                        >
                            {isTesting ? 'Verifica...' : 'Test Connessione'}
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
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium">{acc.name || 'Conto'}</span>
                                            <span className="text-xs opacity-50">{acc.iban || acc.uid}</span>
                                        </div>
                                        <div className="text-right">
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
                                        <div className="flex items-center gap-3">
                                            {b.logo && <img src={b.logo} alt="" className="w-6 h-6 rounded-md" />}
                                            <span className="text-sm">{b.name}</span>
                                        </div>
                                        <span className="text-xs text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {isLinking ? '...' : 'Collega →'}
                                        </span>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col gap-2 mt-6">
                        <button
                            className="btn-primary w-full py-3 flex items-center justify-center gap-2"
                            onClick={handleTestConnection}
                            disabled={isTesting}
                        >
                            {isTesting ? 'In corso...' : '🧪 Test Connessione'}
                        </button>

                        <div className="flex gap-2">
                            <button
                                className="btn-secondary flex-1 py-3"
                                onClick={handleSave}
                            >
                                💾 Salva
                            </button>
                            <button
                                className="btn-accent flex-1 py-3 font-bold"
                                onClick={handleSyncNow}
                                disabled={isSyncing}
                            >
                                {isSyncing ? 'Sincronizzazione...' : '🔄 Sincronizza Ora'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: flex-start; /* Permette lo scroll dall'alto */
          justify-content: center;
          z-index: 9999;
          opacity: 0;
          visibility: hidden;
          transition: all 0.2s ease-in-out;
          padding: 16px;
          overflow-y: auto; /* Permette lo scroll dell'intero overlay se necessario */
        }
        .modal-overlay.active {
          opacity: 1;
          visibility: visible;
        }
        .glass-modal {
          background: rgba(30, 41, 59, 0.95);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 24px;
          color: white;
          width: 100%;
          max-width: 500px;
          margin-top: 20px;
          margin-bottom: 20px;
          transform: scale(0.95);
          transition: all 0.2s ease-in-out;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          display: flex;
          flex-direction: column;
          max-height: calc(100vh - 40px); /* Evita che esca dallo schermo */
        }
        .modal-overlay.active .glass-modal {
          transform: scale(1);
        }
        .modal-body {
          flex: 1;
          overflow-y: auto; /* Scroll interno al corpo del modale */
          padding-right: 8px;
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
        .btn-primary {
          background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
          border-radius: 12px;
          color: white;
          border: none;
          cursor: pointer;
        }
        .btn-secondary {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .btn-accent {
          background: #10b981;
          border-radius: 12px;
          color: white;
          border: none;
        }
        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
        </div>
    );
};
