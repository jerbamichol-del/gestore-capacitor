
// components/ExpenseForm.tsx
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Expense, Account, CATEGORIES } from '../types';
import { XMarkIcon } from './icons/XMarkIcon';
import { DocumentTextIcon } from './icons/DocumentTextIcon';
import { CurrencyEuroIcon } from './icons/CurrencyEuroIcon';
import { CalendarIcon } from './icons/CalendarIcon';
import { TagIcon } from './icons/TagIcon';
import { CreditCardIcon } from './icons/CreditCardIcon';
import { TrashIcon } from './icons/TrashIcon'; // Import mantenuto se servisse altrove
import SelectionMenu from './SelectionMenu';
import { getCategoryStyle } from '../utils/categoryStyles';
import { ClockIcon } from './icons/ClockIcon';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { formatDate } from './icons/formatters';
import ConfirmationModal from './ConfirmationModal';
import { PaperClipIcon } from './icons/PaperClipIcon';
import { CameraIcon } from './icons/CameraIcon';
import { PhotoIcon } from './icons/PhotoIcon';
import { pickImage, processImageFile } from '../utils/fileHelper';
import { parseLocalYYYYMMDD, toYYYYMMDD } from '../utils/date';

interface ExpenseFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<Expense, 'id'> | Expense) => void;
  initialData?: Expense;
  prefilledData?: Partial<Omit<Expense, 'id'>>;
  accounts: Account[];
  isForRecurringTemplate?: boolean;
}

const getCurrentTime = () => new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
const getTodayString = () => toYYYYMMDD(new Date());

interface FormInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  id: string; name: string; label: string; value: string | number | readonly string[] | undefined;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; icon: React.ReactNode;
}

const FormInput = React.memo(React.forwardRef<HTMLInputElement, FormInputProps>(({ id, name, label, value, onChange, icon, ...props }, ref) => {
  return (
    <div>
      <label htmlFor={id} className="block text-base font-medium text-slate-700 dark:text-slate-300 mb-1">{label}</label>
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          {icon}
        </div>
        <input ref={ref} id={id} name={name} value={value || ''} onChange={onChange} className="block w-full rounded-md border border-slate-300 dark:border-electric-violet/30 bg-sunset-cream dark:bg-midnight-card py-2.5 pl-10 pr-3 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 dark:focus:border-electric-violet focus:ring-1 focus:ring-indigo-500 dark:focus:ring-electric-violet text-base" {...props} />
      </div>
    </div>
  );
}));
FormInput.displayName = 'FormInput';

const recurrenceLabels: Record<'daily' | 'weekly' | 'monthly' | 'yearly', string> = { daily: 'Giornaliera', weekly: 'Settimanale', monthly: 'Mensile', yearly: 'Annuale' };
const daysOfWeekLabels = { 0: 'Dom', 1: 'Lun', 2: 'Mar', 3: 'Mer', 4: 'Gio', 5: 'Ven', 6: 'Sab' };
const dayOfWeekNames = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
const ordinalSuffixes = ['primo', 'secondo', 'terzo', 'quarto', 'ultimo'];

const formatShortDate = (dateString: string | undefined): string => {
  if (!dateString) return '';
  const date = parseLocalYYYYMMDD(dateString);
  if (!date) return '';
  return new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short' }).format(date);
};

const getRecurrenceSummary = (expense: Partial<Expense>): string => {
  if (expense.frequency !== 'recurring' || !expense.recurrence) return 'Imposta ricorrenza';
  const { recurrence, recurrenceInterval = 1, recurrenceDays, monthlyRecurrenceType, date: dateString, recurrenceEndType = 'forever', recurrenceEndDate, recurrenceCount } = expense;
  let summary = '';
  if (recurrenceInterval === 1) summary = recurrenceLabels[recurrence];
  else {
    switch (recurrence) {
      case 'daily': summary = `Ogni ${recurrenceInterval} giorni`; break;
      case 'weekly': summary = `Ogni ${recurrenceInterval} sett.`; break;
      case 'monthly': summary = `Ogni ${recurrenceInterval} mesi`; break;
      case 'yearly': summary = `Ogni ${recurrenceInterval} anni`; break;
    }
  }
  if (recurrence === 'weekly' && recurrenceDays && recurrenceDays.length > 0) {
    const orderedDays = [...recurrenceDays].sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b));
    const dayLabels = orderedDays.map(d => daysOfWeekLabels[d as keyof typeof daysOfWeekLabels]);
    summary += `: ${dayLabels.join(', ')}`;
  }
  if (recurrence === 'monthly' && monthlyRecurrenceType === 'dayOfWeek' && dateString) {
    const date = parseLocalYYYYMMDD(dateString);
    if (date) {
      const dayOfMonth = date.getDate(); const dayOfWeek = date.getDay();
      const weekOfMonth = Math.floor((dayOfMonth - 1) / 7);
      const dayName = dayOfWeekNames[dayOfWeek].substring(0, 3);
      const ordinal = ordinalSuffixes[weekOfMonth];
      summary += ` (${ordinal} ${dayName}.)`;
    }
  }
  if (recurrenceEndType === 'date' && recurrenceEndDate) summary += `, fino al ${formatShortDate(recurrenceEndDate)}`;
  else if (recurrenceEndType === 'count' && recurrenceCount && recurrenceCount > 0) summary += `, ${recurrenceCount} volte`;
  return summary;
};

const getIntervalLabel = (recurrence?: 'daily' | 'weekly' | 'monthly' | 'yearly', interval?: number) => {
  const count = interval || 1;
  switch (recurrence) {
    case 'daily': return count === 1 ? 'giorno' : 'giorni';
    case 'weekly': return count === 1 ? 'settimana' : 'settimane';
    case 'monthly': return count === 1 ? 'mese' : 'mesi';
    case 'yearly': return count === 1 ? 'anno' : 'anni';
    default: return 'mese';
  }
};

const daysOfWeekForPicker = [{ label: 'Lun', value: 1 }, { label: 'Mar', value: 2 }, { label: 'Mer', value: 3 }, { label: 'Gio', value: 4 }, { label: 'Ven', value: 5 }, { label: 'Sab', value: 6 }, { label: 'Dom', value: 0 }];

