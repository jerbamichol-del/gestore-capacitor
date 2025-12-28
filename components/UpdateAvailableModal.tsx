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
  }): Promise<{ downloadId?: string; status?: string }>;

  getDownloadProgress(options: { downloadId: string }): Promise<{
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
  const downloadIdRef = useRef<string | null>(null);
  const startedAtRef = useRef<number | null>(null);

  const stopPolling = () => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => {
    if (!isOpen) {
      stopPolling();
      downloadIdRef.current = null;
      startedAtRef.current = null;
      setIsDownloading(false);
      setDownloadProgress(0);
      setError(null);
    }

    return () => {
      stopPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen || !updateInfo.available) return null;

  const handleDownloadAndInstall = async () => {
    if (!updateInfo.downloadUrl) {
      setError('URL download non disponibile');
      return;
    }

    setIsDownloading(true);
    setDownloadProgress(0);
    setError(null);
    startedAtRef.current = Date.now();

    const fileName = `gestore-spese-${updateInfo.latestBuild || updateInfo.latestVersion || 'latest'}.apk`;

    try {
      const res = await AppUpdate.downloadAndInstall({
        url: updateInfo.downloadUrl,
        fileName,
        title: 'Aggiornamento disponibile',
        description: 'Download in corso...',
      });

      const downloadId = res?.downloadId ? String(res.downloadId) : null;
      downloadIdRef.current = downloadId;

      if (!downloadIdRef.current) {
        // Can't poll. Rely on DownloadManager notification.
        setTimeout(() => {
          setIsDownloading(false);
          onClose();
        }, 800);
        return;
      }

      stopPolling();

      // Small delay before first poll to avoid OEM timing quirks.
      setTimeout(() => {
        pollRef.current = window.setInterval(async () => {
          try {
            const id = downloadIdRef.current;
            if (!id) {
              stopPolling();
              return;
            }

            const p = await AppUpdate.getDownloadProgress({ downloadId: id });
            const progress = typeof p?.progress === 'number' ? p.progress : 0;
            setDownloadProgress(progress);

            const status = p?.status;

            if (status === 'successful' || progress >= 100) {
              stopPolling();
              setTimeout(() => {
                setIsDownloading(false);
                onClose();
              }, 800);
              return;
            }

            if (status === 'failed') {
              stopPolling();
              setIsDownloading(false);
              setError('Download fallito. Riprova.');
              return;
            }

            const startedAt = startedAtRef.current ?? Date.now();
            const elapsed = Date.now() - startedAt;
            if (elapsed > 4 * 60 * 1000) {
              stopPolling();
              setIsDownloading(false);
              setError('Download in corso troppo a lungo. Controlla la notifica di download o l\'app Download e riprova.');
            }
          } catch (e: any) {
            // IMPORTANT: do NOT auto-open browser here; keep update flow native and stable.
            stopPolling();
            setIsDownloading(false);

            const msg = (e?.message || e?.toString?.() || '').toLowerCase();
            if (msg.includes('invalid download id') || msg.includes('download not found')) {
              setError('Download avviato ma non tracciabile. Controlla notifiche/Downloads: quando finisce, tocca la notifica per installare.');
              return;
            }

            setError('Errore durante il download. Riprova.');
          }
        }, 900);
      }, 700);

    } catch (err) {
      // Fallback only if the native plugin fails to start the download.
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
            <p className="text-xs text-blue-800">💡 <strong>Nota:</strong> A fine download riceverai una notifica: toccala per installare.</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

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

          {/* Manual fallback */}
          {!isDownloading && updateInfo.downloadUrl && (
            <button
              onClick={() => Browser.open({ url: updateInfo.downloadUrl, presentationStyle: 'popover' })}
              className="mt-4 w-full px-4 py-3 border border-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-50 transition-colors"
            >
              Apri link download (fallback)
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default UpdateAvailableModal;
