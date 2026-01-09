import React, { useEffect, useRef, useState } from 'react';
import { registerPlugin } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { UpdateInfo } from '../hooks/useUpdateChecker';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { XMarkIcon } from './icons/XMarkIcon';
import { ArrowPathIcon } from './icons/ArrowPathIcon';
import { ArrowDownTrayIcon } from './icons/ArrowDownTrayIcon';
import { InformationCircleIcon } from './icons/InformationCircleIcon';
import { CheckCircleIcon } from './icons/CheckCircleIcon';

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
        setTimeout(() => {
          setIsDownloading(false);
          onClose();
        }, 800);
        return;
      }

      stopPolling();

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

            if (status === 'successful') {
              stopPolling();
              setTimeout(() => {
                setIsDownloading(false);
                onClose();
              }, 500);
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
              setError('Download in corso troppo a lungo. Controlla la notifica di download.');
            }
          } catch (e: any) {
            stopPolling();
            setIsDownloading(false);
            setError('Errore durante il download. Riprova.');
          }
        }, 900);
      }, 700);

    } catch (err) {
      try {
        await Browser.open({ url: updateInfo.downloadUrl, presentationStyle: 'popover' });
        setTimeout(() => {
          setIsDownloading(false);
          onClose();
        }, 800);
      } catch {
        setError('Errore durante il download. Riprova.');
        setIsDownloading(false);
      }
    }
  };

  const parseReleaseNotes = (notes: string | undefined) => {
    if (!notes) return null;

    const lines = notes.split('\n');
    const categories: { [key: string]: string[] } = {
      '🚀 Novità': [],
      '🛠️ Fix': [],
      '📈 Miglioramenti': [],
      '✨ Altro': []
    };

    lines.forEach(line => {
      const cleanLine = line.trim();
      if (!cleanLine) return;

      const lowerLine = cleanLine.toLowerCase();
      if (lowerLine.includes('fix') || lowerLine.includes('bug') || lowerLine.includes('corrett')) {
        categories['🛠️ Fix'].push(cleanLine.replace(/^[-*]\s*/, ''));
      } else if (lowerLine.includes('nuov') || lowerLine.includes('aggiunt') || lowerLine.includes('feature')) {
        categories['🚀 Novità'].push(cleanLine.replace(/^[-*]\s*/, ''));
      } else if (lowerLine.includes('miglior') || lowerLine.includes('ottimizz')) {
        categories['📈 Miglioramenti'].push(cleanLine.replace(/^[-*]\s*/, ''));
      } else {
        categories['✨ Altro'].push(cleanLine.replace(/^[-*]\s*/, ''));
      }
    });

    return categories;
  };

  const changelog = parseReleaseNotes(updateInfo.releaseNotes);

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md transition-all duration-300"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isDownloading) onSkip();
      }}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 dark:border-slate-800 transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Section */}
        <div className="bg-slate-50 dark:bg-slate-800/50 p-6 pb-4 border-b border-slate-100 dark:border-slate-800 transition-colors relative">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-none">
              <ArrowPathIcon className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white transition-colors">Nuova Versione</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded text-xs font-mono">{updateInfo.currentVersion || '1.0.0'}</span>
                <span className="text-slate-400">→</span>
                <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded text-xs font-bold font-mono">
                  {updateInfo.latestVersion || 'Nuova'}
                </span>
              </div>
            </div>
          </div>

          {!isDownloading && (
            <button
              onClick={onSkip}
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          )}
        </div>

        <div className="p-6">
          {/* Changelog Section */}
          <div className="mb-6">
            <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <CheckCircleIcon className="w-4 h-4 text-emerald-500" />
              Cosa c'è di nuovo
            </h3>

            <div className="space-y-4 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
              {changelog ? (
                Object.entries(changelog).map(([cat, items]) => items.length > 0 && (
                  <div key={cat} className="space-y-2">
                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">{cat}</p>
                    <ul className="space-y-1.5">
                      {items.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 mt-1.5 flex-shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-600 dark:text-slate-400 italic">Miglioramenti generali e ottimizzazioni del sistema.</p>
              )}
            </div>
          </div>

          {/* Info Note */}
          <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl p-4 mb-6 flex items-start gap-3 transition-colors border border-indigo-100/50 dark:border-indigo-800/30">
            <InformationCircleIcon className="w-5 h-5 text-indigo-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-indigo-800 dark:text-indigo-300 leading-relaxed">
              L'installazione è sicura e non comporterà la perdita dei tuoi dati. L'installer si avvierà automaticamente al termine del download.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-2xl p-4 mb-6 transition-colors">
              <p className="text-sm text-red-700 dark:text-red-300 font-medium">{error}</p>
            </div>
          )}

          {/* Progress Bar (Visible during download) */}
          {isDownloading && (
            <div className="mb-6 animate-in fade-in slide-in-from-top-2">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">Download in corso...</span>
                <span className="text-sm font-mono font-bold text-slate-500 dark:text-slate-400">{downloadProgress}%</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden shadow-inner flex items-center px-0.5">
                <div
                  className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-2 rounded-full transition-all duration-300 shadow-md shadow-indigo-200 dark:shadow-none"
                  style={{ width: `${Math.max(2, downloadProgress)}%` }}
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-3">
            <button
              onClick={handleDownloadAndInstall}
              disabled={isDownloading}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold transition-all shadow-xl shadow-indigo-100 dark:shadow-none disabled:opacity-50 disabled:scale-95 flex items-center justify-center gap-3 active:scale-98"
            >
              {isDownloading ? (
                <>
                  <SpinnerIcon className="w-5 h-5 animate-spin" />
                  Preparazione...
                </>
              ) : (
                <>
                  <ArrowDownTrayIcon className="w-5 h-5" />
                  Aggiorna ora
                  <span className="text-indigo-300 font-normal">({updateInfo.latestBuild ? `build ${updateInfo.latestBuild}` : 'APK'})</span>
                </>
              )}
            </button>

            {!isDownloading && (
              <button
                onClick={onSkip}
                className="w-full py-4 text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-colors"
              >
                Lo farò più tardi
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UpdateAvailableModal;
