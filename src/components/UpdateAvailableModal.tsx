// src/components/UpdateAvailableModal.tsx
import React, { useState } from 'react';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Browser } from '@capacitor/browser';

interface UpdateInfo {
  available: boolean;
  currentVersion: string;
  currentBuild: string;
  latestVersion: string;
  latestBuild: string;
  downloadUrl: string;
  releaseNotes: string;
}

interface UpdateAvailableModalProps {
  isOpen: boolean;
  updateInfo: UpdateInfo | null;
  onClose: () => void;
  onSkip: () => void;
}

export const UpdateAvailableModal: React.FC<UpdateAvailableModalProps> = ({
  isOpen,
  updateInfo,
  onClose,
  onSkip,
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  if (!isOpen || !updateInfo) return null;

  const handleDownload = async () => {
    setIsDownloading(true);
    setDownloadProgress(0);
    setDownloadError(null);
    setDownloadSuccess(false);

    try {
      console.log('🚀 Starting download from:', updateInfo.downloadUrl);

      // Download file with progress tracking using fetch
      const response = await fetch(updateInfo.downloadUrl);
      if (!response.ok) throw new Error('Download failed');

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Unable to read response');

      const contentLength = parseInt(response.headers.get('Content-Length') || '0', 10);
      let receivedLength = 0;
      const chunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        receivedLength += value.length;

        // Update progress
        if (contentLength > 0) {
          const progress = Math.round((receivedLength / contentLength) * 100);
          setDownloadProgress(progress);
          console.log(`📥 Download progress: ${progress}%`);
        }
      }

      console.log('✅ Download complete!');

      // Combine chunks into single array
      const chunksAll = new Uint8Array(receivedLength);
      let position = 0;
      for (const chunk of chunks) {
        chunksAll.set(chunk, position);
        position += chunk.length;
      }

      // Convert to base64
      console.log('💾 Converting to base64...');
      const base64String = btoa(
        Array.from(chunksAll)
          .map(byte => String.fromCharCode(byte))
          .join('')
      );

      // Save to external storage (Download directory)
      console.log('💾 Saving to Download directory...');
      const fileName = `gestore-spese-build${updateInfo.latestBuild}.apk`;
      
      const result = await Filesystem.writeFile({
        path: fileName,
        data: base64String,
        directory: Directory.ExternalStorage, // Save to external storage
        recursive: true,
      });

      console.log('✅ File saved to:', result.uri);

      setDownloadSuccess(true);
      setDownloadProgress(100);

      // Show success message for 2 seconds, then open file manager
      setTimeout(async () => {
        // Open Downloads folder using file:// scheme
        try {
          // Use Browser.open to open the file with Android's default handler
          await Browser.open({ 
            url: result.uri,
            presentationStyle: 'fullscreen'
          });
          console.log('📦 Opened APK file');
        } catch (openError) {
          console.error('Error opening APK:', openError);
          // If Browser.open fails, show instructions
          setDownloadError(
            `File salvato in Download come "${fileName}". ` +
            'Apri Download e tocca il file per installarlo.'
          );
        }
        
        // Close modal after delay
        setTimeout(() => {
          onClose();
        }, 3000);
      }, 2000);

    } catch (error) {
      console.error('❌ Download error:', error);
      setDownloadError('Errore durante il download. Riprova.');
      setIsDownloading(false);
    }
  };

  const handleSkip = () => {
    onSkip();
    onClose();
  };

  // Parse release notes to extract key features
  const parseReleaseNotes = (notes: string): string[] => {
    const lines = notes.split('\n');
    const features: string[] = [];

    for (const line of lines) {
      // Look for lines starting with - or numbers (bullet points)
      const trimmed = line.trim();
      if (trimmed.startsWith('-') || trimmed.startsWith('*') || /^\d+\./.test(trimmed)) {
        // Remove leading symbols
        const cleaned = trimmed.replace(/^[-*\d.]+\s*/, '');
        if (cleaned.length > 0) {
          features.push(cleaned);
        }
      }
    }

    return features.length > 0 ? features.slice(0, 5) : ['Miglioramenti e correzioni'];
  };

  const features = parseReleaseNotes(updateInfo.releaseNotes);

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4"
      style={{ zIndex: 999999 }}
      onClick={isDownloading ? undefined : onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-3">
            {downloadSuccess ? (
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg
                className="w-6 h-6 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
            )}
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            {downloadSuccess ? '✅ Download Completato!' : '🚀 Aggiornamento Disponibile'}
          </h3>
          <p className="text-sm text-gray-600">
            Versione <span className="font-semibold">{updateInfo.latestVersion}</span>
            {' '}(Build {updateInfo.latestBuild})
          </p>
        </div>

        {/* Current vs New Version */}
        {!isDownloading && !downloadSuccess && (
          <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Versione attuale:</span>
              <span className="font-medium text-gray-900">
                {updateInfo.currentVersion} (Build {updateInfo.currentBuild})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Nuova versione:</span>
              <span className="font-medium text-blue-600">
                {updateInfo.latestVersion} (Build {updateInfo.latestBuild})
              </span>
            </div>
          </div>
        )}

        {/* Features List */}
        {!isDownloading && !downloadSuccess && (
          <div className="space-y-2">
            <h4 className="font-semibold text-gray-900 text-sm">Novità in questo aggiornamento:</h4>
            <ul className="space-y-1.5">
              {features.map((feature, index) => (
                <li key={index} className="flex items-start text-sm text-gray-700">
                  <span className="text-green-500 mr-2 mt-0.5">✓</span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Download Progress */}
        {isDownloading && (
          <div className="space-y-3">
            <div className="text-center">
              <p className="text-sm font-medium text-gray-900 mb-2">
                {downloadProgress < 100 ? `Download in corso... ${downloadProgress}%` : 'Download completato! 🎉'}
              </p>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${downloadProgress}%` }}
                ></div>
              </div>
              {downloadProgress === 100 && !downloadSuccess && (
                <p className="text-xs text-gray-600 mt-2">Apertura file...</p>
              )}
            </div>
          </div>
        )}

        {/* Success Message */}
        {downloadSuccess && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
            <p className="text-sm text-green-800 font-medium mb-1">
              File salvato in Download!
            </p>
            <p className="text-xs text-green-700">
              Tocca il file per installare l'aggiornamento.
            </p>
          </div>
        )}

        {/* Download Error */}
        {downloadError && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-sm text-yellow-800">{downloadError}</p>
          </div>
        )}

        {/* Actions */}
        {!isDownloading && !downloadSuccess && (
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSkip}
              className="flex-1 px-4 py-2.5 text-gray-700 bg-gray-100 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              Salta
            </button>
            <button
              onClick={handleDownload}
              className="flex-1 px-4 py-2.5 text-white bg-blue-600 rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm"
            >
              Scarica Ora
            </button>
          </div>
        )}

        {/* Info */}
        {!isDownloading && !downloadSuccess && (
          <p className="text-xs text-center text-gray-500 pt-2">
            L'aggiornamento preserverà tutti i tuoi dati
          </p>
        )}
      </div>
    </div>
  );
};
