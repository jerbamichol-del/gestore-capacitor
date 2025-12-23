// CalculatorInputScreen.tsx
import React, { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { Expense, Account, CATEGORIES } from '../types';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon';
import { ArrowRightIcon } from './icons/ArrowRightIcon';
import { XMarkIcon } from './icons/XMarkIcon';
import { CheckIcon } from './icons/CheckIcon';
import { BackspaceIcon } from './icons/BackspaceIcon';
import SelectionMenu from './SelectionMenu';
import { getCategoryStyle } from '../utils/categoryStyles';
import { ChevronLeftIcon } from './icons/ChevronLeftIcon';
import SmoothPullTab from './SmoothPullTab';

interface CalculatorInputScreenProps {
  onClose: () => void;
  onSubmit: (data: Omit<Expense, "id">) => void;
  accounts: Account[];
  formData: Partial<Omit<Expense, 'id'>>;
  onFormChange: (newData: Partial<Omit<Expense, 'id'>>) => void;
  onMenuStateChange: (isOpen: boolean) => void;
  isDesktop: boolean;
  onNavigateToDetails: () => void;
}

// Memoized formatter
const formatAmountForDisplay = (numStr: string): string => {
  const sanitizedStr = String(numStr || '0').replace('.', ',');
  const [integerPart, decimalPart] = sanitizedStr.split(',');
  const formattedIntegerPart = (integerPart || '0').replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return decimalPart !== undefined ? `${formattedIntegerPart},${decimalPart}` : formattedIntegerPart;
};

const getAmountFontSize = (value: string): string => {
  const len = value.length;
  if (len <= 4) return 'text-9xl';
  if (len <= 6) return 'text-8xl';
  if (len <= 8) return 'text-7xl';
  if (len <= 11) return 'text-6xl';
  return 'text-5xl';
};

// Optimized Keypad Button
const KeypadButton: React.FC<React.HTMLAttributes<HTMLDivElement> & {
  children: React.ReactNode;
  onClick?: () => void;
}> = ({ children, onClick, className = '', ...rest }) => {
  const blurSelf = (el: EventTarget | null) => {
    if (el && (el as HTMLElement).blur) (el as HTMLElement).blur();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={typeof children === 'string' ? `Tasto ${children}` : 'Tasto'}
      aria-pressed="false"
      onClick={(e) => { onClick?.(); blurSelf(e.currentTarget); }}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && onClick) {
          e.preventDefault();
          onClick();
          blurSelf(e.currentTarget);
        }
      }}
      onPointerUp={(e) => blurSelf(e.currentTarget)}
      onMouseDown={(e) => e.preventDefault()}
      className={`flex items-center justify-center text-5xl font-light focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400 transition-colors duration-150 select-none cursor-pointer active:scale-95 ${className}`}
      style={{
        WebkitTapHighlightColor: 'transparent',
        touchAction: 'manipulation',
        WebkitTouchCallout: 'none',
        userSelect: 'none',
      } as React.CSSProperties}
      {...rest}
    >
      <span className="pointer-events-none">{children}</span>
    </div>
  );
};

const OperatorButton: React.FC<{ children: React.ReactNode; onClick: () => void }> = ({ children, onClick }) => {
  const blurSelf = (el: EventTarget | null) => {
    if (el && (el as HTMLElement).blur) (el as HTMLElement).blur();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Operatore ${children}`}
      aria-pressed="false"
      onClick={(e) => { onClick(); blurSelf(e.currentTarget); }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); blurSelf(e.currentTarget); } }}
      onPointerUp={(e) => blurSelf(e.currentTarget)}
      onMouseDown={(e) => e.preventDefault()}
      className="flex-1 w-full text-5xl text-indigo-600 font-light active:bg-slate-300/80 transition-colors duration-150 flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400 select-none cursor-pointer active:scale-95"
      style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' } as React.CSSProperties}
    >
      <span className="pointer-events-none">{children}</span>
    </div>
  );
};

const CalculatorInputScreen = React.forwardRef<HTMLDivElement, CalculatorInputScreenProps>(({