// src/screens/ChangeEmailScreen.tsx
import React, { useState } from 'react';
import AuthLayout from '../components/auth/AuthLayout';
import { EnvelopeIcon } from '../components/icons/EnvelopeIcon';
import { getUsers, sendEmailChangeVerification } from '../utils/api';
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

            // Genera token di verifica
            const token = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);

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

    if (isWaitingForVerification) {
        return (
            <AuthLayout>
                <div className="text-center">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4">Verifica Email Inviata</h2>

                    <div className="mb-6 flex justify-center">
                        <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-600 dark:text-green-400">
                            <EnvelopeIcon className="w-8 h-8" />
                        </div>
                    </div>

                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                        Abbiamo inviato un link di conferma a <strong>{newEmail}</strong>.<br /><br />
                        Clicca il link nell'email per completare il cambio.
                    </p>

                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-6 py-3 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                    >
                        Chiudi
                    </button>
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
                            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="nome@esempio.com"
                            required
                        />
                    </div>

                    {error && <p className="text-sm text-red-500 text-center">{error}</p>}

                    <div className="grid grid-cols-2 gap-3 mt-6">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="px-4 py-2.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                        >
                            Annulla
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
                        >
                            {loading && <SpinnerIcon className="w-4 h-4 animate-spin" />}
                            <span>Salva</span>
                        </button>
                    </div>
                </form>
            </div>
        </AuthLayout>
    );
};

export default ChangeEmailScreen;
