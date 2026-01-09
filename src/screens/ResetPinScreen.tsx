import React, { useState } from 'react';
import { resetPin } from '../utils/api';

type ResetPinScreenProps = {
  email: string;
  token: string;
  onResetSuccess: () => void;
};

const ResetPinScreen: React.FC<ResetPinScreenProps> = ({
  email,
  token,
  onResetSuccess,
}) => {
  const [step, setStep] = useState<'new_pin' | 'confirm_pin'>('new_pin');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const normalizedEmail = (email || '').trim().toLowerCase();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanPin = pin.trim();
    const cleanConfirm = confirmPin.trim();

    if (!/^\d{4}$/.test(cleanPin)) {
      setError('Inserisci un PIN di 4 cifre.');
      return;
    }

    if (step === 'new_pin') {
      // Prima fase: chiediamo solo il nuovo PIN, poi passiamo alla conferma
      setStep('confirm_pin');
      return;
    }

    // step === 'confirm_pin'
    if (cleanPin !== cleanConfirm) {
      setError('I PIN non coincidono. Riprova.');
      return;
    }

    if (!normalizedEmail) {
      setError('Email non valida nel link. Richiedi di nuovo il reset.');
      return;
    }

    try {
      setIsLoading(true);
      const res = await resetPin(normalizedEmail, token || '', cleanPin);
      setIsLoading(false);

      if (!res.success) {
        setError(res.message || 'Errore durante il reset del PIN.');
        return;
      }

      setSuccessMessage('PIN aggiornato con successo.');
      // Mostra il messaggio per un attimo, poi torna al login
      setTimeout(() => {
        onResetSuccess();
      }, 800);
    } catch (err) {
      console.error('[ResetPin] Errore inatteso:', err);
      setIsLoading(false);
      setError('Errore imprevisto durante il reset del PIN.');
    }
  };

  const title =
    step === 'new_pin' ? 'Imposta un nuovo PIN' : 'Conferma il nuovo PIN';

  const description =
    step === 'new_pin'
      ? `Stai reimpostando il PIN per l’account ${normalizedEmail || email}. Scegli un nuovo PIN a 4 cifre.`
      : 'Reinserisci il nuovo PIN per conferma.';

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex items-center justify-center px-4 transition-colors">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-lg p-6 transition-colors">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2 transition-colors">{title}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 transition-colors">{description}</p>

        <p className="text-xs text-slate-400 dark:text-slate-500 mb-6 break-all transition-colors">
          Email: <span className="font-mono text-slate-700 dark:text-slate-300">{normalizedEmail || '(sconosciuta)'}</span>
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {step === 'new_pin' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 transition-colors">
                Nuovo PIN (4 cifre)
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={(e) =>
                  setPin(e.target.value.replace(/\D/g, '').slice(0, 4))
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-center tracking-[0.5em] text-lg transition-colors"
                autoFocus
              />
            </div>
          )}

          {step === 'confirm_pin' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 transition-colors">
                  Nuovo PIN (4 cifre)
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={pin}
                  onChange={(e) =>
                    setPin(e.target.value.replace(/\D/g, '').slice(0, 4))
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-center tracking-[0.5em] text-lg transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 transition-colors">
                  Conferma PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={confirmPin}
                  onChange={(e) =>
                    setConfirmPin(
                      e.target.value.replace(/\D/g, '').slice(0, 4)
                    )
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-center tracking-[0.5em] text-lg transition-colors"
                  autoFocus
                />
              </div>
            </>
          )}

          {error && (
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50 rounded-xl px-3 py-2 transition-colors">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/50 rounded-xl px-3 py-2 transition-colors">
              {successMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full inline-flex items-center justify-center px-4 py-2.5 border border-transparent text-sm font-bold rounded-xl shadow-md text-white bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading
              ? 'Salvataggio...'
              : step === 'new_pin'
                ? 'Continua'
                : 'Salva PIN'}
          </button>

          <button
            type="button"
            onClick={onResetSuccess}
            disabled={isLoading}
            className="w-full text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 mt-2 transition-colors"
          >
            Annulla e torna al login
          </button>
        </form>
      </div>
    </div>
  );
};

export default ResetPinScreen;