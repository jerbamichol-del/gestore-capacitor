import React from 'react';
import ReactDOM from 'react-dom/client';
import AuthGate from './AuthGate'; // AuthGate renders App
import './index.css';
import { TransactionsProvider } from './context/TransactionsContext';
import { UIProvider } from './context/UIContext';
import { ThemeProvider } from './context/ThemeContext';
import { BrowserRouter } from 'react-router-dom';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <TransactionsProvider>
          <UIProvider>
            <AuthGate />
          </UIProvider>
        </TransactionsProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);

// --- REGISTRAZIONE SERVICE WORKER ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .then((registration) => {
        console.log('✅ SW Registrato con successo:', registration.scope);

        // Se c'è un aggiornamento in attesa, forza l'update
        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      })
      .catch((error) => {
        console.error('❌ Registrazione SW fallita:', error);
      });

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // Ricarica la pagina quando il nuovo SW prende il controllo
      window.location.reload();
    });
  });
}
