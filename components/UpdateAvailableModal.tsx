import React, { useEffect, useRef, useState } from 'react';
import { registerPlugin } from '@capacitor/core';
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

interface AppUpdatePlugin {
  downloadAndInstall(options: {
    url: string;
    fileName?: string;
    title?: string;
    description?: string;
  }): Promise<{ downloadId?: number; status?: string }>;

  getDownloadProgress(options: { downloadId: number }): Promise<{
    progress?: number;
    status?: string;
    bytesDownloaded?: number;
    bytesTotal?: number;
  }>;
}

const AppUpdate = registerPlugin<AppUpdatePlugin>('AppUpdate');

const UpdateAvailableModal: React.FC<UpdateAvailableModalProps> = ({
  isOpen,
  updateInfo,
  onClose,
  onSkip,
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, []);

  if (!isOpen || !updateInfo.available) return null;

  const handleDownloadAndInstall = async () => {
    if (!updateInfo.downloadUrl) {
      setError('URL download non disponibile');
      return;
    }

    setIsDownloading(true);
    setDownloadProgress(0);
    setError(null);

    const fileName = `gestore-spese-${updateInfo.latestBuild || updateInfo.latestVersion || 'latest'}.apk`;

    try {
      const res = await AppUpdate.downloadAndInstall({
        url: updateInfo.downloadUrl,
        fileName,
        title: 'Aggiornamento disponibile',
        description: 'Download in corso...',
      });

      const downloadId = res?.downloadId;

      // Poll progress if we got a downloadId
      if (downloadId && typeof downloadId === 'number') {
        pollRef.current = window.setInterval(async () => {
          try {
            const p = await AppUpdate.getDownloadProgress({ downloadId });
            const progress = typeof p?.progress === 'number' ? p.progress : 0;
            setDownloadProgress(progress);

            const status = p?.status;
            if (status === 'successful') {
              if (pollRef.current) {
                window.clearInterval(pollRef.current);
                pollRef.current = null;
              }
              setTimeout(() => {
                setIsDownloading(false);
                onClose();
              }, 800);
            }

            if (status === 'failed') {
              if (pollRef.current) {
                window.clearInterval(pollRef.current);
                pollRef.current = null;
              }
              setIsDownloading(false);
              setError('Download fallito. Riprova.');
            }
          } catch {
            // Ignore transient polling errors
          }
        }, 800);
      } else {
        // No downloadId: close shortly after starting (download continues in background)
        setTimeout(() => {
          setIsDownloading(false);
          onClose();
        }, 800);
      }

    } catch (err) {
      // Fallback: open in browser
      try {
        await Browser.open({ url: updateInfo.downloadUrl, presentationStyle: 'popover' });
        setTimeout(() => {
          setIsDownloading(false);
          onClose();
        }, 800);
      } catch {
        console.error('Update download failed:', err);
        setError('Errore durante il download. Riprova.');
        setIsDownloading(false);
      }
    }
  };

  const handleSkip = () => {
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
          <p className="text-indigo-100 text-sm">Versione {updateInfo.latestVersion || 'nuova'}</p>
        </div>

        {/* Body */}
        <div className="p-6">
          <div className="mb-4">
            <p className="text-slate-700 mb-2">🔥 <strong>Novità:</strong></p>
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
            <p className="text-xs text-blue-800">💡 <strong>Nota:</strong> Alla fine del download riceverai una notifica: toccala per installare.</p>
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

          {isDownloading && (
            <div className="mt-4">
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-indigo-500 to-purple-600 h-full transition-all duration-300"
                  style={{ width: `${Math.max(0, Math.min(100, downloadProgress))}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 mt-1 text-center">{downloadProgress}%</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UpdateAvailableModal;
