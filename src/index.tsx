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
    // Se siamo su piattaforma nativa, pulizia approfondita e loggata
    (async () => {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        if (registrations.length > 0) {
          await Promise.all(
            registrations.map(async (reg) => {
              const success = await reg.unregister();
              console.log(`🗑️ SW unregister: ${success ? '✅ Success' : '❌ Failed'} (${reg.scope})`);
            })
          );
        }

        if (window.caches) {
          const names = await caches.keys();
          if (names.length > 0) {
            await Promise.all(
              names.map(async (name) => {
                const success = await caches.delete(name);
                console.log(`🧹 Cache delete: ${success ? '✅ Success' : '❌ Failed'} (${name})`);
              })
            );
          }
        }
      } catch (err) {
        console.error('❌ Errore durante cleanup SW/Cache native:', err);
      }
    })();
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
