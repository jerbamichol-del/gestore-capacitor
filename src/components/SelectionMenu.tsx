import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon } from './icons/XMarkIcon';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { useSheetDragControlled } from '../hooks/useSheetDragControlled';
import { useTapBridge } from '../hooks/useTapBridge';

interface Option {
  value: string;
  label: string;
  Icon?: React.FC<React.SVGProps<SVGSVGElement>>;
  color?: string;
  bgColor?: string;
}

interface SelectionMenuProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  options: Option[];
  selectedValue: string;
  onSelect: (value: string) => void;
}

const SelectionMenu: React.FC<SelectionMenuProps> = ({ isOpen, onClose, title, options, selectedValue, onSelect }) => {
  const [isMounted, setIsMounted] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const tapBridgeHandlers = useTapBridge();

  const { dragY, transitionMs, easing, handleTransitionEnd } =
    useSheetDragControlled(menuRef, { onClose }, {
      triggerPercent: 0.25,
      elastic: 1,
      topGuardPx: 2,
      scrollableSelector: '[data-scrollable]'
    });

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setIsMounted(true));
      document.body.style.overflow = 'hidden';
    } else {
      setIsMounted(false);
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleManualClose = () => setIsMounted(false);

  const onInternalTransitionEnd = (e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && e.propertyName === 'transform') {
      handleTransitionEnd(e.nativeEvent as any);
      if (!isMounted) {
        onClose();
      }
    }
  };

  if (!isOpen) return null;

  const isHookActive = dragY > 0 || transitionMs > 0;

  let transformStyle: string;
  let transitionStyle: string;
  const openCloseEasing = 'cubic-bezier(0.22, 0.61, 0.36, 1)';

  if (isHookActive) {
    transformStyle = `translate3d(0, ${dragY}px, 0)`;
    transitionStyle = `transform ${transitionMs}ms ${easing}`;
  } else {
    const h = menuRef.current?.clientHeight ?? window.innerHeight;
    transformStyle = `translate3d(0, ${isMounted ? 0 : h}px, 0)`;
    transitionStyle = `transform 250ms ${openCloseEasing}`;
  }

  const menuContent = (
    <div className="fixed inset-0 z-[10000] flex flex-col justify-end" aria-modal="true" role="dialog">
      <div
        className={`absolute inset-0 bg-black/30 transition-opacity duration-300 ease-in-out ${isMounted ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleManualClose}
      />
      <div
        ref={menuRef}
        onTransitionEnd={onInternalTransitionEnd}
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 bg-sunset-cream dark:bg-midnight rounded-t-2xl shadow-[0_-8px_32px_rgba(0,0,0,0.15)] max-h-[85vh] flex flex-col border-t border-slate-200 dark:border-electric-violet/30"
        style={{
          transform: transformStyle,
          transition: transitionStyle,
          touchAction: 'pan-y',
          willChange: 'transform',
          overscrollBehaviorY: 'contain'
        }}
        {...tapBridgeHandlers}
      >
        <header className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
          <div className="flex-1 text-center">
            <div className="inline-block h-1.5 w-12 rounded-full bg-slate-200 dark:bg-slate-700 absolute top-2 left-1/2 -translate-x-1/2" />
            <h2 className="text-xl font-extrabold text-slate-800 dark:text-white pointer-events-none mt-2">{title}</h2>
          </div>
          <button
            type="button"
            onClick={handleManualClose}
            className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors p-2 rounded-full hover:bg-slate-100 dark:hover:bg-midnight-card focus:outline-none focus:ring-2 focus:ring-indigo-500 absolute top-2 right-2"
            aria-label="Chiudi"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </header>
        <div data-scrollable className="overflow-y-auto p-3" style={{ overscrollBehavior: 'contain' }}>
          <ul className="space-y-1">
            {options.map((option) => {
              const isSelected = selectedValue === option.value;
              return (
                <li key={option.value}>
                  <button
                    onClick={() => onSelect(option.value)}
                    style={{ touchAction: 'manipulation' }}
                    className={`w-full text-left p-4 flex items-center justify-between gap-4 transition-all rounded-xl ${isSelected
                      ? 'bg-sunset-coral/10 dark:bg-electric-violet/20 border border-sunset-coral/20 dark:border-electric-violet/30'
                      : 'hover:bg-slate-100 dark:hover:bg-white/5 border border-transparent'
                      }`}
                  >
                    <span className="flex items-center gap-4 min-w-0">
                      {option.Icon && (
                        <div className={`p-2 rounded-full flex-shrink-0 ${isSelected ? 'bg-sunset-coral/10 dark:bg-electric-violet/20' : 'bg-slate-100 dark:bg-slate-800'}`}>
                          <option.Icon className="w-10 h-10" color={option.color} />
                        </div>
                      )}
                      <span className={`font-bold text-lg truncate ${isSelected ? 'text-sunset-coral dark:text-electric-violet' : 'text-slate-800 dark:text-slate-200'}`}>
                        {option.label}
                      </span>
                    </span>
                    {isSelected && <CheckCircleIcon className="w-7 h-7 text-sunset-coral dark:text-electric-violet flex-shrink-0" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        {/* Safe area spacer for mobile */}
        <div className="h-[env(safe-area-inset-bottom,20px)] bg-sunset-cream dark:bg-midnight flex-shrink-0" />
      </div>
    </div>
  );

  return createPortal(menuContent, document.body);
};

export default SelectionMenu;