const ExpenseForm: React.FC<ExpenseFormProps> = ({ isOpen, onClose, onSubmit, initialData, prefilledData, accounts, isForRecurringTemplate = false }) => {
  const safeAccounts = useMemo(() => accounts || [], [accounts]);

  const [isMounted, setIsMounted] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isClosableByBackdrop, setIsClosableByBackdrop] = useState(false);

  const [formData, setFormData] = useState<Partial<Omit<Expense, 'id' | 'amount'>> & { amount?: number | string }>({});

  const [error, setError] = useState<string | null>(null);

  const [activeMenu, setActiveMenu] = useState<'category' | 'subcategory' | 'account' | 'toAccount' | 'frequency' | null>(null);

  const [originalExpenseState, setOriginalExpenseState] = useState<Partial<Expense> | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [isConfirmCloseOpen, setIsConfirmCloseOpen] = useState(false);

  // Recurrence Modal State
  const [isRecurrenceModalOpen, setIsRecurrenceModalOpen] = useState(false);
  const [isRecurrenceModalAnimating, setIsRecurrenceModalAnimating] = useState(false);
  const [isRecurrenceOptionsOpen, setIsRecurrenceOptionsOpen] = useState(false);
  const [isRecurrenceEndOptionsOpen, setIsRecurrenceEndOptionsOpen] = useState(false);
  const [tempRecurrence, setTempRecurrence] = useState(formData.recurrence);
  const [tempRecurrenceInterval, setTempRecurrenceInterval] = useState<number | undefined>(formData.recurrenceInterval);
  const [tempRecurrenceDays, setTempRecurrenceDays] = useState<number[] | undefined>(formData.recurrenceDays);
  const [tempMonthlyRecurrenceType, setTempMonthlyRecurrenceType] = useState(formData.monthlyRecurrenceType);
  const [tagInput, setTagInput] = useState('');

  // Split Bill State
  const [isSplitActive, setIsSplitActive] = useState(false);
  const [splitParticipants, setSplitParticipants] = useState(2);

  // Receipt Modal State
  const [isReceiptMenuOpen, setIsReceiptMenuOpen] = useState(false);
  const [isReceiptMenuAnimating, setIsReceiptMenuAnimating] = useState(false);
  const receiptMenuCloseTimeRef = useRef(0);

  // State per visualizzazione immagine a schermo intero
  const [viewingImage, setViewingImage] = useState<string | null>(null);

  const amountInputRef = useRef<HTMLInputElement>(null);
  const descriptionInputRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  const isEditing = !!initialData;
  const isSingleRecurring = formData.frequency === 'recurring' && formData.recurrenceEndType === 'count' && formData.recurrenceCount === 1;
  const isIncome = formData.type === 'income';
  const isTransfer = formData.type === 'transfer';

  const dynamicMonthlyDayOfWeekLabel = useMemo(() => {
    const dateString = formData.date;
    if (!dateString) return "Seleziona una data di inizio valida";
    const date = parseLocalYYYYMMDD(dateString);
    if (!date) return "Data non valida";
    const dayOfMonth = date.getDate(); const dayOfWeek = date.getDay();
    const weekOfMonth = Math.floor((dayOfMonth - 1) / 7);
    return `Ogni ${ordinalSuffixes[weekOfMonth]} ${dayOfWeekNames[dayOfWeek]} del mese`;
  }, [formData.date]);

  const resetForm = useCallback(() => {
    const defaultAccountId = safeAccounts.length > 0 ? safeAccounts[0].id : '';
    setFormData({
      description: '',
      amount: '',
      date: getTodayString(),
      time: getCurrentTime(),
      category: '',
      subcategory: '',
      accountId: defaultAccountId,
      toAccountId: '', // Reset transfer destination
      frequency: 'single',
      tags: [],
      receipts: [],
    });
    setError(null);
    setOriginalExpenseState(null);
  }, [safeAccounts]);

  const forceClose = () => {
    setIsAnimating(false);
    setTimeout(onClose, 300);
  };

  const handleClose = () => {
    if (isEditing && hasChanges) {
      setIsConfirmCloseOpen(true);
    } else {
      forceClose();
    }
  };

  const handleBackdropClick = () => {
    if (isClosableByBackdrop) {
      handleClose();
    }
  };

  // Handle data initialization when the form opens
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        const dataWithTime = {
          ...initialData,
          time: initialData.time || getCurrentTime(),
          frequency: isForRecurringTemplate ? 'recurring' : (initialData.frequency || 'single')
        };
        setFormData(dataWithTime);
        setOriginalExpenseState(dataWithTime);
      } else if (prefilledData) {
        setFormData({
          description: prefilledData.description || '',
          amount: prefilledData.amount || '',
          date: prefilledData.date || getTodayString(),
          time: prefilledData.time || getCurrentTime(),
          category: prefilledData.category || '',
          subcategory: prefilledData.subcategory || '',
          accountId: prefilledData.accountId || (safeAccounts.length > 0 ? safeAccounts[0].id : ''),
          toAccountId: prefilledData.toAccountId || '',
          frequency: 'single',
          tags: prefilledData.tags || [],
          receipts: prefilledData.receipts || [],
        });
        setOriginalExpenseState(null);
      } else {
        resetForm();
      }
      setHasChanges(false);

      // Trigger mount animation
      requestAnimationFrame(() => {
        setIsMounted(true);
        setTimeout(() => setIsAnimating(true), 10);
      });

      const focusTimer = setTimeout(() => {
        titleRef.current?.focus();
      }, 100);

      const closableTimer = setTimeout(() => {
        setIsClosableByBackdrop(true);
      }, 400);

      document.body.style.overflow = 'hidden';

      return () => {
        clearTimeout(focusTimer);
        clearTimeout(closableTimer);
        document.body.style.overflow = '';
      };
    } else {
      setIsMounted(false);
      setIsAnimating(false);
      setIsClosableByBackdrop(false);
      document.body.style.overflow = '';
    }
  }, [isOpen, initialData, prefilledData, isForRecurringTemplate, safeAccounts, resetForm]);

  useEffect(() => {
    if (isRecurrenceModalOpen) {
      setTempRecurrence(formData.recurrence || 'monthly');
      setTempRecurrenceInterval(formData.recurrenceInterval || 1);
      setTempRecurrenceDays(formData.recurrenceDays || []);
      setTempMonthlyRecurrenceType(formData.monthlyRecurrenceType || 'dayOfMonth');
      setIsRecurrenceOptionsOpen(false);
      const timer = setTimeout(() => setIsRecurrenceModalAnimating(true), 10);
      return () => clearTimeout(timer);
    } else {
      setIsRecurrenceModalAnimating(false);
    }
  }, [isRecurrenceModalOpen, formData.recurrence, formData.recurrenceInterval, formData.recurrenceDays, formData.monthlyRecurrenceType]);

  useEffect(() => {
    if (isReceiptMenuOpen) {
      const timer = setTimeout(() => setIsReceiptMenuAnimating(true), 10);
      return () => clearTimeout(timer);
    } else {
      setIsReceiptMenuAnimating(false);
    }
  }, [isReceiptMenuOpen]);

  useEffect(() => {
    if (!isEditing || !originalExpenseState) {
      setHasChanges(false);
      return;
    }
    const currentAmount = parseFloat(String(formData.amount || '0').replace(',', '.'));
    const originalAmount = originalExpenseState.amount || 0;
    const amountChanged = Math.abs(currentAmount - originalAmount) > 0.001;
    const descriptionChanged = (formData.description || '') !== (originalExpenseState.description || '');
    const dateChanged = formData.date !== originalExpenseState.date;
    const timeChanged = !isForRecurringTemplate && ((formData.time || '') !== (originalExpenseState.time || ''));
    const categoryChanged = (formData.category || '') !== (originalExpenseState.category || '');
    const subcategoryChanged = (formData.subcategory || '') !== (originalExpenseState.subcategory || '');
    const accountIdChanged = formData.accountId !== originalExpenseState.accountId;
    const toAccountIdChanged = formData.toAccountId !== originalExpenseState.toAccountId; // added
    const frequencyChanged = formData.frequency !== originalExpenseState.frequency;
    const recurrenceChanged = formData.recurrence !== originalExpenseState.recurrence ||
      formData.recurrenceInterval !== originalExpenseState.recurrenceInterval ||
      JSON.stringify(formData.recurrenceDays) !== JSON.stringify(originalExpenseState.recurrenceDays) ||
      formData.monthlyRecurrenceType !== originalExpenseState.monthlyRecurrenceType ||
      formData.recurrenceEndType !== originalExpenseState.recurrenceEndType ||
      formData.recurrenceEndDate !== originalExpenseState.recurrenceEndDate ||
      formData.recurrenceCount !== originalExpenseState.recurrenceCount;
    const receiptsChanged = JSON.stringify(formData.receipts) !== JSON.stringify(originalExpenseState.receipts);

    const changed = amountChanged || descriptionChanged || dateChanged || timeChanged || categoryChanged || subcategoryChanged || accountIdChanged || toAccountIdChanged || frequencyChanged || recurrenceChanged || receiptsChanged;

    setHasChanges(changed);

  }, [formData, originalExpenseState, isEditing, isForRecurringTemplate]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'recurrenceEndDate' && value === '') {
      setFormData(prev => ({ ...prev, recurrenceEndType: 'forever', recurrenceEndDate: undefined }));
      return;
    }
    if (name === 'recurrenceCount') {
      const num = parseInt(value, 10);
      setFormData(prev => ({ ...prev, [name]: isNaN(num) || num <= 0 ? undefined : num }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  }, []);

  const handleSelectChange = (field: keyof Omit<Expense, 'id'>, value: string) => {
    setFormData(currentData => {
      const newData = { ...currentData, [field]: value };
      if (field === 'category') {
        newData.subcategory = '';
      }
      return newData;
    });
    setActiveMenu(null);
  };

  const handleFrequencyOptionSelect = (value: 'none' | 'single' | 'recurring') => {
    const updates: Partial<Omit<Expense, 'id'>> = {};
    if (value === 'none') {
      updates.frequency = 'single';
      updates.recurrence = undefined;
      updates.recurrenceInterval = undefined;
      updates.recurrenceDays = undefined;
      updates.recurrenceEndType = undefined;
      updates.recurrenceEndDate = undefined;
      updates.recurrenceCount = undefined;
      updates.monthlyRecurrenceType = undefined;
    } else if (value === 'single') {
      updates.frequency = 'recurring';
      updates.recurrence = undefined;
      updates.recurrenceInterval = undefined;
      updates.recurrenceDays = undefined;
      updates.monthlyRecurrenceType = undefined;
      updates.recurrenceEndType = 'count';
      updates.recurrenceCount = 1;
      updates.recurrenceEndDate = undefined;
    } else { // recurring
      updates.frequency = 'recurring';
      updates.recurrence = formData.recurrence || 'monthly';
      updates.recurrenceEndType = 'forever';
      updates.recurrenceCount = undefined;
      updates.recurrenceEndDate = undefined;
    }
    setFormData(prev => ({ ...prev, ...updates }));
    setActiveMenu(null);
  };

  const handleCloseRecurrenceModal = () => {
    setIsRecurrenceModalAnimating(false);
    setIsRecurrenceModalOpen(false);
  };

  const handleApplyRecurrence = () => {
    setFormData(prev => ({
      ...prev,
      recurrence: tempRecurrence as any,
      recurrenceInterval: tempRecurrenceInterval || 1,
      recurrenceDays: tempRecurrence === 'weekly' ? tempRecurrenceDays : undefined,
      monthlyRecurrenceType: tempRecurrence === 'monthly' ? tempMonthlyRecurrenceType : undefined,
    }));
    handleCloseRecurrenceModal();
  };

  const handleRecurrenceEndTypeSelect = (type: 'forever' | 'date' | 'count') => {
    const updates: Partial<Expense> = { recurrenceEndType: type };
    if (type === 'forever') {
      updates.recurrenceEndDate = undefined;
      updates.recurrenceCount = undefined;
    } else if (type === 'date') {
      updates.recurrenceEndDate = formData.recurrenceEndDate || toYYYYMMDD(new Date());
      updates.recurrenceCount = undefined;
    } else if (type === 'count') {
      updates.recurrenceEndDate = undefined;
      updates.recurrenceCount = formData.recurrenceCount || 1;
    }
    setFormData(prev => ({ ...prev, ...updates }));
    setIsRecurrenceEndOptionsOpen(false);
  };

  const handleToggleDay = (dayValue: number) => {
    setTempRecurrenceDays(prevDays => {
      const currentDays = prevDays || [];
      const newDays = currentDays.includes(dayValue)
        ? currentDays.filter(d => d !== dayValue)
        : [...currentDays, dayValue];
      return newDays.sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b));
    });
  };

  // Receipt Logic
  const handleCloseReceiptMenu = () => {
    setIsReceiptMenuOpen(false);
    setIsReceiptMenuAnimating(false);
    receiptMenuCloseTimeRef.current = Date.now();
  };

  const handlePickReceipt = async (source: 'camera' | 'gallery') => {
    try {
      const file = await pickImage(source);
      const { base64 } = await processImageFile(file);
      setFormData(prev => ({ ...prev, receipts: [...(prev.receipts || []), base64] }));
      setTimeout(handleCloseReceiptMenu, 500);
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemoveReceipt = (index: number) => {
    setFormData(prev => {
      const currentReceipts = prev.receipts || [];
      const newReceipts = currentReceipts.filter((_, i) => i !== index);
      return { ...prev, receipts: newReceipts };
    });
  };

  const handleTagNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTagInput(e.target.value);
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === ',') {
      e.preventDefault();
      const newTag = tagInput.trim().replace(/^#/, '');
      if (newTag && !(formData.tags || []).includes(newTag)) {
        setFormData(prev => ({ ...prev, tags: [...(prev.tags || []), newTag] }));
        setTagInput('');
      }
    } else if (e.key === 'Backspace' && !tagInput && (formData.tags || []).length > 0) {
      setFormData(prev => ({ ...prev, tags: (prev.tags || []).slice(0, -1) }));
    }
  };

  const removeTag = (tag: string) => {
    setFormData(prev => ({ ...prev, tags: (prev.tags || []).filter(t => t !== tag) }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amountAsString = String(formData.amount).replace(',', '.').trim();
    const amountAsNumber = parseFloat(amountAsString);

    if (amountAsString === '' || isNaN(amountAsNumber) || amountAsNumber <= 0) {
      setError('Inserisci un importo valido.');
      return;
    }

    if (isSplitActive && splitParticipants > 1) {
      const myShare = amountAsNumber / splitParticipants;
      const othersShare = amountAsNumber - myShare;
      const text = `Ciao! Ho pagato ${amountAsNumber.toFixed(2)}€ per "${formData.description || 'la spesa'}". Siamo in ${splitParticipants}, quindi sono ${myShare.toFixed(2)}€ a testa. Mi devi ${myShare.toFixed(2)}€.`;
      const url = `https://wa.me/?text=${encodeURIComponent(text)}`;

      // Auto-add #split tag
      if (!(formData.tags || []).includes('split')) {
        setFormData(prev => ({ ...prev, tags: [...(prev.tags || []), 'split'] }));
      }

      window.open(url, '_blank');
    }

    // Add pending tag input if exists
    let finalTags = formData.tags || [];
    if (tagInput.trim()) {
      const pendingTag = tagInput.trim().replace(/^#/, '');
      if (pendingTag && !finalTags.includes(pendingTag)) {
        finalTags = [...finalTags, pendingTag];
      }
    }

    const finalDate = formData.date || getTodayString();

    if (!formData.accountId) {
      setError('Seleziona un conto.');
      return;
    }

    if (isTransfer) {
      if (!formData.toAccountId) {
        setError('Seleziona un conto di destinazione.');
        return;
      }
      if (formData.accountId === formData.toAccountId) {
        setError('Il conto di origine e destinazione devono essere diversi.');
        return;
      }
    }

    setError(null);

    const dataToSubmit: Partial<Expense> = {
      ...formData,
      amount: amountAsNumber,
      date: finalDate,
      time: formData.time || undefined,
      description: formData.description || '',
      // If transfer or income, category/subcategory/tags/receipts might be empty or irrelevant
      category: isTransfer ? 'Trasferimento' : isIncome ? 'Entrata' : (formData.category || ''),
      subcategory: isTransfer || isIncome ? undefined : (formData.subcategory || undefined),
      tags: isTransfer ? [] : finalTags,
      receipts: isTransfer ? [] : (formData.receipts || []),
    };

    if (dataToSubmit.frequency === 'recurring') {
      delete dataToSubmit.time;
    }

    if (isEditing) {
      onSubmit({ ...initialData, ...dataToSubmit } as Expense);
    } else {
      onSubmit(dataToSubmit as Omit<Expense, 'id'>);
    }
  };

  const handleAmountEnter = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const el = e.currentTarget as HTMLInputElement;
    el.blur();
  }, []);

  const renderImageViewer = () => {
    if (!viewingImage) return null;
    return createPortal(
      <div
        className="fixed inset-0 z-[6000] bg-black/95 flex items-center justify-center p-4 animate-fade-in-up"
        onClick={() => setViewingImage(null)}
      >
        <button
          className="absolute top-4 right-4 text-white/80 hover:text-white p-2 transition-colors z-50"
          onClick={(e) => {
            e.stopPropagation();
            setViewingImage(null);
          }}
          onPointerDown={(e) => e.stopPropagation()}
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

  if (!isOpen) return null;

  const categoryOptions = Object.keys(CATEGORIES).map(cat => {
    const style = getCategoryStyle(cat);
    return {
      value: cat,
      label: style.label,
      Icon: style.Icon,
      color: style.color,
      bgColor: style.bgColor,
    };
  });

  const subcategoryOptions = formData.category && CATEGORIES[formData.category]
    ? CATEGORIES[formData.category].map(sub => ({ value: sub, label: sub }))
    : [];

  const accountOptions = safeAccounts.map(acc => ({
    value: acc.id,
    label: acc.name,
  }));

  const toAccountOptions = safeAccounts
    .filter(acc => acc.id !== formData.accountId)
    .map(acc => ({
      value: acc.id,
      label: acc.name,
    }));

  const frequencyOptions = [
    { value: 'none', label: 'Nessuna' },
    { value: 'single', label: 'Singolo' },
    { value: 'recurring', label: 'Ricorrente' },
  ];

  const isSubcategoryDisabled = !formData.category || formData.category === 'Altro' || subcategoryOptions.length === 0;

  const SelectionButton = ({ label, value, onClick, placeholder, ariaLabel, disabled, icon }: { label: string, value?: string, onClick: () => void, placeholder: string, ariaLabel: string, disabled?: boolean, icon: React.ReactNode }) => {
    const hasValue = value && value !== placeholder && value !== '';
    return (
      <div>
        <label className={`block text-base font-medium mb-1 transition-colors ${disabled ? 'text-slate-400 dark:text-slate-600' : 'text-slate-700 dark:text-slate-300'}`}>{label}</label>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onClick(); }}
          aria-label={ariaLabel}
          disabled={disabled}
          className={`w-full flex items-center justify-center text-center gap-2 px-3 py-2.5 text-base font-semibold rounded-lg border shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${disabled
            ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-electric-violet/20 text-slate-400 cursor-not-allowed'
            : hasValue
              ? 'bg-indigo-50 dark:bg-electric-violet/20 border-indigo-200 dark:border-electric-violet/50 text-indigo-700 dark:text-electric-violet hover:bg-indigo-100 dark:hover:bg-electric-violet/30'
              : 'bg-sunset-cream dark:bg-midnight-card border-slate-300 dark:border-electric-violet/30 text-slate-500 dark:text-slate-400 hover:bg-sunset-peach/30 dark:hover:bg-midnight-card'
            }`}
        >
          {icon}
          <span className="truncate">
            {value || placeholder}
          </span>
        </button>
      </div>
    );
  };

  const getRecurrenceEndLabel = () => {
    const { recurrenceEndType } = formData;
    if (!recurrenceEndType || recurrenceEndType === 'forever') return 'Per sempre';
    if (recurrenceEndType === 'date') return 'Fino a';
    if (recurrenceEndType === 'count') return 'Numero di volte';
    return 'Per sempre';
  };

  const selectedAccountLabel = safeAccounts.find(a => a.id === formData.accountId)?.name;
  const selectedToAccountLabel = safeAccounts.find(a => a.id === formData.toAccountId)?.name;
  const selectedCategoryLabel = formData.category ? getCategoryStyle(formData.category).label : undefined;

  if (!isOpen) return null;

  const formContent = (
    <>
      <div className={`fixed inset-0 z-[5000] transition-opacity duration-300 ease-in-out ${isAnimating ? 'opacity-100' : 'opacity-0'} bg-black/40 backdrop-blur-sm`} onClick={handleBackdropClick} aria-modal="true" role="dialog">
        <div className={`bg-sunset-cream dark:bg-midnight w-full h-full flex flex-col absolute bottom-0 transform transition-transform duration-300 ease-in-out ${isAnimating ? 'translate-y-0' : 'translate-y-full'}`} onClick={(e) => e.stopPropagation()} style={{ touchAction: 'pan-y' }}>
          <header className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-800 flex-shrink-0"><h2 ref={titleRef} tabIndex={-1} className="text-2xl font-bold text-slate-800 dark:text-white focus:outline-none">{isEditing ? (isTransfer ? 'Modifica Trasferimento' : isIncome ? 'Modifica Entrata' : 'Modifica Spesa') : (isTransfer ? 'Nuovo Trasferimento' : isIncome ? 'Aggiungi Entrata' : 'Aggiungi Spesa')}</h2><button type="button" onClick={handleClose} className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors p-1 rounded-full hover:bg-slate-200 dark:hover:bg-midnight-card focus:outline-none focus:ring-2 focus:ring-indigo-500" aria-label="Chiudi"><XMarkIcon className="w-6 h-6" /></button></header>
          <form onSubmit={handleSubmit} noValidate className="flex-1 flex flex-col overflow-hidden">
            <div className="p-6 space-y-4 flex-1 overflow-y-auto">
              <FormInput ref={descriptionInputRef} id="description" name="description" label="Descrizione (opzionale)" value={formData.description || ''} onChange={handleInputChange} icon={<DocumentTextIcon className="h-5 w-5 text-slate-400" />} type="text" placeholder="Es. Caffè al bar" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><FormInput ref={amountInputRef} id="amount" name="amount" label="Importo" value={formData.amount || ''} onChange={handleInputChange} onKeyDown={handleAmountEnter} icon={<CurrencyEuroIcon className="h-5 w-5 text-slate-400" />} type="text" inputMode="decimal" pattern="[0-9]*[.,]?[0-9]*" placeholder="0.00" required autoComplete="off" />
                <div className={`grid ${formData.frequency === 'recurring' ? 'grid-cols-1' : 'grid-cols-2'} gap-2`}><div><label htmlFor="date" className="block text-base font-medium text-slate-700 dark:text-slate-300 mb-1">{isSingleRecurring ? 'Data del Pagamento' : formData.frequency === 'recurring' ? 'Data di Inizio' : 'Data'}</label><div className="relative"><div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"><CalendarIcon className="h-5 w-5 text-slate-400" /></div><input id="date" name="date" value={formData.date || ''} onChange={handleInputChange} className="block w-full rounded-md border border-slate-300 dark:border-electric-violet/30 bg-sunset-cream dark:bg-midnight-card py-2.5 pl-10 pr-3 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 dark:focus:border-electric-violet focus:ring-1 focus:ring-indigo-500 dark:focus:ring-electric-violet text-base" type="date" /></div></div>
                  {formData.frequency !== 'recurring' && (<div><label htmlFor="time" className="block text-base font-medium text-slate-700 dark:text-slate-300 mb-1">Ora (opz.)</label><div className="relative"><div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"><ClockIcon className="h-5 w-5 text-slate-400" /></div><input id="time" name="time" value={formData.time || ''} onChange={handleInputChange} className="block w-full rounded-md border border-slate-300 dark:border-electric-violet/30 bg-sunset-cream dark:bg-midnight-card py-2.5 pl-10 pr-3 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 dark:focus:border-electric-violet focus:ring-1 focus:ring-indigo-500 dark:focus:ring-electric-violet text-base" type="time" /></div></div>)}</div></div>

              {isTransfer ? (<div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><SelectionButton label="Da Conto" value={selectedAccountLabel} onClick={() => setActiveMenu('account')} placeholder="Seleziona" ariaLabel="Seleziona conto di origine" icon={<CreditCardIcon className="h-7 w-7" />} /><SelectionButton label="A Conto" value={selectedToAccountLabel} onClick={() => setActiveMenu('toAccount')} placeholder="Seleziona" ariaLabel="Seleziona conto di destinazione" icon={<CreditCardIcon className="h-7 w-7" />} /></div>) : isIncome ? (<div className="grid grid-cols-1 gap-4"><SelectionButton label="Conto" value={selectedAccountLabel} onClick={() => setActiveMenu('account')} placeholder="Seleziona" ariaLabel="Seleziona conto di accredito" icon={<CreditCardIcon className="h-7 w-7" />} /></div>) : (<div className="grid grid-cols-1 sm:grid-cols-3 gap-4"><SelectionButton label="Conto" value={selectedAccountLabel} onClick={() => setActiveMenu('account')} placeholder="Seleziona" ariaLabel="Seleziona conto di pagamento" icon={<CreditCardIcon className="h-7 w-7" />} /><SelectionButton label="Categoria (opzionale)" value={selectedCategoryLabel} onClick={() => setActiveMenu('category')} placeholder="Seleziona" ariaLabel="Seleziona categoria" icon={<TagIcon className="h-5 w-5" />} /><SelectionButton label="Sottocategoria (opzionale)" value={formData.subcategory} onClick={() => setActiveMenu('subcategory')} placeholder="Seleziona" ariaLabel="Seleziona sottocategoria" disabled={isSubcategoryDisabled} icon={<TagIcon className="h-5 w-5" />} /></div>)}

              {!isTransfer && !isIncome && (
                <>
                  <div className="space-y-1">
                    <label className="block text-base font-medium text-slate-700 dark:text-slate-300">Tag & Etichette</label>
                    <div className="flex flex-wrap items-center gap-2 p-2 bg-white dark:bg-midnight-card border border-slate-300 dark:border-electric-violet/30 rounded-lg focus-within:ring-1 focus-within:ring-indigo-500">
                      {(formData.tags || []).map(tag => (
                        <span key={tag} className="flex items-center text-sm font-semibold bg-indigo-100 dark:bg-electric-violet/20 text-indigo-700 dark:text-electric-violet px-2 py-1 rounded-md">
                          #{tag}
                          <button type="button" onClick={() => removeTag(tag)} className="ml-1 text-slate-500 hover:text-red-500" tabIndex={-1}>&times;</button>
                        </span>
                      ))}
                      <input
                        type="text"
                        value={tagInput}
                        onChange={handleTagNameChange}
                        onKeyDown={handleTagKeyDown}
                        placeholder={formData.tags && formData.tags.length > 0 ? '' : 'Aggiungi tag (es. #vacanza)...'}
                        className="flex-1 min-w-[120px] bg-transparent outline-none text-slate-800 dark:text-white placeholder:text-slate-400 text-sm py-1"
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">🍕</span>
                        <label className="text-base font-bold text-slate-700 dark:text-slate-300">Dividi Spesa (Split)</label>
                      </div>
                      <div
                        className={`w-12 h-7 rounded-full p-1 cursor-pointer transition-colors ${isSplitActive ? 'bg-indigo-600 dark:bg-electric-violet' : 'bg-slate-300 dark:bg-slate-700'}`}
                        onClick={() => setIsSplitActive(!isSplitActive)}
                      >
                        <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform ${isSplitActive ? 'translate-x-5' : ''}`} />
                      </div>
                    </div>

                    {isSplitActive && (
                      <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-500/30 animate-fade-in-down">
                        <div className="flex items-center gap-4">
                          <div className="flex-1">
                            <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Partecipanti</label>
                            <input
                              type="number"
                              min="2"
                              value={splitParticipants}
                              onChange={(e) => setSplitParticipants(Math.max(2, parseInt(e.target.value) || 2))}
                              className="w-full bg-white dark:bg-midnight border border-slate-200 dark:border-slate-700 rounded-lg py-2 px-3 text-center font-bold"
                            />
                          </div>
                          <div className="flex flex-col items-center justify-center pt-4">
                            <span className="text-indigo-500 font-bold">➔</span>
                          </div>
                          <div className="flex-1 text-right">
                            <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">A Testa</label>
                            <p className="text-lg font-black text-indigo-600 dark:text-electric-violet">
                              {formData.amount ? (parseFloat(String(formData.amount).replace(',', '.')) / splitParticipants).toFixed(2) : '0.00'}€
                            </p>
                          </div>
                        </div>
                        <p className="text-[10px] text-center text-slate-400 mt-2">
                          Salvando, verrà generato un link WhatsApp per richiedere {(formData.amount ? (parseFloat(String(formData.amount).replace(',', '.')) * (splitParticipants - 1) / splitParticipants).toFixed(2) : '0.00')}€.
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}

              {!isIncome && !isTransfer && (<div className="animate-fade-in-up"><label className="block text-base font-medium text-slate-700 dark:text-slate-300 mb-1">Ricevute</label>{formData.receipts && formData.receipts.length > 0 && (<div className="grid grid-cols-2 gap-3 mb-3">{formData.receipts.map((receipt, index) => (<div key={index} className="relative rounded-lg overflow-hidden border border-slate-200 dark:border-electric-violet/30 shadow-sm aspect-video bg-sunset-cream dark:bg-midnight-card cursor-pointer hover:border-indigo-300 dark:hover:border-electric-violet transition-colors" onClick={() => setViewingImage(receipt)}><img src={`data:image/png;base64,${receipt}`} alt="Ricevuta" className="w-full h-full object-cover" /><button type="button" onClick={(e) => { e.stopPropagation(); handleRemoveReceipt(index); }} onPointerDown={(e) => e.stopPropagation()} className="absolute top-1 right-1 p-1 bg-sunset-cream/90 dark:bg-midnight/90 text-red-600 dark:text-rose-400 rounded-full shadow-md hover:bg-red-50 dark:hover:bg-midnight transition-colors z-10 flex items-center justify-center" aria-label="Rimuovi ricevuta"><XMarkIcon className="w-5 h-5" /></button></div>))}</div>)}<button type="button" onClick={() => { if (Date.now() - receiptMenuCloseTimeRef.current < 500) return; setIsReceiptMenuOpen(true); }} className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-base rounded-lg border border-dashed border-indigo-300 dark:border-electric-violet shadow-sm bg-indigo-50 dark:bg-electric-violet/10 text-indigo-600 dark:text-electric-violet hover:bg-indigo-100 dark:hover:bg-electric-violet/20 hover:border-indigo-400 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"><PaperClipIcon className="w-5 h-5" /><span>{formData.receipts && formData.receipts.length > 0 ? 'Aggiungi un\'altra ricevuta' : 'Allega Ricevuta'}</span></button></div>)}
              {isForRecurringTemplate && !isIncome && !isTransfer && (<div className="bg-sunset-cream dark:bg-midnight-card p-4 rounded-lg border border-sunset-coral/20 dark:border-electric-violet/20 space-y-4"><div><label className="block text-base font-medium text-slate-700 dark:text-slate-300 mb-1">Frequenza</label><button type="button" onClick={() => setActiveMenu('frequency')} className="w-full flex items-center justify-between text-left gap-2 px-3 py-2.5 text-base rounded-lg border shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-electric-violet transition-colors bg-sunset-cream dark:bg-midnight-card border-slate-300 dark:border-electric-violet/30 text-slate-800 dark:text-white hover:bg-sunset-peach/30 dark:hover:bg-midnight-card/80"><span className="truncate flex-1 capitalize">{isSingleRecurring ? 'Singolo' : formData.frequency !== 'recurring' ? 'Nessuna' : 'Ricorrente'}</span><ChevronDownIcon className="w-5 h-5 text-slate-500 dark:text-slate-400" /></button></div>{formData.frequency === 'recurring' && !isSingleRecurring && (<div className="animate-fade-in-up"><label className="block text-base font-medium text-slate-700 dark:text-slate-300 mb-1">Ricorrenza</label><button type="button" onClick={() => setIsRecurrenceModalOpen(true)} className="w-full flex items-center justify-between text-left gap-2 px-3 py-2.5 text-base rounded-lg border shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-electric-violet transition-colors bg-sunset-cream dark:bg-midnight-card border-slate-300 dark:border-electric-violet/30 text-slate-800 dark:text-white hover:bg-sunset-peach/30 dark:hover:bg-midnight-card/80"><span className="truncate flex-1">{getRecurrenceSummary(formData as Partial<Expense>)}</span><ChevronDownIcon className="w-5 h-5 text-slate-500 dark:text-slate-400" /></button></div>)}</div>)}
              {error && <p className="text-base text-red-600 bg-red-100 p-3 rounded-md">{error}</p>}
            </div>
            <footer className={`px-6 py-4 bg-sunset-cream dark:bg-midnight border-t border-slate-200 dark:border-electric-violet/20 flex flex-shrink-0 ${isEditing && !hasChanges ? 'justify-stretch' : 'justify-end gap-3'}`}>
              {isEditing && !hasChanges ? (
                <button type="button" onClick={handleClose} className="w-full px-4 py-2 text-base font-semibold text-slate-700 dark:text-slate-300 bg-sunset-cream dark:bg-midnight-card border border-slate-300 dark:border-electric-violet/30 rounded-lg shadow-sm hover:bg-sunset-peach/30 dark:hover:bg-midnight-card/80 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors">Chiudi</button>
              ) : (
                <>
                  <button type="button" onClick={handleClose} className="px-4 py-2 text-base font-semibold text-slate-700 dark:text-slate-300 bg-sunset-cream dark:bg-midnight-card border border-slate-300 dark:border-electric-violet/30 rounded-lg shadow-sm hover:bg-sunset-peach/30 dark:hover:bg-midnight-card/80 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors">Annulla</button>
                  <button type="submit" className="px-4 py-2 text-base font-semibold text-white bg-indigo-600 dark:btn-electric rounded-lg shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors">{isEditing ? (isTransfer ? 'Salva Trasferimento' : isIncome ? 'Salva Entrata' : 'Salva Spesa') : (isTransfer ? 'Conferma Trasferimento' : isIncome ? 'Aggiungi Entrata' : 'Aggiungi Spesa')}</button>
                </>
              )}
            </footer>
          </form>
        </div>

        <SelectionMenu isOpen={activeMenu === 'account'} onClose={() => setActiveMenu(null)} title="Seleziona un Conto" options={accountOptions} selectedValue={formData.accountId || ''} onSelect={(value: string) => handleSelectChange('accountId', value)} />
        <SelectionMenu isOpen={activeMenu === 'toAccount'} onClose={() => setActiveMenu(null)} title="Trasferisci A" options={toAccountOptions} selectedValue={formData.toAccountId || ''} onSelect={(value: string) => handleSelectChange('toAccountId', value)} />
        <SelectionMenu isOpen={activeMenu === 'category'} onClose={() => setActiveMenu(null)} title="Seleziona una Categoria" options={categoryOptions} selectedValue={formData.category || ''} onSelect={(value: string) => handleSelectChange('category', value)} />
        <SelectionMenu isOpen={activeMenu === 'subcategory'} onClose={() => setActiveMenu(null)} title="Seleziona Sottocategoria" options={subcategoryOptions} selectedValue={formData.subcategory || ''} onSelect={(value: string) => handleSelectChange('subcategory', value)} />
        <SelectionMenu isOpen={activeMenu === 'frequency'} onClose={() => setActiveMenu(null)} title="Imposta Frequenza" options={frequencyOptions} selectedValue={isSingleRecurring ? 'single' : formData.frequency !== 'recurring' ? 'none' : 'recurring'} onSelect={handleFrequencyOptionSelect as (value: string) => void} />

        {isRecurrenceModalOpen && createPortal(
          <div className={`fixed inset-0 z-[10000] flex justify-center items-center p-4 transition-opacity duration-300 ease-in-out ${isRecurrenceModalAnimating ? 'opacity-100' : 'opacity-0'} bg-black/60 backdrop-blur-sm`} onClick={handleCloseRecurrenceModal} aria-modal="true" role="dialog">
            <div className={`bg-white dark:bg-midnight rounded-lg shadow-xl w-full max-w-sm border border-slate-200 dark:border-electric-violet/30 transform transition-all duration-300 ease-in-out ${isRecurrenceModalAnimating ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`} onClick={(e) => e.stopPropagation()}>
              <header className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700"><h2 className="text-lg font-bold text-slate-800 dark:text-white">Imposta Ricorrenza</h2><button type="button" onClick={handleCloseRecurrenceModal} className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors p-1 rounded-full hover:bg-slate-200 dark:hover:bg-midnight-card focus:outline-none focus:ring-2 focus:ring-indigo-500" aria-label="Chiudi"><XMarkIcon className="w-6 h-6" /></button></header>
              <main className="p-4 space-y-4">
                <div className="relative"><button onClick={() => { setIsRecurrenceOptionsOpen(prev => !prev); setIsRecurrenceEndOptionsOpen(false); }} className="w-full flex items-center justify-between text-left gap-2 px-3 py-2.5 text-base rounded-lg border shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors bg-white dark:bg-midnight-card border-slate-300 dark:border-electric-violet/30 text-slate-800 dark:text-white hover:bg-slate-50 dark:hover:bg-midnight-card/80"><span className="truncate flex-1 capitalize">{recurrenceLabels[tempRecurrence as keyof typeof recurrenceLabels] || 'Seleziona'}</span><ChevronDownIcon className={`w-5 h-5 text-slate-500 dark:text-slate-400 transition-transform ${isRecurrenceOptionsOpen ? 'rotate-180' : ''}`} /></button>{isRecurrenceOptionsOpen && (<div className="absolute top-full mt-1 w-full bg-white dark:bg-midnight-card border border-slate-200 dark:border-electric-violet/30 shadow-lg rounded-lg z-20 p-2 space-y-1 animate-fade-in-down">{(Object.keys(recurrenceLabels) as Array<keyof typeof recurrenceLabels>).map((key) => (<button key={key} onClick={() => { setTempRecurrence(key); setIsRecurrenceOptionsOpen(false); }} className="w-full text-left px-4 py-3 text-base font-semibold rounded-lg transition-colors bg-white dark:bg-midnight-card text-slate-800 dark:text-white hover:bg-slate-100 dark:hover:bg-indigo-900/50 dark:hover:text-indigo-300">{recurrenceLabels[key]}</button>))}</div>)}</div>
                <div className="animate-fade-in-up pt-2"><div className="flex items-center justify-center gap-2 bg-slate-50 dark:bg-midnight-card/50 p-3 rounded-lg"><span className="text-base text-slate-700 dark:text-slate-300">Ogni</span><input type="number" value={tempRecurrenceInterval || ''} onChange={(e) => { const val = e.target.value; if (val === '') { setTempRecurrenceInterval(undefined); } else { const num = parseInt(val, 10); if (!isNaN(num) && num > 0) { setTempRecurrenceInterval(num); } } }} onFocus={(e) => e.currentTarget.select()} className="w-12 text-center text-lg font-bold text-slate-800 dark:text-white bg-transparent border-0 border-b-2 border-slate-400 focus:ring-0 focus:outline-none focus:border-indigo-500 dark:focus:border-electric-violet p-0" min="1" /><span className="text-base text-slate-700 dark:text-slate-300">{getIntervalLabel(tempRecurrence as any, tempRecurrenceInterval)}</span></div></div>
                {tempRecurrence === 'weekly' && (<div className="animate-fade-in-up pt-2"><div className="flex flex-wrap justify-center gap-2">{daysOfWeekForPicker.map(day => (<button key={day.value} onClick={() => handleToggleDay(day.value)} className={`w-14 h-14 rounded-full text-sm font-semibold transition-colors focus:outline-none border-2 ${(tempRecurrenceDays || []).includes(day.value) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white border-slate-300 dark:border-indigo-600 hover:bg-slate-50 dark:hover:bg-slate-600'}`}>{day.label}</button>))}</div></div>)}
                {tempRecurrence === 'monthly' && (<div className="animate-fade-in-up pt-4 space-y-2 border-t border-slate-200 dark:border-slate-700"><div role="radio" aria-checked={tempMonthlyRecurrenceType === 'dayOfMonth'} onClick={() => setTempMonthlyRecurrenceType('dayOfMonth')} className="flex items-center gap-3 p-2 cursor-pointer rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"><div className="w-5 h-5 rounded-full border-2 border-slate-400 flex items-center justify-center flex-shrink-0">{tempMonthlyRecurrenceType === 'dayOfMonth' && <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full" />}</div><label className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer">Lo stesso giorno di ogni mese</label></div><div role="radio" aria-checked={tempMonthlyRecurrenceType === 'dayOfWeek'} onClick={() => setTempMonthlyRecurrenceType('dayOfWeek')} className="flex items-center gap-3 p-2 cursor-pointer rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"><div className="w-5 h-5 rounded-full border-2 border-slate-400 flex items-center justify-center flex-shrink-0">{tempMonthlyRecurrenceType === 'dayOfWeek' && <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full" />}</div><label className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer">{dynamicMonthlyDayOfWeekLabel}</label></div></div>)}
                <div className="pt-4 border-t border-slate-200 dark:border-slate-700"><div className="grid grid-cols-2 gap-4 items-end"><div className={`relative ${!formData.recurrenceEndType || formData.recurrenceEndType === 'forever' ? 'col-span-2' : ''}`}><button type="button" onClick={() => { setIsRecurrenceEndOptionsOpen(prev => !prev); setIsRecurrenceOptionsOpen(false); }} className="w-full flex items-center justify-between text-left gap-2 px-3 py-2.5 text-base rounded-lg border shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors bg-white dark:bg-midnight-card border-slate-300 dark:border-electric-violet/30 text-slate-800 dark:text-white hover:bg-slate-50 dark:hover:bg-midnight-card/80"><span className="truncate flex-1 capitalize">{getRecurrenceEndLabel()}</span><ChevronDownIcon className={`w-5 h-5 text-slate-500 dark:text-slate-400 transition-transform ${isRecurrenceOptionsOpen ? 'rotate-180' : ''}`} /></button>{isRecurrenceOptionsOpen && (<div className="absolute top-full mt-1 w-full bg-white dark:bg-midnight-card border border-slate-200 dark:border-electric-violet/30 shadow-lg rounded-lg z-20 p-2 space-y-1 animate-fade-in-down">{(['forever', 'date', 'count'] as const).map(key => (<button key={key} onClick={() => handleRecurrenceEndTypeSelect(key)} className="w-full text-left px-4 py-3 text-base font-semibold rounded-lg transition-colors bg-white dark:bg-midnight-card text-slate-800 dark:text-white hover:bg-slate-100 dark:hover:bg-indigo-900/50 dark:hover:text-indigo-300">{key === 'forever' ? 'Per sempre' : key === 'date' ? 'Fino a' : 'Numero di volte'}</button>))}</div>)}</div>{formData.recurrenceEndType === 'date' && (<div className="animate-fade-in-up"><label htmlFor="recurrence-end-date" className="relative w-full flex items-center justify-center gap-2 px-3 py-2.5 text-base rounded-lg focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500 text-indigo-600 dark:text-electric-violet hover:bg-indigo-100 dark:hover:bg-electric-violet/20 font-semibold cursor-pointer h-[46.5px]"><CalendarIcon className="w-5 h-5" /><span>{formData.recurrenceEndDate ? formatDate(parseLocalYYYYMMDD(formData.recurrenceEndDate)!) : 'Seleziona'}</span><input type="date" id="recurrence-end-date" name="recurrenceEndDate" value={formData.recurrenceEndDate || ''} onChange={(e) => setFormData(prev => ({ ...prev, recurrenceEndDate: e.target.value, recurrenceEndType: 'date' }))} className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" /></label></div>)}{formData.recurrenceEndType === 'count' && (<div className="animate-fade-in-up"><div className="relative"><input type="number" id="recurrence-count" name="recurrenceCount" value={formData.recurrenceCount || ''} onChange={handleInputChange} className="block w-full text-center rounded-md border border-slate-300 dark:border-electric-violet/30 bg-white dark:bg-midnight-card py-2.5 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 dark:focus:border-electric-violet focus:ring-1 focus:ring-indigo-500 dark:focus:ring-electric-violet text-base" placeholder="N." min="1" /></div></div>)}</div></div>
              </main>
              <footer className="p-4 bg-slate-50 dark:bg-midnight border-t border-slate-200 dark:border-slate-700 flex justify-end"><button type="button" onClick={handleApplyRecurrence} className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 dark:btn-electric rounded-lg shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all">Applica</button></footer>
            </div>
          </div>,
          document.body
        )}

        {isReceiptMenuOpen && createPortal(
          <div className={`fixed inset-0 z-[10000] flex justify-center items-center p-4 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ease-in-out ${isReceiptMenuAnimating ? 'opacity-100' : 'opacity-0'}`} onClick={handleCloseReceiptMenu}>
            <div className="bg-white dark:bg-midnight rounded-lg shadow-xl w-full max-w-sm border border-slate-200 dark:border-electric-violet/30 animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
              <header className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700"><h2 className="text-xl font-bold text-slate-800 dark:text-white">Allega Ricevuta</h2><button onClick={handleCloseReceiptMenu} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-midnight-card"><XMarkIcon className="w-6 h-6 text-slate-500 dark:text-slate-400" /></button></header>
              <div className="p-4 grid grid-cols-2 gap-4">
                <button onClick={() => handlePickReceipt('camera')} className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-slate-200 dark:border-electric-violet/30 bg-white dark:bg-midnight-card hover:bg-slate-50 dark:hover:bg-electric-violet/20 hover:border-indigo-300 transition-colors"><div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-electric-violet/20 flex items-center justify-center text-indigo-600 dark:text-electric-violet"><CameraIcon className="w-8 h-8" /></div><span className="font-bold text-slate-700 dark:text-slate-200 text-sm">Fotocamera</span></button>
                <button onClick={() => handlePickReceipt('gallery')} className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-slate-200 dark:border-electric-violet/30 bg-white dark:bg-midnight-card hover:bg-slate-50 dark:hover:bg-electric-pink/20 hover:border-pink-300 transition-colors"><div className="w-12 h-12 rounded-full bg-pink-50 dark:bg-electric-pink/20 flex items-center justify-center text-pink-600 dark:text-electric-pink"><PhotoIcon className="w-8 h-8" /></div><span className="font-bold text-slate-700 dark:text-slate-200 text-sm">Galleria</span></button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {renderImageViewer()}

        <ConfirmationModal isOpen={isConfirmCloseOpen} onClose={() => setIsConfirmCloseOpen(false)} onConfirm={() => { setIsConfirmCloseOpen(false); forceClose(); }} title="Annullare le modifiche?" message="Sei sicuro di voler chiudere senza salvare? Le modifiche andranno perse." variant="danger" confirmButtonText="Sì, annulla" cancelButtonText="No, continua" />
      </div>
    </>
  );

  return createPortal(formContent, document.body);
};

export default ExpenseForm;
