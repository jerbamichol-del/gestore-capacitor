// src/components/NotificationPermissionModal.tsx

import React from 'react';

interface NotificationPermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEnableClick: () => void;
}

export function NotificationPermissionModal({
  isOpen,
  onClose,
  onEnableClick,
}: NotificationPermissionModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center">
              <svg className="w-7 h-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                Rilevamento Automatico Transazioni
              </h2>
              <p className="text-blue-100 text-sm">Gestione spese semplificata</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          {/* Feature Description */}
          <div className="mb-5">
            <p className="text-gray-700 leading-relaxed mb-4">
              <strong>Rileva automaticamente</strong> le transazioni dalle notifiche delle tue app bancarie e ti permette di aggiungerle con un clic.
            </p>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-sm font-semibold text-blue-900 mb-2">Banche Supportate:</p>
              <div className="grid grid-cols-2 gap-2 text-sm text-blue-800">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
                  Revolut
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
                  PayPal
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
                  Postepay
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
                  BBVA
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
                  Intesa Sanpaolo
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
                  BNL
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
                  UniCredit
                </div>
              </div>
            </div>
          </div>

          {/* Setup Instructions */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-5">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-amber-900 mb-2">Come Abilitare:</p>
                <ol className="text-sm text-amber-800 space-y-2 list-decimal list-inside">
                  <li><strong>Clicca "Abilita"</strong> qui sotto</li>
                  <li>Si aprirà la schermata <strong>Impostazioni Android</strong></li>
                  <li>Cerca <strong>"Accesso alle notifiche"</strong> o <strong>"Notifiche"</strong></li>
                  <li>Trova <strong>"Gestore Spese"</strong> nella lista</li>
                  <li>Attiva l'interruttore</li>
                  <li>Torna all'app</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Privacy Note */}
          <div className="flex items-start gap-2 text-xs text-gray-600 mb-5">
            <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            <p>
              <strong>Privacy:</strong> Le notifiche restano solo sul tuo dispositivo. Nessun dato viene inviato online.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition-colors"
            >
              Non ora
            </button>
            <button
              onClick={() => {
                onEnableClick();
                onClose();
              }}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-lg shadow-lg transition-all"
            >
              Abilita Ora
            </button>
          </div>

          {/* Dismiss forever */}
          <button
            onClick={() => {
              localStorage.setItem('notification_permission_dismissed_forever', 'true');
              onClose();
            }}
            className="w-full mt-3 text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Non mostrare più
          </button>
        </div>
      </div>
    </div>
  );
}
