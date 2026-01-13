import React, { useState, useEffect } from 'react';
import { BankSyncService, BankSyncCredentials } from '../services/bank-sync-service';

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
            const accounts = await BankSyncService.fetchAccounts();

            // Fetch balance for each for display
            const withBalances = await Promise.all(accounts.map(async (acc) => ({
                ...acc,
                balance: await BankSyncService.fetchBalance(acc.uid).catch(() => null)
            })));

            setAccountsWithBalances(withBalances);
            showToast({
                message: `Connessione riuscita! Trovati ${accounts.length} conti.`,
                type: 'success'
            });
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

                    {accountsWithBalances.length > 0 && (
                        <div className="mb-4">
                            <label className="text-xs font-bold uppercase opacity-60 block mb-2">Conti Collegati</label>
                            <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                                {accountsWithBalances.map((acc, i) => (
                                    <div key={i} className="flex justify-between items-center p-3 bg-black/20 rounded-xl border border-white/10">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-semibold truncate max-w-[150px]">{acc.account_id?.iban || acc.uid}</span>
                                            <span className="text-[10px] opacity-60 leading-none">{acc.display_name || 'Conto Bancario'}</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-sm font-bold text-emerald-400">
                                                {acc.balance !== null ? `€${acc.balance?.toFixed(2)}` : '---'}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

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
        .glass-modal {
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 24px;
          color: white;
          max-width: 90%;
          width: 500px;
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
