// src/screens/ChangeEmailScreen.tsx
import React, { useState } from 'react';
import AuthLayout from '../components/auth/AuthLayout';
import { EnvelopeIcon } from '../components/icons/EnvelopeIcon';
import { getUsers, saveUsers, sendEmailChangeVerification } from '../utils/api';
import { SpinnerIcon } from '../components/icons/SpinnerIcon';

interface ChangeEmailScreenProps {
    currentEmail: string;
    onSuccess: (newEmail: string) => void;
    onCancel: () => void;
}

const ChangeEmailScreen: React.FC<ChangeEmailScreenProps> = ({ currentEmail, onSuccess, onCancel }) => {
    const [newEmail, setNewEmail] = useState('');
    const [confirmEmail, setConfirmEmail] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const [isWaitingForVerification, setIsWaitingForVerification] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [verificationCode, setVerificationCode] = useState('');
    const [verifyError, setVerifyError] = useState<string | null>(null);

    const handleVerifyCode = async (e: React.FormEvent) => {
        e.preventDefault();
        setVerifyError(null);

        const pendingRaw = localStorage.getItem('pending_email_change');
        if (!pendingRaw) {
            setVerifyError("Richiesta scaduta o non trovata.");
            return;
        }

        const pending = JSON.parse(pendingRaw);
        if (pending.token !== verificationCode.trim()) {
            setVerifyError("Codice errato.");
            return;
        }

        // Apply Change
        try {
            const users = getUsers();
            const normalizedCurrentEmail = currentEmail.trim().toLowerCase();
            const newEmailFinal = pending.newEmail;

            // Rileggiamo utente corrente per sicurezza
            if (!users[normalizedCurrentEmail]) {
                setVerifyError("Utente originale non trovato. Riprova.");
                return;
            }

            const userData = { ...users[normalizedCurrentEmail] };
            userData.email = newEmailFinal;

            users[newEmailFinal] = userData;
            delete users[normalizedCurrentEmail];

            saveUsers(users);
            localStorage.removeItem('pending_email_change');

            // Mostra successo invece di chiamare subito onSuccess
            setIsSuccess(true);
        } catch (err) {
            console.error(err);
            setVerifyError("Errore durante il salvataggio.");
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(newEmail)) {
            setError('Inserisci un indirizzo email valido.');
            return;
        }

        if (newEmail !== confirmEmail) {
            setError('Gli indirizzi email non corrispondono.');
            return;
        }

        if (newEmail.trim().toLowerCase() === currentEmail.trim().toLowerCase()) {
            setError('La nuova email deve essere diversa da quella attuale.');
            return;
        }

        setLoading(true);

        try {
            const users = getUsers();
            const normalizedNewEmail = newEmail.trim().toLowerCase();

            if (users[normalizedNewEmail]) {
                setError('Questa email è già registrata.');
                setLoading(false);
                return;
            }

            // Genera codice OTP numerico a 5 cifre
            const token = Math.floor(10000 + Math.random() * 90000).toString();

            // Salva richiesta pendente
            const pendingChange = {
                newEmail: normalizedNewEmail,
                token: token,
                timestamp: Date.now()
            };
            localStorage.setItem('pending_email_change', JSON.stringify(pendingChange));

            // Invia email via Apps Script (fire-and-forget)
            await sendEmailChangeVerification(normalizedNewEmail, token);

            setLoading(false);
            setIsWaitingForVerification(true);

        } catch (err) {
            console.error(err);
            setError('Si è verificato un errore.');
            setLoading(false);
        }
    };

    if (isSuccess) {
        return (
            <AuthLayout>
                <div className="text-center">
                    <div className="mb-6 flex justify-center">
                        <div className="w-20 h-20 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center text-green-600 dark:text-green-400">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-10 h-10">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                            </svg>
                        </div>
                    </div>

                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Email Cambiata!</h2>
                    <p className="text-slate-500 dark:text-slate-400 mb-8">
                        Il tuo indirizzo email è stato aggiornato correttamente.<br />
                        Usa la nuova email per i prossimi accessi.
                    </p>

                    <button
                        onClick={() => onSuccess(newEmail.toLowerCase())}
                        className="w-full py-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-all shadow-lg shadow-indigo-500/30"
                    >
                        Finito
                    </button>
                </div>
            </AuthLayout>
        );
    }

    if (isWaitingForVerification) {
        return (
            <AuthLayout>
                <div className="text-center">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4">Verifica Email</h2>

                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                        Abbiamo inviato un codice a <strong>{newEmail}</strong>.<br />
                        Inseriscilo qui sotto per confermare.
                    </p>

                    <form onSubmit={handleVerifyCode} className="space-y-4">
                        <div className="flex justify-center">
                            <input
                                type="text"
                                inputMode="numeric"
                                maxLength={5}
                                value={verificationCode}
                                onChange={(e) => setVerificationCode(e.target.value)}
                                className="w-40 text-center text-2xl tracking-widest px-4 py-3 rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-white dark:bg-midnight-card focus:outline-none focus:ring-4 focus:ring-indigo-500/20 font-mono font-bold text-slate-800 dark:text-white"
                                placeholder="00000"
                                autoFocus
                            />
                        </div>

                        {verifyError && <p className="text-red-500 text-sm font-medium">{verifyError}</p>}

                        <div className="grid grid-cols-2 gap-3 mt-6">
                            <button
                                type="button"
                                onClick={onCancel} // Chiude tutto
                                className="px-4 py-3 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                            >
                                Annulla
                            </button>
                            <button
                                type="submit"
                                className="px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-colors shadow-lg shadow-indigo-500/30"
                            >
                                Conferma
                            </button>
                        </div>
                    </form>
                </div>
            </AuthLayout>
        );
    }

    return (
        <AuthLayout>
            <div className="text-center">
                <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4">Cambia Email</h2>

                <div className="mb-6 flex justify-center">
                    <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                        <EnvelopeIcon className="w-8 h-8" />
                    </div>
                </div>

                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                    Inserisci il nuovo indirizzo email per il tuo account.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4 text-left">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nuova Email</label>
                        <input
                            type="email"
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="nome@esempio.com"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Conferma Email</label>
                        <input
                            type="email"
                            value={confirmEmail}
                            onChange={(e) => setConfirmEmail(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="nome@esempio.com"
                            required
                        />
                    </div>

                    {error && <p className="text-sm text-red-500 text-center">{error}</p>}

                    <div className="grid grid-cols-2 gap-3 mt-6">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="px-4 py-3 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                        >
                            Annulla
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-70 shadow-lg shadow-indigo-500/20"
                        >
                            {loading && <SpinnerIcon className="w-4 h-4 animate-spin" />}
                            <span>Invia Codice</span>
                        </button>
                    </div>
                </form>
            </div>
        </AuthLayout>
    );
};

export default ChangeEmailScreen;
