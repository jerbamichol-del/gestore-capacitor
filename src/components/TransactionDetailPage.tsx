import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import { Expense, Account, CATEGORIES } from '../types';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon';
import { DocumentTextIcon } from './icons/DocumentTextIcon';
import { CalendarIcon } from './icons/CalendarIcon';
import { CreditCardIcon } from './icons/CreditCardIcon';
import { ClockIcon } from './icons/ClockIcon';
import { TagIcon } from './icons/TagIcon';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { XMarkIcon } from './icons/XMarkIcon';
import { PaperClipIcon } from './icons/PaperClipIcon';
import { CameraIcon } from './icons/CameraIcon';
import { PhotoIcon } from './icons/PhotoIcon';
import { TrashIcon } from './icons/TrashIcon';
import { formatCurrency } from './icons/formatters';
import SelectionMenu from './SelectionMenu';
import { useTapBridge } from '../hooks/useTapBridge';
import { pickImage, processImageFile } from '../utils/fileHelper';
import { parseLocalYYYYMMDD, toYYYYMMDD } from '../utils/date';
import { getCategoryStyle } from '../utils/categoryStyles';

interface TransactionDetailPageProps {
  formData: Partial<Omit<Expense, 'id'>>;
  onFormChange: (newData: Partial<Omit<Expense, 'id'>>) => void;
  accounts: Account[];
  onClose: () => void;
  onSubmit: (data: Omit<Expense, 'id'>) => void;
  isDesktop: boolean;
  onMenuStateChange: (isOpen: boolean) => void;
  dateError: boolean;
}

const recurrenceLabels = {
  daily: 'Giornaliera',
  weekly: 'Settimanale',
  monthly: 'Mensile',
  yearly: 'Annuale',
} as const;

const daysOfWeekLabels = { 0: 'Dom', 1: 'Lun', 2: 'Mar', 3: 'Mer', 4: 'Gio', 5: 'Ven', 6: 'Sab' } as const;
const dayOfWeekNames = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
const ordinalSuffixes = ['primo', 'secondo', 'terzo', 'quarto', 'ultimo'];

const formatShortDate = (s?: string) => {
  const d = parseLocalYYYYMMDD(s);
  if (!d) return '';
  return new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', timeZone: 'UTC' })
    .format(d)
    .replace('.', '');
};

