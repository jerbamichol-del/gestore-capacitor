// src/components/UpdateAvailableModal.tsx
import React from 'react';
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
  if (!isOpen || !updateInfo) return null;

  const handleDownload = async () => {
    try {
      // Open download URL in browser
      await Browser.open({ url: updateInfo.downloadUrl });
      onClose();
    } catch (error) {
      console.error('Error opening download URL:', error);
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
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-3">
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
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            🚀 Aggiornamento Disponibile
          </h3>
          <p className="text-sm text-gray-600">
            Versione <span className="font-semibold">{updateInfo.latestVersion}</span>
            {' '}(Build {updateInfo.latestBuild})
          </p>
        </div>

        {/* Current vs New Version */}
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

        {/* Features List */}
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

        {/* Actions */}
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

        {/* Info */}
        <p className="text-xs text-center text-gray-500 pt-2">
          L'aggiornamento preserverà tutti i tuoi dati
        </p>
      </div>
    </div>
  );
};
