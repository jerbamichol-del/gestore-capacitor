
import React, { useState } from 'react';
import { OfflineImage } from '../utils/db';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { TrashIcon } from './icons/TrashIcon';
import { ChevronDownIcon } from './icons/ChevronDownIcon';

interface PendingImagesProps {
  images: OfflineImage[];
  onAnalyze: (image: OfflineImage) => void;
  onDelete: (id: string) => void;
  isOnline: boolean;
  syncingImageId: string | null;
}

const PendingImages: React.FC<PendingImagesProps> = ({ images, onAnalyze, onDelete, isOnline, syncingImageId }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!images || images.length === 0) {
    return null;
  }

  const isAnalyzing = !!syncingImageId;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg transition-colors">
      <button
        className="w-full flex items-center justify-between p-6 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 rounded-2xl"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-slate-700 dark:text-slate-100 transition-colors">Immagini in Attesa</h2>
          <span className="flex items-center justify-center min-w-[24px] h-6 px-2 text-sm font-semibold text-white bg-indigo-500 dark:bg-indigo-600 rounded-full transition-colors">
            {images.length}
          </span>
        </div>
        <ChevronDownIcon className={`w-6 h-6 text-slate-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="px-6 pb-6 animate-fade-in-up transition-colors" style={{ animationDuration: '300ms' }}>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 border-t border-slate-200 dark:border-slate-800 pt-6 transition-colors">
            Queste immagini sono state salvate mentre eri offline. Clicca su "Analizza" per processarle ora che sei online.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {images.map(image => (
              <div key={image.id} className="border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col group rounded-lg overflow-hidden transition-colors">
                <div className="relative">
                  <img
                    src={`data:${image.mimeType};base64,${image.base64Image}`}
                    alt="Anteprima spesa offline"
                    className="w-full h-24 object-cover bg-slate-100 dark:bg-slate-800 transition-colors"
                  />
                  {syncingImageId === image.id && (
                    <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm flex items-center justify-center transition-colors">
                      <SpinnerIcon className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                      <span className="sr-only">Analisi in corso...</span>
                    </div>
                  )}
                </div>
                <div className="p-2 mt-auto flex items-center justify-center gap-2 bg-slate-50 dark:bg-slate-800/50 transition-colors">
                  <button
                    onClick={() => onAnalyze(image)}
                    disabled={!isOnline || isAnalyzing}
                    className="flex-1 px-2 py-1.5 text-xs font-semibold text-white bg-indigo-600 dark:bg-indigo-500 rounded-md shadow-sm hover:bg-indigo-700 dark:hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors disabled:bg-indigo-400 dark:disabled:bg-indigo-900/50 disabled:cursor-not-allowed"
                    title={!isOnline ? "Connettiti a internet per analizzare" : "Analizza immagine"}
                  >
                    Analizza
                  </button>
                  <button
                    onClick={() => onDelete(image.id)}
                    disabled={isAnalyzing}
                    className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Elimina immagine in attesa"
                  >
                    <TrashIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PendingImages;
