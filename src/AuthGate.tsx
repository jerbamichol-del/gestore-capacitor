import React, { useState, useEffect, useRef, useCallback } from 'react';
import App from './App';
import LoginScreen from './screens/LoginScreen';
import SetupScreen from './screens/SetupScreen';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen';
import ForgotPasswordSuccessScreen from './screens/ForgotPasswordSuccessScreen';
import ResetPinScreen from './screens/ResetPinScreen';
import { useLocalStorage } from './hooks/useLocalStorage';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { getUsers, saveUsers } from './utils/api';

type AuthView = 'login' | 'register' | 'forgotPassword' | 'forgotPasswordSuccess';
type ResetContext = { token: string; email: string; } | null;

const LOCK_TIMEOUT_MS = 30000; // 30 secondi

const AuthGate: React.FC = () => {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  // MODIFICA: Leggiamo qui l'utente attivo per passarlo come prop ad App
  const [lastActiveUser, setLastActiveUser] = useLocalStorage<string | null>('last_active_user_email', null);
  const [resetContext, setResetContext] = useState<ResetContext>(null);
  const hiddenTimestampRef = useRef<number | null>(null);
  const [emailForReset, setEmailForReset] = useState<string>('');

  const applyResetFromUrl = useCallback((url: string) => {
    try {
      const u = new URL(url);

      // Handle Password Reset (Pin Reset)
      const token = u.searchParams.get('resetToken');
      const email = u.searchParams.get('email');

      if (token && email) {
        setResetContext({ token, email });

        // Pulisce l'URL per evitare che il reset venga riattivato al refresh
        try {
          window.history.replaceState({}, document.title, window.location.pathname);
        } catch (e) {
          // Ignora errore su ambienti restrittivi
        }
      }
    } catch (e) {
      // URL non valido / non assoluto: ignora
    }
  }, []);

  // Controlla se esiste un database di utenti per decidere la schermata iniziale.
  const hasUsers = () => {
    try {
      const users = localStorage.getItem('users_db');
      return users !== null && users !== '{}';
    } catch (e) {
      return false;
    }
  };

  // Se non ci sono utenti, default su Register, ma permettiamo di cambiare
  const [authView, setAuthView] = useState<AuthView>(hasUsers() ? 'login' : 'register');

  // Handle reset link when running as PWA/web (query params on window.location)
  useEffect(() => {
    applyResetFromUrl(window.location.href);
  }, [applyResetFromUrl]);

  // Handle reset link when running as native app (Capacitor deep links)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    // 1) If app was cold-started by a deep link
    CapApp.getLaunchUrl().then((res) => {
      if (res?.url) applyResetFromUrl(res.url);
    }).catch(() => { });

    // 2) If app is already open and receives a deep link
    let handle: any = null;
    CapApp.addListener('appUrlOpen', (data) => {
      if (data?.url) applyResetFromUrl(data.url);
    }).then((h) => {
      handle = h;
    }).catch(() => { });

    return () => {
      try { handle?.remove?.(); } catch (e) { }
    };
  }, [applyResetFromUrl]);

  const handleAuthSuccess = (token: string, email: string) => {
    setSessionToken(token);
    setLastActiveUser(email.toLowerCase());
  };

  const handleResetSuccess = () => {
    setResetContext(null);
    setAuthView('login');
  };

  const handleLogout = useCallback(() => {
    setSessionToken(null);
    setLastActiveUser(null);
    setAuthView(hasUsers() ? 'login' : 'register');
  }, [setLastActiveUser]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (sessionToken) {
          hiddenTimestampRef.current = Date.now();
        }
      } else if (document.visibilityState === 'visible') {
        if (sessionStorage.getItem('preventAutoLock') === 'true') {
          sessionStorage.removeItem('preventAutoLock');
          hiddenTimestampRef.current = null;
          return;
        }

        if (sessionToken && hiddenTimestampRef.current) {
          const elapsed = Date.now() - hiddenTimestampRef.current;
          if (elapsed > LOCK_TIMEOUT_MS) {
            handleLogout();
          }
        }
        hiddenTimestampRef.current = null;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [sessionToken, handleLogout]);

  if (resetContext) {
    return (
      <ResetPinScreen
        email={resetContext.email}
        token={resetContext.token}
        onResetSuccess={handleResetSuccess}
      />
    );
  }

  if (sessionToken) {
    // MODIFICA: Passiamo currentEmail (lastActiveUser) ad App per il backup
    return <App
      onLogout={handleLogout}
      currentEmail={lastActiveUser || ''}
      onEmailChanged={(newEmail) => setLastActiveUser(newEmail)}
    />;
  }

  // MODIFICA: Rimosso il blocco if (!hasUsers()...) per permettere l'accesso al login anche se non ci sono utenti locali

  switch (authView) {
    case 'register':
      return <SetupScreen onSetupSuccess={handleAuthSuccess} onGoToLogin={() => setAuthView('login')} />;
    case 'forgotPassword':
      return <ForgotPasswordScreen
        onBackToLogin={() => setAuthView('login')}
        onRequestSent={(email) => {
          setEmailForReset(email);
          setAuthView('forgotPasswordSuccess');
        }}
      />;
    case 'forgotPasswordSuccess':
      return <ForgotPasswordSuccessScreen
        email={emailForReset}
        onBackToLogin={() => setAuthView('login')}
      />;
    case 'login':
    default:
      return (
        <LoginScreen
          onLoginSuccess={handleAuthSuccess}
          onGoToRegister={() => setAuthView('register')}
          onGoToForgotPassword={() => setAuthView('forgotPassword')}
          onGoToForgotEmail={() => setAuthView('forgotPassword')}
        />
      );
  }
};

export default AuthGate;
