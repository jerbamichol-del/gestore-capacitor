import { useState, useEffect, useRef } from 'react';
import { ModalType } from '../types/navigation';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';

export const useBackNavigation = (
  onToast: (msg: any) => void,
  setAnalysisImage: (img: any) => void
) => {
  // UI State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isCalculatorContainerOpen, setIsCalculatorContainerOpen] = useState(false);
  const [isImageSourceModalOpen, setIsImageSourceModalOpen] = useState(false);
  /* New Modals */
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isMultipleExpensesModalOpen, setIsMultipleExpensesModalOpen] = useState(false);
  const [isBankSyncModalOpen, setIsBankSyncModalOpen] = useState(false);

  const [isRecurringScreenOpen, setIsRecurringScreenOpen] = useState(false);
  const [isRecurringClosing, setIsRecurringClosing] = useState(false);

  const [isHistoryScreenOpen, setIsHistoryScreenOpen] = useState(false);
  const [isHistoryClosing, setIsHistoryClosing] = useState(false);

  const [isIncomeHistoryOpen, setIsIncomeHistoryOpen] = useState(false);
  const [isIncomeHistoryClosing, setIsIncomeHistoryClosing] = useState(false);

  const [isAccountsScreenOpen, setIsAccountsScreenOpen] = useState(false);

  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isHistoryFilterOpen, setIsHistoryFilterOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [isCategoriesScreenOpen, setIsCategoriesScreenOpen] = useState(false);
  const [isSubscriptionManagerOpen, setIsSubscriptionManagerOpen] = useState(false);

  const lastBackPressTime = useRef(0);

  const closeAllModals = () => {
    setIsFormOpen(false); setIsCalculatorContainerOpen(false); setIsImageSourceModalOpen(false);
    setIsVoiceModalOpen(false); setIsMultipleExpensesModalOpen(false); setIsQrModalOpen(false);
    setIsHistoryScreenOpen(false); setIsHistoryFilterOpen(false); setIsRecurringScreenOpen(false);
    setIsIncomeHistoryOpen(false); setIsIncomeHistoryClosing(false); setIsAccountsScreenOpen(false);
    setIsBankSyncModalOpen(false); setIsSearchModalOpen(false); setIsChatModalOpen(false);
    setIsBudgetModalOpen(false); setIsCategoriesScreenOpen(false);
    setIsSubscriptionManagerOpen(false);
    setAnalysisImage(null);
  };

  const forceNavigateHome = () => {
    try { window.history.replaceState({ modal: 'home' }, '', window.location.pathname); } catch (e) { }
    window.dispatchEvent(new PopStateEvent('popstate', { state: { modal: 'home' } }));
  };

  const closeModalWithHistory = () => {
    if (window.history.state?.modal === 'history') { setIsHistoryScreenOpen(false); setIsHistoryClosing(false); }
    if (window.history.state?.modal === 'income_history') { setIsIncomeHistoryOpen(false); setIsIncomeHistoryClosing(false); }
    if (window.history.state?.modal === 'recurring') { setIsRecurringScreenOpen(false); setIsRecurringClosing(false); }
    if (window.history.state?.modal === 'accounts') { setIsAccountsScreenOpen(false); }
    if (window.history.state?.modal === 'bank_sync') { setIsBankSyncModalOpen(false); }
    if (window.history.state?.modal === 'categories') { setIsCategoriesScreenOpen(false); }
    if (window.history.state?.modal === 'subscriptions') { setIsSubscriptionManagerOpen(false); }

    if (window.history.state?.modal && window.history.state.modal !== 'home' && window.history.state.modal !== 'exit_guard') window.history.back();
    else forceNavigateHome();
  };

  // Setup Exit Guard...
  useEffect(() => {
    if (!window.history.state?.modal) {
      if (Capacitor.getPlatform() === 'android') {
        try { window.history.replaceState({ modal: 'home' }, '', window.location.pathname); } catch (e) { }
        return;
      }
      window.history.replaceState({ modal: 'exit_guard' }, '');
      window.history.pushState({ modal: 'home' }, '');
    }
  }, []);

  // Native Back Button Handling
  useEffect(() => {
    let backListener: any;
    const setupBackListener = async () => {
      backListener = await CapacitorApp.addListener('backButton', ({ canGoBack }) => {
        const state = window.history.state;
        const modal = state?.modal;

        if (modal && modal !== 'home' && modal !== 'exit_guard') {
          window.history.back();
          return;
        }

        const now = Date.now();
        if (now - lastBackPressTime.current < 2000) {
          CapacitorApp.exitApp();
        } else {
          lastBackPressTime.current = now;
          onToast({ message: 'Premi di nuovo indietro per uscire', type: 'info' });
        }
      });
    };

    if (Capacitor.getPlatform() === 'android') {
      setupBackListener();
    }

    const handlePopState = (event: PopStateEvent) => {
      const modal = event.state?.modal as ModalType | undefined;

      if (modal === 'exit_guard') {
        window.history.pushState({ modal: 'home' }, '');
        return;
      }

      // Close specific modals based on state changes
      if (modal !== 'form') setIsFormOpen(false);
      if (modal !== 'voice') setIsVoiceModalOpen(false);
      if (modal !== 'source') setIsImageSourceModalOpen(false);
      if (modal !== 'multiple') setIsMultipleExpensesModalOpen(false);
      if (modal !== 'qr') setIsQrModalOpen(false);
      if (modal !== 'bank_sync') setIsBankSyncModalOpen(false);
      if (modal !== 'search') setIsSearchModalOpen(false);
      if (modal !== 'chat') setIsChatModalOpen(false);
      if (modal !== 'budget') setIsBudgetModalOpen(false);
      if (modal !== 'categories') setIsCategoriesScreenOpen(false);
      if (modal !== 'subscriptions') setIsSubscriptionManagerOpen(false);
      if (modal !== 'calculator' && modal !== 'calculator_details') setIsCalculatorContainerOpen(false);

      // Handle Screen Navigation
      if (!modal || modal === 'home') {
        setIsHistoryScreenOpen(false);
        setIsHistoryClosing(false);
        setIsIncomeHistoryOpen(false);
        setIsIncomeHistoryClosing(false);
        setIsHistoryFilterOpen(false);
        setIsRecurringScreenOpen(false);
        setIsRecurringClosing(false);
        setIsAccountsScreenOpen(false);
        setIsCategoriesScreenOpen(false);
        setAnalysisImage(null);
      } else if (modal === 'history') {
        setIsHistoryScreenOpen(true);
        if (isHistoryClosing) setIsHistoryClosing(false);
        setIsRecurringScreenOpen(false);
        setIsRecurringClosing(false);
        setIsIncomeHistoryOpen(false);
        setIsAccountsScreenOpen(false);
        setIsCategoriesScreenOpen(false);
      } else if (modal === 'income_history') {
        setIsIncomeHistoryOpen(true);
        if (isIncomeHistoryClosing) setIsIncomeHistoryClosing(false);
        setIsHistoryScreenOpen(false);
        setIsRecurringScreenOpen(false);
        setIsAccountsScreenOpen(false);
        setIsCategoriesScreenOpen(false);
      } else if (modal === 'recurring') {
        setIsRecurringScreenOpen(true);
        if (isRecurringClosing) setIsRecurringClosing(false);
        setIsHistoryScreenOpen(false);
        setIsIncomeHistoryOpen(false);
        setIsAccountsScreenOpen(false);
        setIsCategoriesScreenOpen(false);
      } else if (modal === 'accounts') {
        setIsAccountsScreenOpen(true);
        setIsHistoryScreenOpen(false);
        setIsIncomeHistoryOpen(false);
        setIsRecurringScreenOpen(false);
        setIsCategoriesScreenOpen(false);
      } else if (modal === 'bank_sync') {
        setIsBankSyncModalOpen(true);
        setIsHistoryScreenOpen(false);
        setIsIncomeHistoryOpen(false);
        setIsRecurringScreenOpen(false);
      } else if (modal === 'categories') {
        setIsCategoriesScreenOpen(true);
        setIsHistoryScreenOpen(false);
        setIsIncomeHistoryOpen(false);
        setIsRecurringScreenOpen(false);
        setIsAccountsScreenOpen(false);
      } else if (modal === 'subscriptions') {
        setIsSubscriptionManagerOpen(true);
        setIsHistoryScreenOpen(false);
        setIsIncomeHistoryOpen(false);
        setIsRecurringScreenOpen(false);
        setIsAccountsScreenOpen(false);
      }
    };
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (backListener) backListener.remove();
    };
  }, [onToast, isHistoryClosing, isRecurringClosing, isIncomeHistoryClosing, setAnalysisImage]);

  return {
    isFormOpen, setIsFormOpen,
    isCalculatorContainerOpen, setIsCalculatorContainerOpen,
    isImageSourceModalOpen, setIsImageSourceModalOpen,
    isVoiceModalOpen, setIsVoiceModalOpen,
    isRecurringScreenOpen, setIsRecurringScreenOpen, isRecurringClosing, setIsRecurringClosing,
    isHistoryScreenOpen, setIsHistoryScreenOpen, isHistoryClosing, setIsHistoryClosing,
    isIncomeHistoryOpen, setIsIncomeHistoryOpen, isIncomeHistoryClosing, setIsIncomeHistoryClosing,
    isAccountsScreenOpen, setIsAccountsScreenOpen,
    isQrModalOpen, setIsQrModalOpen,
    isUpdateModalOpen,
    setIsUpdateModalOpen,
    isMultipleExpensesModalOpen,
    setIsMultipleExpensesModalOpen,
    isBankSyncModalOpen,
    setIsBankSyncModalOpen,
    isHistoryFilterOpen, setIsHistoryFilterOpen,
    isSearchModalOpen, setIsSearchModalOpen,
    isChatModalOpen, setIsChatModalOpen,
    isBudgetModalOpen, setIsBudgetModalOpen,
    isCategoriesScreenOpen, setIsCategoriesScreenOpen,
    isSubscriptionManagerOpen, setIsSubscriptionManagerOpen,
    closeModalWithHistory,
    forceNavigateHome,
    closeAllModals
  };
};
