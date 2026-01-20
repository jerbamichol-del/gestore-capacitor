import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ExclamationTriangleIcon } from './icons/ExclamationTriangleIcon';
import { InformationCircleIcon } from './icons/InformationCircleIcon';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: React.ReactNode;
  variant?: 'danger' | 'info';
  confirmButtonText?: string;
  cancelButtonText?: string;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  variant = 'danger',
  confirmButtonText = 'Conferma',
  cancelButtonText = 'Annulla'
}) => {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => setIsAnimating(true), 10);
      return () => clearTimeout(timer);
    } else {
      setIsAnimating(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const config = {
    danger: {
      icon: ExclamationTriangleIcon,
      iconColor: 'text-red-600 dark:text-rose-400',
      bgColor: 'bg-red-100 dark:bg-rose-900/40',
      confirmButtonClasses: 'bg-red-600 dark:bg-rose-600 dark:hover:bg-rose-700 focus:ring-red-500',
    },
    info: {
      icon: InformationCircleIcon,
      iconColor: 'text-indigo-600 dark:text-electric-violet',
      bgColor: 'bg-indigo-100 dark:bg-electric-violet/20',
      confirmButtonClasses: 'bg-indigo-600 dark:btn-electric hover:bg-indigo-700 focus:ring-indigo-500',
    }
  }
  const { icon: Icon, iconColor, bgColor, confirmButtonClasses } = config[variant];

  const modalContent = (
    <div
      className={`fixed inset-0 z-[10000] flex justify-center items-center p-4 transition-opacity duration-300 ease-in-out ${isAnimating ? 'opacity-100' : 'opacity-0'} bg-black/60 backdrop-blur-sm`}
      onClick={onClose}
      aria-modal="true"
      role="dialog"
      aria-labelledby="modal-title"
    >
      <div
        className={`midnight-card w-full max-w-md transform transition-all duration-300 ease-in-out ${isAnimating ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="sm:flex sm:items-start">
            <div className={`mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full ${bgColor} sm:mx-0 sm:h-10 sm:w-10`}>
              <Icon className={`h-6 w-6 ${iconColor}`} aria-hidden="true" />
            </div>
            <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
              <h3 className="text-lg font-bold leading-6 text-slate-900 dark:text-white" id="modal-title">
                {title}
              </h3>
              <div className="mt-2">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  {message}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 bg-sunset-cream/40 dark:bg-midnight flex flex-col-reverse sm:flex-row sm:justify-end gap-3 rounded-b-2xl border-t border-slate-100 dark:border-electric-violet/20">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 text-sm font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-midnight-card border border-slate-300 dark:border-electric-violet/30 rounded-lg shadow-sm hover:bg-sunset-peach/30 dark:hover:bg-slate-800 transition-colors"
          >
            {cancelButtonText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`w-full sm:w-auto px-4 py-2 text-sm font-bold text-white rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${confirmButtonClasses}`}
          >
            {confirmButtonText}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default ConfirmationModal;
