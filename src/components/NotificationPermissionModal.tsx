// src/components/NotificationPermissionModal.tsx

import React from 'react';
import { createPortal } from 'react-dom';

interface NotificationPermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEnableClick: () => Promise<void> | void;
  isEnabled: boolean; // NEW: to show success state
}

export function NotificationPermissionModal({
  isOpen,
  onClose,
  onEnableClick,
  isEnabled,
}: NotificationPermissionModalProps) {
  if (!isOpen) return null;

  const handleEnableClick = async () => {
    await onEnableClick();
  };

  const content = isEnabled ? (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black bg-opacity-60 transition-colors overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full my-8 transition-colors">
        {/* Success Header */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 dark:from-green-700 dark:to-emerald-700 px-4 py-3 transition-colors">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center flex-shrink-0 transition-colors">
              <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-white leading-tight">
                Notifiche Abilitate!
              </h2>
              <p className="text-green-100 text-xs">Rilevamento attivo</p>
            </div>
          </div>
        </div>

        {/* Success Content */}
        <div className="px-4 py-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center flex-shrink-0 transition-colors">
              <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-gray-700 dark:text-gray-200 text-sm leading-relaxed mb-2 transition-colors">
                <strong>Perfetto!</strong> Il rilevamento automatico delle transazioni è ora attivo.
              </p>
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed transition-colors">
                Quando riceverai una notifica bancaria, ti verrà chiesto se vuoi aggiungere la transazione.
              </p>
            </div>
          </div>

          {/* What happens next */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 transition-colors">
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <p className="text-xs font-semibold text-blue-900 dark:text-blue-200 mb-1 transition-colors">Cosa succede ora:</p>
                <ul className="text-xs text-blue-800 dark:text-blue-300 space-y-0.5 list-disc list-inside transition-colors">
                  <li>L'app monitora le notifiche bancarie</li>
                  <li>Rileva automaticamente importo e descrizione</li>
                  <li>Ti chiede conferma prima di salvare</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Close button */}
        <div className="px-4 pb-4">
          <button
            onClick={onClose}
            className="w-full px-3 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white text-sm font-semibold rounded-lg shadow-lg transition-all"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  ) : (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black bg-opacity-60 transition-colors overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full my-8 max-h-[85vh] flex flex-col transition-colors">
        {/* Header - Fixed */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-700 px-4 py-3 flex-shrink-0 transition-colors">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center flex-shrink-0 transition-colors">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-white leading-tight">
                Rilevamento Automatico
              </h2>
              <p className="text-blue-100 text-xs">Transazioni bancarie</p>
            </div>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="px-4 py-4 overflow-y-auto flex-1">
          {/* Feature Description */}
          <p className="text-gray-700 dark:text-gray-200 text-sm leading-relaxed mb-3 transition-colors">
            <strong>Rileva automaticamente</strong> le transazioni dalle notifiche bancarie e ti permette di aggiungerle con un clic.
          </p>

          {/* Banks */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-3 transition-colors">
            <p className="text-xs font-semibold text-blue-900 dark:text-blue-200 mb-2 transition-colors">Banche Supportate:</p>
            <div className="grid grid-cols-2 gap-1.5 text-xs text-blue-800 dark:text-blue-300 transition-colors">
              <div className="flex items-center gap-1.5">
                <span className="w-1 h-1 bg-blue-600 dark:bg-blue-500 rounded-full"></span>
                Revolut
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1 h-1 bg-blue-600 dark:bg-blue-500 rounded-full"></span>
                PayPal
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1 h-1 bg-blue-600 dark:bg-blue-500 rounded-full"></span>
                Postepay
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1 h-1 bg-blue-600 dark:bg-blue-500 rounded-full"></span>
                BBVA
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1 h-1 bg-blue-600 dark:bg-blue-500 rounded-full"></span>
                Intesa
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1 h-1 bg-blue-600 dark:bg-blue-500 rounded-full"></span>
                BNL
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1 h-1 bg-blue-600 dark:bg-blue-500 rounded-full"></span>
                UniCredit
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-3 transition-colors">
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <p className="text-xs font-semibold text-amber-900 dark:text-amber-200 mb-1.5 transition-colors">Come Abilitare:</p>
                <ol className="text-xs text-amber-800 dark:text-amber-300 space-y-1 list-decimal list-inside transition-colors">
                  <li>Clicca <strong>"Abilita"</strong> qui sotto</li>
                  <li>Si aprirà <strong>Impostazioni Android</strong></li>
                  <li>Cerca <strong>"Accesso alle notifiche"</strong></li>
                  <li>Trova <strong>"Gestore Spese"</strong></li>
                  <li>Attiva l'interruttore</li>
                  <li>Torna all'app con il pulsante Indietro</li>
                  <li>✅ Attendi 3 secondi e vedrai il messaggio di successo!</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Privacy */}
          <div className="flex items-start gap-1.5 text-xs text-gray-600 dark:text-gray-400 transition-colors">
            <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            <p>
              <strong>Privacy:</strong> Le notifiche restano solo sul tuo dispositivo. Nessun dato online.
            </p>
          </div>
        </div>

        {/* Actions - Fixed Footer */}
        <div className="px-4 pb-4 pt-2 flex-shrink-0 border-t border-gray-100 dark:border-slate-800 transition-colors">
          <div className="flex gap-2 mb-2">
            <button
              onClick={onClose}
              className="flex-1 px-3 py-2.5 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 text-sm font-semibold rounded-lg transition-colors"
            >
              Non ora
            </button>
            <button
              onClick={handleEnableClick}
              className="flex-1 px-3 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-semibold rounded-lg shadow-lg transition-all"
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
            className="w-full text-xs text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-400 underline py-1 transition-colors"
          >
            Non mostrare più
          </button>
        </div>
      </div>
    </div>
  );

  // Render as a portal to avoid stacking-context issues (filters/overlays covering the modal)
  const portalTarget = typeof document !== 'undefined' ? document.body : null;
  return portalTarget ? createPortal(content, portalTarget) : content;
}
