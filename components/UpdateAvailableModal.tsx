import React, { useState } from 'react';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Browser } from '@capacitor/browser';
import { UpdateInfo } from '../hooks/useUpdateChecker';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { XMarkIcon } from './icons/XMarkIcon';

interface UpdateAvailableModalProps {
  isOpen: boolean;
  updateInfo: UpdateInfo;
  onClose: () => void;
  onSkip: () => void;
}

const UpdateAvailableModal: React.FC<UpdateAvailableModalProps> = ({
  isOpen,
  updateInfo,
  onClose,
  onSkip,
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !updateInfo.available) return null;

  const handleDownloadAndInstall = async () => {
    if (!updateInfo.downloadUrl) {
      setError('URL download non disponibile');
      return;
    }

    setIsDownloading(true);
    setError(null);

    try {
      // Open APK download in browser - Android will handle installation
      await Browser.open({ 
        url: updateInfo.downloadUrl,
        presentationStyle: 'popover'
      });

      // Alternative: Download with Filesystem (more complex, requires file opener)
      // const fileName = `gestore-spese-${updateInfo.latestVersion}.apk`;
      // 
      // const response = await fetch(updateInfo.downloadUrl);
      // const blob = await response.blob();
      // const base64 = await blobToBase64(blob);
      //
      // const result = await Filesystem.writeFile({
      //   path: fileName,
      //   data: base64,
      //   directory: Directory.Documents,
      // });
      //
      // Then use FileOpener plugin to open the APK

      // Close modal after initiating download
      setTimeout(() => {
        onClose();
        setIsDownloading(false);
      }, 1000);
    } catch (err) {
      console.error('Download failed:', err);
      setError('Errore durante il download. Riprova.');
      setIsDownloading(false);
    }
  };

  const handleSkip = () => {
    // Mark as skipped for 24h
    localStorage.setItem('update_skipped_until', (Date.now() + 24 * 60 * 60 * 1000).toString());
    onSkip();
  };

  return (
    <div 
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isDownloading) handleSkip();
      }}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 text-white relative">
          {!isDownloading && (
            <button
              onClick={handleSkip}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors"
              aria-label="Chiudi"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          )}
          <div className="text-5xl mb-2">🎉</div>
          <h2 className="text-2xl font-bold mb-1">Aggiornamento Disponibile!</h2>
          <p className="text-indigo-100 text-sm">
            Versione {updateInfo.latestVersion || 'nuova'}
          </p>
        </div>

        {/* Body */}
        <div className="p-6">
          <div className="mb-4">
            <p className="text-slate-700 mb-2">
              🔥 <strong>Novità:</strong>
            </p>
            {updateInfo.releaseNotes ? (
              <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-600 max-h-40 overflow-y-auto">
                {updateInfo.releaseNotes.split('\n').map((line, i) => (
                  <p key={i} className="mb-1">{line}</p>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-sm italic">Miglioramenti e correzioni bug</p>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <p className="text-xs text-blue-800">
              💡 <strong>Nota:</strong> L'app si aggiornerà automaticamente dopo il download.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleSkip}
              disabled={isDownloading}
              className="flex-1 px-4 py-3 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Più tardi
            </button>
            <button
              onClick={handleDownloadAndInstall}
              disabled={isDownloading}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg font-semibold hover:from-indigo-600 hover:to-purple-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isDownloading ? (
                <>
                  <SpinnerIcon className="w-5 h-5" />
                  Download...
                </>
              ) : (
                'Aggiorna Ora'
              )}
            </button>
          </div>

          {isDownloading && downloadProgress > 0 && (
            <div className="mt-4">
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-indigo-500 to-purple-600 h-full transition-all duration-300"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 mt-1 text-center">
                {downloadProgress}% completato
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UpdateAvailableModal;
