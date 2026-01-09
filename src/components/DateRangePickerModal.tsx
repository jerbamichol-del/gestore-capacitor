import React, { useState, useEffect } from 'react';
import { XMarkIcon } from './icons/XMarkIcon';
import { CalendarIcon } from './icons/CalendarIcon';

interface DateRangePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (range: { start: string, end: string }) => void;
  initialRange: { start: string | null, end: string | null };
}

export const DateRangePickerModal: React.FC<DateRangePickerModalProps> = ({ isOpen, onClose, onApply, initialRange }) => {
  const [start, setStart] = useState(initialRange.start || '');
  const [end, setEnd] = useState(initialRange.end || '');
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStart(initialRange.start || '');
      setEnd(initialRange.end || '');
      // Piccola attesa per permettere il mount prima dell'animazione
      const timer = setTimeout(() => setIsAnimating(true), 10);
      return () => clearTimeout(timer);
    } else {
      setIsAnimating(false);
    }
  }, [isOpen, initialRange]);

  const handleApply = () => {
    if (start && end) {
      onApply({ start, end });
    }
  };

  const handleBackdropClick = () => {
    setIsAnimating(false);
    setTimeout(onClose, 300);
  };

  if (!isOpen && !isAnimating) return null;

  return (
    <div
      className={`fixed inset-0 z-[60] flex justify-center items-center p-4 transition-opacity duration-300 ease-in-out ${isAnimating ? 'opacity-100' : 'opacity-0'} bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm`}
      onClick={handleBackdropClick}
      aria-modal="true"
      role="dialog"
    >
      <div
        className={`bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-sm transform transition-all duration-300 ease-in-out ${isAnimating ? 'scale-100 opacity-100' : 'scale-95 opacity-0'} transition-colors`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-800 transition-colors">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Seleziona Periodo</h2>
          <button
            type="button"
            onClick={handleBackdropClick}
            className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Chiudi"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </header>

        {/* Body */}
        <div className="p-6 space-y-5">
          <div>
            <label htmlFor="start-date" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 transition-colors">Dal</label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <CalendarIcon className="h-5 w-5 text-slate-400 dark:text-slate-500" />
              </div>
              <input
                type="date"
                id="start-date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="block w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 py-2.5 pl-10 pr-3 text-base text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                style={{ colorScheme: 'auto' }} // Ensure calendar picker respects theme if possible
              />
            </div>
          </div>

          <div>
            <label htmlFor="end-date" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 transition-colors">Al</label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <CalendarIcon className="h-5 w-5 text-slate-400 dark:text-slate-500" />
              </div>
              <input
                type="date"
                id="end-date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="block w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 py-2.5 pl-10 pr-3 text-base text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                style={{ colorScheme: 'auto' }}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="p-4 bg-slate-100 dark:bg-slate-950/50 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 rounded-b-lg transition-colors">
          <button
            type="button"
            onClick={handleBackdropClick}
            className="px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg shadow-sm hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={!start || !end}
            className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 dark:bg-indigo-500 rounded-lg shadow-sm hover:bg-indigo-700 dark:hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors disabled:bg-indigo-300 dark:disabled:bg-slate-800 dark:disabled:text-slate-500 disabled:cursor-not-allowed"
          >
            Applica
          </button>
        </footer>
      </div>
    </div>
  );
};
