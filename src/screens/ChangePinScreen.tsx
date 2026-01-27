// src/screens/ChangePinScreen.tsx
import React, { useEffect, useState } from 'react';
import AuthLayout from '../components/auth/AuthLayout';
import PinInput from '../components/auth/PinInput';
import { getUsers, saveUsers } from '../utils/api';
import { hashPinWithSalt, verifyPin } from '../utils/auth';
import { SpinnerIcon } from '../components/icons/SpinnerIcon';

interface ChangePinScreenProps {
  email: string;                 // email dell'utente loggato
  onSuccess: () => void;         // callback al termine (es. torna a Impostazioni/Login)
  onCancel?: () => void;         // opzionale: torna indietro senza salvare
}

type Step = 'current' | 'new' | 'confirm';

const ChangePinScreen: React.FC<ChangePinScreenProps> = ({ email, onSuccess, onCancel }) => {
  const [step, setStep] = useState<Step>('current');
  const [isSuccess, setIsSuccess] = useState(false);

  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const normalizedEmail = email.trim().toLowerCase();

  // avanzamento step automatico in base alla lunghezza PIN
  useEffect(() => {
    if (step === 'current' && currentPin.length === 4) {
      void checkCurrentThenNext();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPin, step]);

  useEffect(() => {
    if (step === 'new' && newPin.length === 4) {
      setStep('confirm');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newPin, step]);

  useEffect(() => {
    if (step === 'confirm' && confirmPin.length === 4) {
      if (newPin !== confirmPin) {
        fail('I PIN non corrispondono. Riprova.');
        resetTo('new');
        return;
      }
      if (currentPin === newPin) {
        fail('Il nuovo PIN non può essere uguale al PIN attuale.');
        resetTo('new');
        return;
      }
      void saveNewPin();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmPin, step]);

  const fail = (msg: string) => {
    setError(msg);
    setInfo(null);
  };
  const note = (msg: string) => {
    setInfo(msg);
    setError(null);
  };

  const resetTo = (to: Step) => {
    if (to === 'current') {
      setCurrentPin('');
    }
    if (to !== 'new') setNewPin('');
    setConfirmPin('');
    setStep(to);
  };

  const checkCurrentThenNext = async () => {
    setLoading(true);
    setError(null);
    try {
      const users = getUsers();
      const u = users[normalizedEmail];
      if (!u) {
        fail('Utente non trovato sul dispositivo.');
        resetTo('current');
        return;
      }
      const ok = await verifyPin(currentPin, u.pinHash, u.pinSalt);
      if (!ok) {
        fail('PIN attuale errato.');
        resetTo('current');
        return;
      }
      setStep('new');
      setInfo(null);
      setError(null);
    } catch {
      fail('Errore nella verifica del PIN attuale.');
      resetTo('current');
    } finally {
      setLoading(false);
    }
  };

  const saveNewPin = async () => {
    setLoading(true);
    setError(null);
    try {
      const users = getUsers();
      const u = users[normalizedEmail];
      if (!u) {
        fail('Utente non trovato sul dispositivo.');
        resetTo('current');
        return;
      }
      const { hash, salt } = await hashPinWithSalt(newPin);
      u.pinHash = hash;
      u.pinSalt = salt;
      users[normalizedEmail] = u;
      saveUsers(users);

      setIsSuccess(true);
    } catch {
      fail('Errore durante il salvataggio del nuovo PIN.');
      resetTo('new');
    } finally {
      setLoading(false);
    }
  };

  const headline =
    step === 'current'
      ? 'Inserisci il PIN attuale'
      : step === 'new'
        ? 'Nuovo PIN'
        : 'Conferma nuovo PIN';

  const hint =
    step === 'current'
      ? 'Per continuare, verifica il PIN attuale.'
      : step === 'new'
        ? 'Scegli un nuovo PIN di 4 cifre.'
        : 'Reinserisci il nuovo PIN.';

  const pinValue = step === 'current' ? currentPin : step === 'new' ? newPin : confirmPin;
  const setPin =
    step === 'current' ? setCurrentPin : step === 'new' ? setNewPin : setConfirmPin;

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

          <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">PIN Aggiornato!</h2>
          <p className="text-slate-500 dark:text-slate-400 mb-8">
            Il tuo PIN di accesso è stato modificato con successo.<br />
            Usalo al prossimo accesso.
          </p>

          <button
            onClick={() => onSuccess()}
            className="w-full py-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-all shadow-lg shadow-indigo-500/30"
          >
            Finito
          </button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="text-center">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">{headline}</h2>

        <p
          className={`min-h-[2.5rem] text-sm flex items-center justify-center ${error ? 'text-red-500' : 'text-slate-500 dark:text-slate-400'
            }`}
        >
          {error || info || hint}
        </p>

        {loading ? (
          <div className="min-h-[220px] flex flex-col items-center justify-center">
            <SpinnerIcon className="w-12 h-12 text-indigo-600 animate-spin" />
            <p className="mt-3 text-slate-500 dark:text-slate-400">Attendere…</p>
          </div>
        ) : (
          <div className="mt-2">
            <PinInput pin={pinValue} onPinChange={setPin} />
          </div>
        )}

        <div className="mt-8 grid grid-cols-2 gap-3">
          <button
            onClick={() => (onCancel ? onCancel() : onSuccess())}
            className="px-4 py-3 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
          >
            Annulla
          </button>
          <button
            onClick={() => {
              if (step === 'current' && currentPin.length === 4) {
                void checkCurrentThenNext();
              } else if (step === 'new' && newPin.length === 4) {
                setStep('confirm');
              } else if (step === 'confirm' && confirmPin.length === 4) {
                void saveNewPin();
              }
            }}
            className="px-4 py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20 disabled:opacity-50"
            disabled={
              loading ||
              (step === 'current' && currentPin.length < 4) ||
              (step === 'new' && newPin.length < 4) ||
              (step === 'confirm' && confirmPin.length < 4)
            }
          >
            {step === 'confirm' ? 'Conferma' : 'Continua'}
          </button>
        </div>
      </div>
    </AuthLayout>
  );
};

export default ChangePinScreen;