const Modal = memo<{
  isOpen: boolean;
  isAnimating: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}>(({ isOpen, isAnimating, onClose, title, children, className }) => {
  if (!isOpen && !isAnimating) return null;

  return (
    <div
      className={`absolute inset-0 z-[60] flex justify-center items-center p-4 transition-opacity duration-300 ${isAnimating ? 'opacity-100' : 'opacity-0'} bg-slate-900/40 backdrop-blur-sm`}
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
      aria-modal="true"
      role="dialog"
    >
      <div
        className={`midnight-card rounded-lg shadow-xl w-full max-w-sm border border-transparent dark:border-electric-violet/30 transform transition-all duration-300 ${isAnimating ? 'scale-100 opacity-100' : 'scale-95 opacity-0'} ${className || ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-electric-violet/20">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-electric-violet p-1 rounded-full hover:bg-slate-200 dark:hover:bg-midnight-card focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
            aria-label="Chiudi"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
});
Modal.displayName = 'Modal';

const daysOfWeekForPicker = [
  { label: 'Lun', value: 1 }, { label: 'Mar', value: 2 }, { label: 'Mer', value: 3 },
  { label: 'Gio', value: 4 }, { label: 'Ven', value: 5 }, { label: 'Sab', value: 6 },
  { label: 'Dom', value: 0 },
];

const getRecurrenceSummary = (e: Partial<Expense>) => {
  if (e.frequency !== 'recurring' || !e.recurrence) return 'Imposta ricorrenza';

  const {
    recurrence,
    recurrenceInterval = 1,
    recurrenceDays,
    monthlyRecurrenceType,
    date: startDate,
    recurrenceEndType = 'forever',
    recurrenceEndDate,
    recurrenceCount,
  } = e;

  let s = '';
  if (recurrenceInterval === 1) {
    s = recurrenceLabels[recurrence];
  } else {
    s =
      recurrence === 'daily' ? `Ogni ${recurrenceInterval} giorni` :
        recurrence === 'weekly' ? `Ogni ${recurrenceInterval} sett.` :
          recurrence === 'monthly' ? `Ogni ${recurrenceInterval} mesi` :
            `Ogni ${recurrenceInterval} anni`;
  }

  if (recurrence === 'weekly' && recurrenceDays?.length) {
    const ordered = [...recurrenceDays].sort(
      (a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b)
    );
    const labels = ordered.map(d => daysOfWeekLabels[d as keyof typeof daysOfWeekLabels]);
    s += `: ${labels.join(', ')}`;
  }

  if (recurrence === 'monthly' && monthlyRecurrenceType === 'dayOfWeek' && startDate) {
    const d = parseLocalYYYYMMDD(startDate);
    if (d) {
      const dom = d.getUTCDate();
      const dow = d.getUTCDay();
      const wom = Math.floor((dom - 1) / 7);
      s += ` (${ordinalSuffixes[wom]} ${dayOfWeekNames[dow].slice(0, 3)}.)`;
    }
  }

  if (recurrenceEndType === 'date' && recurrenceEndDate) {
    s += `, fino al ${formatShortDate(recurrenceEndDate)}`;
  } else if (recurrenceEndType === 'count' && recurrenceCount && recurrenceCount > 0) {
    s += `, ${recurrenceCount} volte`;
  }

  return s;
};

const getIntervalLabel = (
  recurrence?: 'daily' | 'weekly' | 'monthly' | 'yearly',
  n?: number
) => {
  const c = n || 1;
  switch (recurrence) {
    case 'daily': return c === 1 ? 'giorno' : 'giorni';
    case 'weekly': return c === 1 ? 'settimana' : 'settimane';
    case 'monthly': return c === 1 ? 'mese' : 'mesi';
    case 'yearly': return c === 1 ? 'anno' : 'anni';
    default: return 'mese';
  }
};

const TransactionDetailPage: React.FC<TransactionDetailPageProps> = ({
  formData,
  onFormChange,
  accounts,
  onClose,
  onSubmit,
  isDesktop,
  onMenuStateChange,
  dateError,
}) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const descriptionInputRef = useRef<HTMLInputElement>(null);

  const tapBridgeHandlers = useTapBridge();

  const [activeMenu, setActiveMenu] = useState<'account' | 'toAccount' | 'category' | 'subcategory' | null>(null);

  const [isFrequencyModalOpen, setIsFrequencyModalOpen] = useState(false);
  const [isFrequencyModalAnimating, setIsFrequencyModalAnimating] = useState(false);

  const [isRecurrenceModalOpen, setIsRecurrenceModalOpen] = useState(false);
  const [isRecurrenceModalAnimating, setIsRecurrenceModalAnimating] = useState(false);
  const [isRecurrenceOptionsOpen, setIsRecurrenceOptionsOpen] = useState(false);
  const [isRecurrenceEndOptionsOpen, setIsRecurrenceEndOptionsOpen] = useState(false);

  // Receipt Menu
  const [isReceiptMenuOpen, setIsReceiptMenuOpen] = useState(false);
  const [isReceiptMenuAnimating, setIsReceiptMenuAnimating] = useState(false);

  const receiptMenuCloseTimeRef = useRef(0);

  const [viewingImage, setViewingImage] = useState<string | null>(null);

  const [tempRecurrence, setTempRecurrence] = useState(formData.recurrence);
  const [tempRecurrenceInterval, setTempRecurrenceInterval] = useState<number | undefined>(formData.recurrenceInterval);
  const [tempRecurrenceDays, setTempRecurrenceDays] = useState<number[] | undefined>(formData.recurrenceDays);
  const [tempMonthlyRecurrenceType, setTempMonthlyRecurrenceType] = useState(formData.monthlyRecurrenceType);

  const formDataRef = useRef(formData);
  useEffect(() => { formDataRef.current = formData; }, [formData]);

  const isIncome = formData.type === 'income';
  const isTransfer = formData.type === 'transfer';
  const isAdjustment = formData.type === 'adjustment';

  const isSingleRecurring =
    formData.frequency === 'recurring' &&
    formData.recurrenceEndType === 'count' &&
    formData.recurrenceCount === 1;

  useEffect(() => {
    if (!formData.time && !formData.frequency) {
      const time = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
      onFormChange({ time });
    }
  }, []);

  const handleKeyboardClose = useRef<(() => void) | null>(null);

  useEffect(() => {
    handleKeyboardClose.current = () => {
      const activeEl = document.activeElement;
      if (activeEl === descriptionInputRef.current) {
        (activeEl as HTMLElement).blur();
      }
    };
  }, []);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    let lastHeight = vv.height;
    const handleResize = () => {
      const heightIncrease = vv.height - lastHeight;
      if (heightIncrease > 100 && handleKeyboardClose.current) {
        handleKeyboardClose.current();
      }
      lastHeight = vv.height;
    };

    vv.addEventListener('resize', handleResize);
    return () => vv.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const anyOpen = !!(activeMenu || isFrequencyModalOpen || isRecurrenceModalOpen || isReceiptMenuOpen);
    onMenuStateChange(anyOpen);
  }, [activeMenu, isFrequencyModalOpen, isRecurrenceModalOpen, isReceiptMenuOpen, onMenuStateChange]);

  useEffect(() => {
    if (isFrequencyModalOpen) {
      const t = setTimeout(() => setIsFrequencyModalAnimating(true), 10);
      return () => clearTimeout(t);
    } else {
      setIsFrequencyModalAnimating(false);
    }
  }, [isFrequencyModalOpen]);

  useEffect(() => {
    if (isReceiptMenuOpen) {
      const t = setTimeout(() => setIsReceiptMenuAnimating(true), 10);
      return () => clearTimeout(t);
    } else {
      setIsReceiptMenuAnimating(false);
    }
  }, [isReceiptMenuOpen]);

  useEffect(() => {
    if (isRecurrenceModalOpen) {
      setTempRecurrence(formData.recurrence || 'monthly');
      setTempRecurrenceInterval(formData.recurrenceInterval || 1);
      setTempRecurrenceDays(formData.recurrenceDays || []);
      setTempMonthlyRecurrenceType(formData.monthlyRecurrenceType || 'dayOfMonth');
      setIsRecurrenceOptionsOpen(false);
      const t = setTimeout(() => setIsRecurrenceModalAnimating(true), 10);
      return () => clearTimeout(t);
    } else {
      setIsRecurrenceModalAnimating(false);
    }
  }, [isRecurrenceModalOpen, formData.recurrence, formData.recurrenceInterval, formData.recurrenceDays, formData.monthlyRecurrenceType]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    if (name === 'recurrenceEndDate') {
      if (value === '') {
        onFormChange({ recurrenceEndType: 'forever', recurrenceEndDate: undefined });
      } else {
        onFormChange({ recurrenceEndDate: value });
      }
      return;
    }

    if (name === 'recurrenceCount') {
      const num = parseInt(value, 10);
      onFormChange({ [name]: isNaN(num) || num <= 0 ? undefined : num } as any);
      return;
    }

    onFormChange({ [name]: value });
  };

  const handleAccountSelect = (accountId: string) => {
    onFormChange({ accountId });
    setActiveMenu(null);
  };

  const handleToAccountSelect = (toAccountId: string) => {
    onFormChange({ toAccountId });
    setActiveMenu(null);
  };

  const handleCategorySelect = (category: string) => {
    onFormChange({ category, subcategory: undefined });
    setActiveMenu(null);
  };

  const handleSubcategorySelect = (subcategory: string) => {
    onFormChange({ subcategory });
    setActiveMenu(null);
  };

  const handleFrequencySelect = (frequency: 'none' | 'single' | 'recurring') => {
    const up: Partial<Expense> = {};
    if (frequency === 'none') {
      Object.assign(up, {
        frequency: undefined,
        date: toYYYYMMDD(new Date()),
        time: undefined,
        recurrence: undefined,
        monthlyRecurrenceType: undefined,
        recurrenceInterval: undefined,
        recurrenceDays: undefined,
        recurrenceEndType: 'forever',
        recurrenceEndDate: undefined,
        recurrenceCount: undefined,
      });
    } else if (frequency === 'single') {
      up.frequency = 'recurring';
      up.recurrence = undefined;
      up.recurrenceInterval = undefined;
      up.recurrenceDays = undefined;
      up.monthlyRecurrenceType = undefined;
      up.recurrenceEndType = 'count';
      up.recurrenceCount = 1;
      up.recurrenceEndDate = undefined;
    } else {
      up.frequency = 'recurring';
      up.time = undefined;
      if (!formData.recurrence) up.recurrence = 'monthly';
      up.recurrenceEndType = 'forever';
      up.recurrenceCount = undefined;
      up.recurrenceEndDate = undefined;
    }
    onFormChange(up);
    setIsFrequencyModalOpen(false);
    setIsFrequencyModalAnimating(false);
  };

  const handleApplyRecurrence = () => {
    onFormChange({
      recurrence: tempRecurrence as any,
      recurrenceInterval: tempRecurrenceInterval || 1,
      recurrenceDays: tempRecurrence === 'weekly' ? tempRecurrenceDays : undefined,
      monthlyRecurrenceType: tempRecurrence === 'monthly' ? tempMonthlyRecurrenceType : undefined,
    });
    setIsRecurrenceModalOpen(false);
    setIsRecurrenceModalAnimating(false);
  };

  const handleCloseReceiptMenu = useCallback(() => {
    setIsReceiptMenuOpen(false);
    setIsReceiptMenuAnimating(false);
    receiptMenuCloseTimeRef.current = Date.now();
  }, []);

  const handlePickReceipt = (e: React.MouseEvent, source: 'camera' | 'gallery') => {
    e.stopPropagation();
    e.preventDefault();

    const filePromise = pickImage(source);

    setTimeout(() => {
      handleCloseReceiptMenu();
    }, 500);

    filePromise
      .then(async (file) => {
        const { base64 } = await processImageFile(file);
        const currentReceipts = formDataRef.current.receipts || [];
        onFormChange({ receipts: [...currentReceipts, base64] });
      })
      .catch(e => {
        // User cancelled or error
      });
  };

  const handleRemoveReceipt = (index: number) => {
    const currentReceipts = formData.receipts || [];
    const newReceipts = currentReceipts.filter((_, i) => i !== index);
    onFormChange({ receipts: newReceipts });
  };

  const dynamicMonthlyDayOfWeekLabel = useMemo(() => {
    const ds = formData.date;
    if (!ds) return 'Seleziona una data di inizio valida';
    const d = parseLocalYYYYMMDD(ds);
    if (!d) return 'Data non valida';
    const dom = d.getUTCDate();
    const dow = d.getUTCDay();
    const wom = Math.floor((dom - 1) / 7);
    return `Ogni ${ordinalSuffixes[wom]} ${dayOfWeekNames[dow]} del mese`;
  }, [formData.date]);

  const getRecurrenceEndLabel = () => {
    const t = formData.recurrenceEndType;
    if (!t || t === 'forever') return 'Per sempre';
    if (t === 'date') return 'Fino a...';
    if (t === 'count') return 'Numero di volte';
    return 'Per sempre';
  };

  const renderImageViewer = () => {
    if (!viewingImage) return null;
    return createPortal(
      <div
        className="fixed inset-0 z-[6000] bg-black/95 flex items-center justify-center p-4 animate-fade-in-up"
        onClick={() => setViewingImage(null)}
      >
        <button
          className="absolute top-4 right-4 text-white/80 hover:text-white p-2 transition-colors z-50"
          onClick={() => setViewingImage(null)}
        >
          <XMarkIcon className="w-8 h-8" />
        </button>
        <img
          src={`data:image/png;base64,${viewingImage}`}
          className="max-w-full max-h-full object-contain rounded-sm shadow-2xl"
          alt="Ricevuta Full Screen"
          onClick={(e) => e.stopPropagation()}
        />
      </div>,
      document.body
    );
  };

  if (typeof formData.amount !== 'number') {
    return (
      <div
        ref={rootRef}
        tabIndex={-1}
        className="flex flex-col h-full dark:bg-midnight items-center justify-center p-4"
        {...tapBridgeHandlers}
      >
        <header className="p-4 flex items-center gap-4 text-slate-800 dark:text-white midnight-card shadow-sm absolute top-0 left-0 right-0 z-10 border-b border-transparent dark:border-electric-violet/20">
          {!isDesktop && (
            <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-midnight-card transition-colors" aria-label="Torna alla calcolatrice">
              <ArrowLeftIcon className="w-6 h-6" />
            </button>
          )}
          <h2 className="text-xl font-bold">Aggiungi Dettagli</h2>
        </header>
        <p className="text-slate-500 dark:text-slate-400 text-center">Nessun dato dall'importo. Torna indietro e inserisci una spesa.</p>
      </div>
    );
  }

  const isFrequencySet = !!formData.frequency;
  const selectedAccountLabel = accounts.find(a => a.id === formData.accountId)?.name;

  const accountOptions = useMemo(() =>
    accounts.map(a => ({ value: a.id, label: a.name })),
    [accounts]
  );

  const selectedToAccountLabel = accounts.find(a => a.id === formData.toAccountId)?.name;
  const toAccountOptions = useMemo(() =>
    accounts
      .filter(a => a.id !== formData.accountId)
      .map(a => ({ value: a.id, label: a.name })),
    [accounts, formData.accountId]
  );

  const categoryOptions = useMemo(() =>
    Object.keys(CATEGORIES).map(cat => ({
      value: cat,
      label: getCategoryStyle(cat).label,
      Icon: getCategoryStyle(cat).Icon,
      color: getCategoryStyle(cat).color,
      bgColor: getCategoryStyle(cat).bgColor,
    })),
    []
  );

  const subcategoryOptions = useMemo(() =>
    formData.category ? (CATEGORIES[formData.category]?.map(sub => ({ value: sub, label: sub })) || []) : [],
    [formData.category]
  );

  const DateTimeInputs = (
    <div className={`grid ${!formData.frequency ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
      <div>
        <label htmlFor="date" className={`block text-base font-medium mb-1 ${dateError ? 'text-red-600' : 'text-slate-700 dark:text-slate-300'}`}>
          {isSingleRecurring ? 'Data del Pagamento' : formData.frequency === 'recurring' ? 'Data di inizio' : 'Data'}
        </label>
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <CalendarIcon className="h-5 w-5 text-slate-400" />
          </div>
          <input
            id="date"
            name="date"
            type="date"
            value={formData.date || ''}
            onChange={handleInputChange}
            className={`block w-full rounded-md bg-sunset-cream dark:bg-midnight-card py-2.5 pl-10 pr-3 text-base text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none [color-scheme:light] dark:[color-scheme:dark] ${dateError ? 'border-red-500 ring-1 ring-red-500' : 'border border-slate-300 dark:border-electric-violet/30 focus:border-indigo-500 dark:focus:border-electric-violet focus:ring-1 focus:ring-indigo-500 dark:focus:ring-electric-violet'}`}
            enterKeyHint="done"
            onKeyDown={(e) => { if (e.key === 'Enter') { (e.currentTarget as HTMLInputElement).blur(); e.preventDefault(); } }}
            onFocus={(e) => e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' })}
          />
        </div>
        {dateError && <p className="mt-1 text-sm text-red-600">Per favore, imposta una data.</p>}
      </div>

      {!formData.frequency && (
        <div>
          <label htmlFor="time" className="block text-base font-medium text-slate-700 dark:text-slate-300 mb-1">Ora</label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <ClockIcon className="h-5 w-5 text-slate-400" />
            </div>
            <input
              id="time"
              name="time"
              type="time"
              value={formData.time || ''}
              onChange={handleInputChange}
              className="block w-full rounded-md border border-slate-300 dark:border-electric-violet/30 bg-sunset-cream/60 dark:bg-midnight-card/50 py-2.5 pl-10 pr-3 text-base text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 dark:focus:border-electric-violet focus:ring-1 focus:ring-indigo-500 dark:focus:ring-electric-violet [color-scheme:light] dark:[color-scheme:dark]"
              enterKeyHint="done"
              onKeyDown={(e) => { if (e.key === 'Enter') { (e.currentTarget as HTMLInputElement).blur(); e.preventDefault(); } }}
              onFocus={(e) => e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' })}
            />
          </div>
        </div>
      )}
    </div>
  );

  const canAttachReceipt = !isIncome && !isTransfer && !isAdjustment;

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      className="flex flex-col h-full bg-sunset-cream dark:bg-midnight focus:outline-none"
      style={{ touchAction: 'pan-y' }}
      {...tapBridgeHandlers}
    >
      <header className="p-4 flex items-center justify-between gap-4 text-slate-800 dark:text-white midnight-card shadow-sm sticky top-0 z-10 transition-colors border-b border-transparent dark:border-electric-violet/20">
        <div className="flex items-center gap-4">
          {!isDesktop && (
            <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-midnight-card transition-colors" aria-label="Torna alla calcolatrice">
              <ArrowLeftIcon className="w-6 h-6" />
            </button>
          )}
          <h2 className="text-xl font-bold">Aggiungi Dettagli</h2>
        </div>
        <div className="w-11 h-11" />
      </header>

      <main className="flex-1 p-4 flex flex-col overflow-y-auto" style={{ touchAction: 'pan-y' }}>
        <div className="space-y-2">
          <div className="flex justify-center items-center py-0">
            <div className={`relative flex items-baseline justify-center ${isIncome ? 'text-green-600' : isTransfer ? 'text-sky-600' : isAdjustment ? 'text-slate-600' : 'text-indigo-600'}`}>
              <span className="text-[2.6rem] leading-none font-bold tracking-tighter relative z-10">
                {isAdjustment
                  ? formatCurrency(formData.amount || 0).replace(/[€\s]/g, '')
                  : formatCurrency(Math.abs(formData.amount || 0)).replace(/[^0-9,.]/g, '')}
              </span>
              {!isAdjustment && (
                <span className={`text-3xl font-medium opacity-70 absolute ${isIncome ? 'text-green-400' : isTransfer ? 'text-sky-400' : 'text-indigo-400'}`} style={{ right: '100%', marginRight: '8px', top: '4px' }}>
                  {isIncome ? '+' : isTransfer ? '' : '-'}
                </span>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="description" className="block text-base font-medium text-slate-700 dark:text-slate-300 mb-1">Descrizione</label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <DocumentTextIcon className="h-5 w-5 text-slate-400" />
              </div>
              <input
                ref={descriptionInputRef}
                id="description"
                name="description"
                type="text"
                value={formData.description || ''}
                onChange={handleInputChange}
                className="block w-full rounded-md border border-slate-300 dark:border-electric-violet/30 bg-sunset-cream dark:bg-midnight-card py-2.5 pl-10 pr-3 text-base text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 dark:focus:border-electric-violet focus:ring-1 focus:ring-indigo-500 dark:focus:ring-electric-violet"
                placeholder="Es. Caffè al bar"
                enterKeyHint="done"
                onKeyDown={(e) => { if (e.key === 'Enter') { (e.currentTarget as HTMLInputElement).blur(); e.preventDefault(); } }}
              />
            </div>
          </div>

          {isTransfer ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-base font-medium text-slate-700 dark:text-slate-300 mb-1">Da Conto</label>
                <button
                  type="button"
                  onClick={() => setActiveMenu('account')}
                  className="w-full flex items-center text-left gap-2 px-3 py-2.5 text-base rounded-lg border shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors bg-sunset-cream dark:bg-midnight-card border-slate-300 dark:border-electric-violet/30 hover:bg-sunset-peach/30 dark:hover:bg-midnight-card text-sunset-text dark:text-white"
                >
                  <CreditCardIcon className="h-7 w-7 text-slate-400" />
                  <span className="truncate flex-1">{selectedAccountLabel || 'Seleziona'}</span>
                  <ChevronDownIcon className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              <div>
                <label className="block text-base font-medium text-slate-700 dark:text-slate-300 mb-1">A Conto</label>
                <button
                  type="button"
                  onClick={() => setActiveMenu('toAccount')}
                  className="w-full flex items-center text-left gap-2 px-3 py-2.5 text-base rounded-lg border shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors btn-field hover:bg-sunset-peach/30 dark:hover:bg-midnight-card text-sunset-text dark:text-white"
                >
                  <CreditCardIcon className="h-7 w-7 text-slate-400" />
                  <span className="truncate flex-1">{selectedToAccountLabel || 'Seleziona'}</span>
                  <ChevronDownIcon className="w-5 h-5 text-slate-500" />
                </button>
              </div>
            </div>
          ) : (
            <div className={`grid ${isIncome ? 'grid-cols-1' : 'grid-cols-1 gap-4'}`}>
              <div>
                <label className="block text-base font-medium text-slate-700 dark:text-slate-300 mb-1">Conto</label>
                <button
                  type="button"
                  onClick={() => setActiveMenu('account')}
                  className="w-full flex items-center text-left gap-2 px-3 py-2.5 text-base rounded-lg border shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors btn-field hover:bg-sunset-peach/30 dark:hover:bg-midnight-card text-sunset-text dark:text-white"
                >
                  <CreditCardIcon className="h-7 w-7 text-slate-400" />
                  <span className="truncate flex-1">{selectedAccountLabel || 'Seleziona'}</span>
                  <ChevronDownIcon className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              {!isIncome && !isAdjustment && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-base font-medium text-slate-700 dark:text-slate-300 mb-1">Categoria</label>
                    <button
                      type="button"
                      onClick={() => setActiveMenu('category')}
                      className="w-full flex items-center text-left gap-2 px-3 py-2.5 text-base rounded-lg border shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors btn-field hover:bg-sunset-peach/30 dark:hover:bg-midnight-card text-sunset-text dark:text-white"
                    >
                      <TagIcon className="h-6 w-6 text-slate-400" />
                      <span className="truncate flex-1">{formData.category ? getCategoryStyle(formData.category).label : 'Seleziona'}</span>
                      <ChevronDownIcon className="w-5 h-5 text-slate-500" />
                    </button>
                  </div>
                  <div>
                    <label className="block text-base font-medium text-slate-700 dark:text-slate-300 mb-1">Sottocategoria</label>
                    <button
                      type="button"
                      onClick={() => setActiveMenu('subcategory')}
                      disabled={!formData.category}
                      className={`w-full flex items-center text-left gap-2 px-3 py-2.5 text-base rounded-lg border shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors btn-field hover:bg-sunset-peach/30 dark:hover:bg-midnight-card text-sunset-text dark:text-white ${!formData.category ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}
                    >
                      <TagIcon className="h-6 w-6 text-slate-400" />
                      <span className="truncate flex-1">{formData.subcategory || 'Seleziona'}</span>
                      <ChevronDownIcon className="w-5 h-5 text-slate-500" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {!isFrequencySet && DateTimeInputs}

          {canAttachReceipt && (
            <div>
              <label className="block text-base font-medium text-slate-700 dark:text-slate-300 mb-1">Ricevuta</label>

              {formData.receipts && formData.receipts.length > 0 && (
                <div className="grid grid-cols-2 gap-2 mb-2">
                  {formData.receipts.map((receipt, index) => (
                    <div
                      key={index}
                      className="relative rounded-lg overflow-hidden border border-sunset-coral/20 dark:border-electric-violet/30 shadow-sm aspect-video bg-sunset-cream/40 dark:bg-midnight-card/50 cursor-pointer hover:border-sunset-coral/50 dark:hover:border-electric-violet transition-colors"
                      onClick={() => setViewingImage(receipt)}
                    >
                      <img
                        src={`data:image/png;base64,${receipt}`}
                        alt="Ricevuta"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveReceipt(index);
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        className="absolute top-1 right-1 p-1.5 bg-sunset-cream/90 dark:bg-midnight/90 text-red-600 dark:text-rose-400 rounded-full shadow-md hover:bg-red-50 dark:hover:bg-midnight transition-colors z-10 flex items-center justify-center"
                        aria-label="Rimuovi ricevuta"
                      >
                        <XMarkIcon className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  if (Date.now() - receiptMenuCloseTimeRef.current < 500) return;
                  setIsReceiptMenuOpen(true);
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-base rounded-lg border border-dashed border-sunset-coral/50 dark:border-electric-violet/50 bg-sunset-peach/30 dark:bg-electric-violet/10 text-sunset-text dark:text-electric-violet hover:bg-sunset-peach/50 dark:hover:bg-electric-violet/20 hover:border-sunset-coral transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <PaperClipIcon className="w-5 h-5" />
                <span>{formData.receipts && formData.receipts.length > 0 ? 'Aggiungi un\'altra ricevuta' : 'Allega Ricevuta'}</span>
              </button>
            </div>
          )}

          {!isIncome && !isTransfer && !isAdjustment && (
            <div className="midnight-card p-4 rounded-lg border border-sunset-coral/20 dark:border-electric-violet/20 space-y-4">
              <div>
                <label className="block text-base font-medium text-slate-700 dark:text-slate-300 mb-1">Frequenza</label>
                <button
                  type="button"
                  onClick={() => setIsFrequencyModalOpen(true)}
                  className={`w-full flex items-center justify-between text-left gap-2 px-3 py-2.5 text-base rounded-lg border shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors ${isFrequencySet
                    ? 'bg-sunset-cream/60 dark:bg-midnight-card/50 border-slate-300 dark:border-electric-violet/30 text-slate-800 dark:text-white hover:bg-sunset-peach/30 dark:hover:bg-midnight-card'
                    : 'btn-field dark:bg-midnight-card/30 text-sunset-text dark:text-slate-400 hover:bg-sunset-peach/30 dark:hover:bg-midnight-card'
                    }`}
                >
                  <span className="truncate flex-1 capitalize">
                    {isSingleRecurring ? 'Singolo' : formData.frequency === 'recurring' ? 'Ricorrente' : 'Nessuna'}
                  </span>
                  <ChevronDownIcon className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              {isFrequencySet && DateTimeInputs}

              {formData.frequency === 'recurring' && !isSingleRecurring && (
                <div>
                  <label className="block text-base font-medium text-slate-700 dark:text-slate-300 mb-1">Ricorrenza</label>
                  <button
                    type="button"
                    onClick={() => setIsRecurrenceModalOpen(true)}
                    className="w-full flex items-center justify-between text-left gap-2 px-3 py-2.5 text-base rounded-lg border shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors bg-sunset-cream/60 dark:bg-midnight-card/50 border-slate-300 dark:border-electric-violet/30 text-slate-800 dark:text-white hover:bg-sunset-peach/30 dark:hover:bg-midnight-card"
                  >
                    <span className="truncate flex-1">{getRecurrenceSummary(formData)}</span>
                    <ChevronDownIcon className="w-5 h-5 text-slate-500" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-auto pt-6">
          <button
            type="button"
            onClick={() => onSubmit(formData as Omit<Expense, 'id'>)}
            disabled={(Math.abs(formData.amount ?? 0) <= 0 && !isAdjustment) || (isTransfer && (!formData.toAccountId || formData.toAccountId === formData.accountId))}
            className={`w-full px-4 py-3 text-base font-semibold text-white rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 ${isIncome
              ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500 disabled:bg-green-300'
              : isTransfer
                ? 'bg-sky-600 hover:bg-sky-700 focus:ring-sky-500 disabled:bg-sky-300'
                : isAdjustment
                  ? 'bg-slate-600 hover:bg-slate-700 focus:ring-slate-500 dark:bg-midnight-card dark:border-electric-violet/30 dark:hover:bg-midnight-card/80'
                  : 'btn-electric text-white shadow-lg shadow-indigo-500/30'
              }`}
          >
            {isTransfer ? 'Conferma Trasferimento' : isIncome ? 'Aggiungi Entrata' : isAdjustment ? 'Salva Rettifica' : 'Aggiungi Spesa'}
          </button>
        </div>
      </main>

      <SelectionMenu
        isOpen={activeMenu === 'account'}
        onClose={() => setActiveMenu(null)}
        title="Seleziona un Conto"
        options={accountOptions}
        selectedValue={formData.accountId || ''}
        onSelect={handleAccountSelect}
      />

      <SelectionMenu
        isOpen={activeMenu === 'toAccount'}
        onClose={() => setActiveMenu(null)}
        title="Trasferisci A"
        options={toAccountOptions}
        selectedValue={formData.toAccountId || ''}
        onSelect={handleToAccountSelect}
      />

      <SelectionMenu
        isOpen={activeMenu === 'category'}
        onClose={() => setActiveMenu(null)}
        title="Seleziona Categoria"
        options={categoryOptions}
        selectedValue={formData.category || ''}
        onSelect={handleCategorySelect}
      />

      <SelectionMenu
        isOpen={activeMenu === 'subcategory'}
        onClose={() => setActiveMenu(null)}
        title="Seleziona Sottocategoria"
        options={subcategoryOptions}
        selectedValue={formData.subcategory || ''}
        onSelect={handleSubcategorySelect}
      />

      <Modal
        isOpen={isFrequencyModalOpen}
        isAnimating={isFrequencyModalAnimating}
        onClose={() => { setIsFrequencyModalOpen(false); setIsFrequencyModalAnimating(false); }}
        title="Seleziona Frequenza"
      >
        <div className="p-4 space-y-2">
          <button onClick={() => handleFrequencySelect('none')} className="w-full px-4 py-3 text-base font-semibold rounded-lg bg-sunset-cream/50 dark:bg-midnight-card/50 border border-transparent dark:border-electric-violet/20 text-sunset-text dark:text-white hover:bg-sunset-peach/50 dark:hover:bg-indigo-900/40 hover:text-sunset-coral dark:hover:text-indigo-300 transition-colors">Nessuna</button>
          <button onClick={() => handleFrequencySelect('single')} className="w-full px-4 py-3 text-base font-semibold rounded-lg bg-sunset-cream/50 dark:bg-midnight-card/50 border border-transparent dark:border-electric-violet/20 text-sunset-text dark:text-white hover:bg-sunset-peach/50 dark:hover:bg-indigo-900/40 hover:text-sunset-coral dark:hover:text-indigo-300 transition-colors">Singolo</button>
          <button onClick={() => handleFrequencySelect('recurring')} className="w-full px-4 py-3 text-base font-semibold rounded-lg bg-sunset-cream/50 dark:bg-midnight-card/50 border border-transparent dark:border-electric-violet/20 text-sunset-text dark:text-white hover:bg-sunset-peach/50 dark:hover:bg-indigo-900/40 hover:text-sunset-coral dark:hover:text-indigo-300 transition-colors">Ricorrente</button>
        </div>
      </Modal>

      <Modal
        isOpen={isReceiptMenuOpen}
        isAnimating={isReceiptMenuAnimating}
        onClose={handleCloseReceiptMenu}
        title="Allega Ricevuta"
      >
        <div className="p-4 grid grid-cols-2 gap-4">
          <button
            onClick={(e) => handlePickReceipt(e, 'camera')}
            className="flex flex-col items-center justify-center gap-3 p-4 rounded-xl bg-sunset-cream/50 dark:bg-midnight-card/50 border border-sunset-coral/20 dark:border-electric-violet/30 hover:bg-sunset-peach/50 dark:hover:bg-electric-violet/20 hover:border-sunset-coral/50 transition-colors"
          >
            <div className="w-12 h-12 rounded-full bg-sunset-cream dark:bg-electric-violet/20 flex items-center justify-center shadow-sm text-sunset-coral dark:text-electric-violet">
              <CameraIcon className="w-7 h-7" />
            </div>
            <span className="font-semibold text-slate-700 dark:text-slate-200">Fotocamera</span>
          </button>
          <button
            onClick={(e) => handlePickReceipt(e, 'gallery')}
            className="flex flex-col items-center justify-center gap-3 p-4 rounded-xl bg-sunset-cream/50 dark:bg-midnight-card/50 border border-sunset-coral/20 dark:border-electric-violet/30 hover:bg-sunset-peach/50 dark:hover:bg-electric-pink/20 hover:border-sunset-coral/50 transition-colors"
          >
            <div className="w-12 h-12 rounded-full bg-sunset-cream dark:bg-electric-pink/20 flex items-center justify-center shadow-sm text-sunset-pink dark:text-electric-pink">
              <PhotoIcon className="w-7 h-7" />
            </div>
            <span className="font-semibold text-slate-700 dark:text-slate-200">Galleria</span>
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={isRecurrenceModalOpen}
        isAnimating={isRecurrenceModalAnimating}
        onClose={() => { setIsRecurrenceModalOpen(false); setIsRecurrenceModalAnimating(false); }}
        title="Imposta Ricorrenza"
      >
        <main className="p-4 space-y-4">
          <div className="relative">
            <button
              onClick={() => { setIsRecurrenceOptionsOpen(v => !v); setIsRecurrenceEndOptionsOpen(false); }}
              className="w-full flex items-center justify-between text-left gap-2 px-3 py-2.5 text-base rounded-lg border shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 bg-sunset-cream/60 dark:bg-midnight-card border-slate-300 dark:border-electric-violet/30 text-sunset-text dark:text-white hover:bg-sunset-peach/30 dark:hover:bg-midnight-card"
            >
              <span className="truncate flex-1 capitalize">
                {recurrenceLabels[(tempRecurrence || 'monthly') as keyof typeof recurrenceLabels]}
              </span>
              <ChevronDownIcon className={`w-5 h-5 text-slate-500 transition-transform ${isRecurrenceOptionsOpen ? 'rotate-180' : ''}`} />
            </button>

            {isRecurrenceOptionsOpen && (
              <div className="absolute top-full mt-1 w-full bg-sunset-cream dark:midnight-card border border-sunset-coral/20 dark:border-electric-violet/30 shadow-lg rounded-lg z-20 p-2 space-y-1 animate-fade-in-down">
                {(Object.keys(recurrenceLabels) as Array<keyof typeof recurrenceLabels>).map((k) => (
                  <button
                    key={k}
                    onClick={() => { setTempRecurrence(k as any); setIsRecurrenceOptionsOpen(false); }}
                    className="w-full text-left px-4 py-3 text-base font-semibold rounded-lg bg-sunset-cream/50 dark:bg-midnight-card text-slate-800 dark:text-white hover:bg-sunset-peach/50 hover:text-sunset-coral dark:hover:bg-indigo-900/50 dark:hover:text-indigo-300 transition-colors"
                  >
                    {recurrenceLabels[k]}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="pt-2">
            <div className="flex items-center justify-center gap-2 bg-sunset-cream/60 dark:bg-midnight-card/50 p-3 rounded-lg">
              <span className="text-base text-slate-700 dark:text-slate-300">Ogni</span>
              <input
                type="number"
                value={tempRecurrenceInterval || ''}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '') setTempRecurrenceInterval(undefined);
                  else {
                    const n = parseInt(v, 10);
                    if (!isNaN(n) && n > 0) setTempRecurrenceInterval(n);
                  }
                }}
                onFocus={(e) => e.currentTarget.select()}
                className="w-12 text-center text-lg font-bold text-slate-800 dark:text-white bg-transparent border-0 border-b-2 border-slate-400 focus:ring-0 focus:outline-none focus:border-sunset-coral dark:focus:border-electric-violet p-0"
                min={1}
              />
              <span className="text-base text-slate-700 dark:text-slate-300">{getIntervalLabel(tempRecurrence as any, tempRecurrenceInterval)}</span>
            </div>
          </div>

          {tempRecurrence === 'weekly' && (
            <div className="pt-2">
              <div className="flex flex-wrap justify-center gap-2">
                {daysOfWeekForPicker.map(d => (
                  <button
                    key={d.value}
                    onClick={() => {
                      setTempRecurrenceDays(prev => {
                        const arr = prev || [];
                        const next = arr.includes(d.value)
                          ? arr.filter(x => x !== d.value)
                          : [...arr, d.value];
                        return next.sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b));
                      });
                    }}
                    className={`w-14 h-14 rounded-full text-sm font-semibold border-2 transition-colors ${(tempRecurrenceDays || []).includes(d.value)
                      ? 'btn-electric text-white border-transparent'
                      : 'bg-sunset-cream/60 dark:bg-midnight-card/50 text-sunset-text dark:text-slate-300 border-slate-300 dark:border-electric-violet/30 hover:bg-sunset-peach/30 dark:hover:bg-midnight-card'
                      }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {tempRecurrence === 'monthly' && (
            <div className="pt-4 space-y-2 border-t border-slate-200">
              <div
                role="radio"
                aria-checked={tempMonthlyRecurrenceType === 'dayOfMonth'}
                onClick={() => setTempMonthlyRecurrenceType('dayOfMonth')}
                className="flex items-center gap-3 p-2 cursor-pointer rounded-lg hover:bg-sunset-cream/50 dark:hover:bg-midnight-card"
              >
                <div className="w-5 h-5 rounded-full border-2 border-slate-400 flex items-center justify-center flex-shrink-0">{tempMonthlyRecurrenceType === 'dayOfMonth' && <div className="w-2.5 h-2.5 bg-indigo-600 dark:bg-electric-violet rounded-full" />}</div>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Lo stesso giorno di ogni mese</span>
              </div>

              <div
                role="radio"
                aria-checked={tempMonthlyRecurrenceType === 'dayOfWeek'}
                onClick={() => setTempMonthlyRecurrenceType('dayOfWeek')}
                className="flex items-center gap-3 p-2 cursor-pointer rounded-lg hover:bg-sunset-cream"
              >
                <div className="w-5 h-5 rounded-full border-2 border-slate-400 flex items-center justify-center flex-shrink-0">{tempMonthlyRecurrenceType === 'dayOfWeek' && <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full" />}</div>
                <span className="text-sm font-medium text-slate-700">{dynamicMonthlyDayOfWeekLabel}</span>
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-slate-200">
            <div className="grid grid-cols-2 gap-4 items-end">
              <div className={`relative ${!formData.recurrenceEndType || formData.recurrenceEndType === 'forever' ? 'col-span-2' : ''}`}>
                <button
                  type="button"
                  onClick={() => { setIsRecurrenceEndOptionsOpen(v => !v); setIsRecurrenceOptionsOpen(false); }}
                  className="w-full flex items-center justify-between text-left gap-2 px-3 py-2.5 text-base rounded-lg border shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-electric-violet bg-sunset-cream/60 dark:bg-midnight-card border-slate-300 dark:border-electric-violet/30 text-sunset-text dark:text-white hover:bg-sunset-peach/30 dark:hover:bg-midnight-card/80"
                >
                  <span className="truncate flex-1 capitalize">
                    {getRecurrenceEndLabel()}
                  </span>
                  <ChevronDownIcon className={`w-5 h-5 text-slate-500 dark:text-slate-400 transition-transform ${isRecurrenceEndOptionsOpen ? 'rotate-180' : ''}`} />
                </button>

                {isRecurrenceEndOptionsOpen && (
                  <div className="absolute top-full mt-1 w-full bg-sunset-cream dark:midnight-card border border-sunset-coral/20 dark:border-electric-violet/30 shadow-lg rounded-lg z-20 p-2 space-y-1 animate-fade-in-down">
                    {(['forever', 'date', 'count'] as const).map(k => (
                      <button
                        key={k}
                        onClick={() => {
                          if (k === 'forever') onFormChange({ recurrenceEndType: 'forever', recurrenceEndDate: undefined, recurrenceCount: undefined });
                          if (k === 'date') onFormChange({ recurrenceEndType: 'date', recurrenceEndDate: formData.recurrenceEndDate || toYYYYMMDD(new Date()), recurrenceCount: undefined });
                          if (k === 'count') onFormChange({ recurrenceEndType: 'count', recurrenceCount: formData.recurrenceCount || 1, recurrenceEndDate: undefined });
                          setIsRecurrenceEndOptionsOpen(false);
                        }}
                        className="w-full text-left px-4 py-3 text-base font-semibold rounded-lg bg-sunset-cream/50 dark:bg-midnight-card text-slate-800 dark:text-white hover:bg-sunset-peach/50 hover:text-sunset-coral dark:hover:bg-indigo-900/50 dark:hover:text-indigo-300 transition-colors"
                      >
                        {k === 'forever' ? 'Per sempre' : k === 'date' ? 'Fino a' : 'Numero di volte'}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {formData.recurrenceEndType === 'date' && (
                <div>
                  <label htmlFor="recurrence-end-date" className="relative w-full flex items-center justify-center gap-2 px-3 py-2.5 text-base rounded-lg focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500 dark:focus-within:ring-electric-violet text-indigo-600 dark:text-electric-violet hover:bg-indigo-100 dark:hover:bg-electric-violet/20 font-semibold cursor-pointer h-[46.5px]">
                    <CalendarIcon className="w-5 h-5" />
                    <span>{formData.recurrenceEndDate ? formatShortDate(formData.recurrenceEndDate) : 'Seleziona'}</span>
                    <input
                      type="date"
                      id="recurrence-end-date"
                      name="recurrenceEndDate"
                      value={formData.recurrenceEndDate || ''}
                      onChange={handleInputChange}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                    />
                  </label>
                </div>
              )}

              {formData.recurrenceEndType === 'count' && (
                <div>
                  <div className="relative">
                    <input
                      type="number"
                      id="recurrence-count"
                      name="recurrenceCount"
                      value={formData.recurrenceCount || ''}
                      onChange={handleInputChange}
                      className="block w-full text-center rounded-md border border-slate-300 dark:border-electric-violet/30 bg-sunset-cream/60 dark:bg-midnight-card py-2.5 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 dark:focus:border-electric-violet focus:ring-1 focus:ring-indigo-500 dark:focus:ring-electric-violet text-base"
                      placeholder="N."
                      min="1"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>

        <footer className="p-4 bg-sunset-cream dark:bg-midnight border-t border-slate-200 dark:border-electric-violet/20 flex justify-end">
          <button
            type="button"
            onClick={handleApplyRecurrence}
            className="px-4 py-2 text-sm font-bold text-white btn-electric rounded-xl shadow-lg transition-all active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Applica
          </button>
        </footer>
      </Modal>

      {renderImageViewer()}
    </div>
  );
};

export default TransactionDetailPage;
