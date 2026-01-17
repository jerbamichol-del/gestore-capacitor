import React from 'react';
import ReactDOM from 'react-dom/client';
import AuthGate from './AuthGate';
import { ThemeProvider } from './hooks/useTheme';
// NESSUN import './index.css' qui se usi il CDN in HTML

import { Capacitor } from '@capacitor/core';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthGate />
    </ThemeProvider>
  </React.StrictMode>
);

// --- GESTIONE SERVICE WORKER ---
if ('serviceWorker' in navigator) {
  if (Capacitor.isNativePlatform()) {
    // Se siamo su piattaforma nativa, disinstalliamo eventuali SW rimasti incastrati
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister();
        console.log('🗑️ SW rimosso su piattaforma nativa');
      }
    });

    // Pulizia cache per sicurezza (opzionale ma consigliata)
    if (window.caches) {
      caches.keys().then((names) => {
        for (const name of names) {
          caches.delete(name);
        }
      });
    }
  } else {
    // Solo su Web registriamo il SW
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js')
        .then((registration) => {
          console.log('✅ SW Registrato con successo (Web):', registration.scope);
          if (registration.waiting) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
        })
        .catch((error) => {
          console.error('❌ Registrazione SW fallita:', error);
        });

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });
    });
  }
}
