import React, { useState, useEffect } from 'react';
import QRCode from "react-qr-code";
import { XMarkIcon } from './icons/XMarkIcon';

interface ShareQrModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ShareQrModal: React.FC<ShareQrModalProps> = ({ isOpen, onClose }) => {
  const [isAnimating, setIsAnimating] = useState(false);

  // URL APK da GitHub Releases (sempre l'ultima versione)
  const qrUrl = 'https://github.com/jerbamichol-del/gestore-capacitor/releases/latest/download/gestore-spese.apk';

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => setIsAnimating(true), 10);
      return () => clearTimeout(timer);
    } else {
      setIsAnimating(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-[6000] flex justify-center items-center p-4 transition-opacity duration-300 ease-in-out ${isAnimating ? 'opacity-100' : 'opacity-0'} bg-slate-900/60 backdrop-blur-sm`}
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className={`midnight-card rounded-lg shadow-xl w-full max-w-sm transform transition-all duration-300 ease-in-out ${isAnimating ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-6 border-b border-sunset-coral/20 dark:border-electric-violet/20">
          <h2 className="text-xl font-bold text-sunset-text dark:text-white">Scarica App Nativa</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-white p-1 rounded-full hover:bg-sunset-peach/50 dark:hover:bg-midnight-card">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="p-8 flex flex-col items-center justify-center space-y-6">
          <div className="p-4 midnight-card border-2 border-sunset-coral/20 dark:border-electric-violet/20 rounded-xl shadow-sm">
            <QRCode
              value={qrUrl}
              size={200}
              style={{ height: "auto", maxWidth: "100%", width: "100%" }}
              viewBox={`0 0 256 256`}
            />
          </div>

          <div className="text-center space-y-2">
            <p className="text-slate-800 dark:text-slate-200 font-semibold text-sm">
              📥 Scarica l'app nativa Android
            </p>
            <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed">
              Scansiona per scaricare l'APK.<br />
              <span className="text-slate-500">Abilita "Installa da fonti sconosciute" se richiesto.</span>
            </p>
          </div>

          {/* Link diretto sotto il QR */}
          <div className="w-full pt-4 border-t border-slate-100 dark:border-slate-800">
            <a
              href={qrUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full py-2.5 px-4 bg-sunset-cream/60 dark:bg-midnight-card/50 hover:bg-sunset-peach/50 dark:hover:bg-midnight-card text-sunset-text dark:text-slate-200 text-center text-sm font-medium rounded-lg transition-colors border border-sunset-coral/10 dark:border-electric-violet/10"
            >
              📥 Download APK
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShareQrModal;
