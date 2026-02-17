import React, { useEffect, useState, useRef } from 'react';
import { OfflineImage, deleteImageFromQueue, addImageToQueue, getQueuedImages } from './utils/db';
import { Expense, EventBudget } from './types';

// Components
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import ExpenseForm from './components/ExpenseForm';
import FloatingActionButton from './components/FloatingActionButton';
import VoiceInputModal from './components/VoiceInputModal';
import ConfirmationModal from './components/ConfirmationModal';
import PendingImages from './components/PendingImages';
import Toast from './components/Toast';
import ImageSourceCard from './components/ImageSourceCard';
import UpdateAvailableModal from './components/UpdateAvailableModal';
import TransferConfirmationModal from './components/TransferConfirmationModal';
import { CameraIcon } from './components/icons/CameraIcon';
import { ComputerDesktopIcon } from './components/icons/ComputerDesktopIcon';
import CalculatorContainer from './components/CalculatorContainer';
import SuccessIndicator from './components/SuccessIndicator';
import PinVerifierModal from './components/PinVerifierModal';
import { PendingTransactionsModal, PendingTransactionsBadge } from './components/PendingTransactionsModal';
import { NotificationPermissionModal } from './components/NotificationPermissionModal';
import MultipleExpensesModal from './components/MultipleExpensesModal';
import { MainLayout } from './components/MainLayout';
import LoadingOverlay from './components/LoadingOverlay';
import ShareQrModal from './components/ShareQrModal';
import { BankSyncSettingsModal } from './components/BankSyncSettingsModal';
import GlobalSearchModal from './components/GlobalSearchModal';
import AIChatModal from './components/AIChatModal';
import BudgetSettingsModal from './components/BudgetSettingsModal';
import { BankSyncService } from './services/bank-sync-service';
import { Budgets } from './types';
import { LocalNotifications } from '@capacitor/local-notifications';
import { useRecurringNotifications } from './hooks/useRecurringNotifications';
import { EventBudgetsModal } from './components/EventBudgetsModal';

// Screens
import HistoryScreen from './screens/HistoryScreen';
import RecurringExpensesScreen from './screens/RecurringExpensesScreen';
import AccountsScreen from './screens/AccountsScreen';
import SecuritySettingsScreen from './screens/SecuritySettingsScreen';
import CardManagerScreen from './screens/CardManagerScreen';
import CategoriesSettingsScreen from './screens/CategoriesSettingsScreen'; // ✅ Import
import SubscriptionManagerScreen from './screens/SubscriptionManagerScreen';

// Settings Components
import SettingsSidebar from './components/SettingsSidebar';
import ThemePicker from './components/ThemePicker';
import ImportExportModal from './components/ImportExportModal';

// Hooks
import { useTransactionsCore } from './hooks/useTransactionsCore';
import { useAutoFlow } from './hooks/useAutoFlow';
import { useAppUI } from './hooks/useAppUI';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { useCloudSync } from './hooks/useCloudSync';
import { useInstallPrompt } from './hooks/useInstallPrompt';
import { usePrivacyGate } from './hooks/usePrivacyGate';
import { useUpdateChecker } from './hooks/useUpdateChecker';
import { useDashboardConfig } from './hooks/useDashboardConfig';
import { useSwipe } from './hooks/useSwipe';
import { App as CapApp } from '@capacitor/app';

const App: React.FC<{ onLogout: () => void; currentEmail: string; onEmailChanged: (newEmail: string) => void }> = ({ onLogout, currentEmail, onEmailChanged }) => {
  const isOnline = useOnlineStatus();

  // 1. UI State Manager (Navigation, Toasts, Forms, Image Parsing)
  const ui = useAppUI(isOnline);

  // 2. Data Core (Expenses, Accounts, Recurring, Events)
  const data = useTransactionsCore(ui.showToast);

  // 5. Budget State Local (Monthly)
  const [budgets, setBudgets] = useState<Budgets>(() => {
    const saved = localStorage.getItem('monthly_budgets_v1');
    return saved ? JSON.parse(saved) : {};
  });

  const handleSaveBudgets = (newBudgets: Budgets) => {
    setBudgets(newBudgets);
    localStorage.setItem('monthly_budgets_v1', JSON.stringify(newBudgets));
    ui.showToast({ message: 'Budget aggiornati!', type: 'success' });
  };

  const checkBudgetAndNotify = async (newExpense: Omit<Expense, 'id'> | Expense) => {
    if (newExpense.type !== 'expense') return;

    // Check Global
    const globalLimit = budgets['total'] || 0;
    const catLimit = budgets[newExpense.category] || 0;

    if (globalLimit <= 0 && catLimit <= 0) return;

    const now = new Date(newExpense.date || new Date());
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Calculate current totals locally to include the new expense immediately
    const relevantExpenses = data.expenses.filter(e => {
      const d = new Date(e.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear && e.type === 'expense';
    });

    // Add new expense amount
    const newAmount = Number(newExpense.amount);

    // Check Category Budget
    if (catLimit > 0) {
      const catSpent = relevantExpenses
        .filter(e => e.category === newExpense.category)
        .reduce((sum, e) => sum + Number(e.amount), 0) + newAmount;

      if (catSpent > catLimit) {
        await LocalNotifications.schedule({
          notifications: [{
            title: '⚠️ Budget Superato!',
            body: `Hai superato il budget per ${newExpense.category}. Speso: ${catSpent.toFixed(2)}€ / ${catLimit}€`,
            id: Date.now(), // Unique ID
            schedule: { at: new Date(Date.now() + 1000) } // 1 sec delay
          }]
        });
      }
    }
  };

  // 3. Auto Flow (Notifications, SMS, Confirmations)
  const auto = useAutoFlow(data.accounts, (e) => { data.handleAddExpense(e); checkBudgetAndNotify(e); }, ui.showToast, data.expenses, data.setExpenses);

  // 4. Recurring Notifications
  useRecurringNotifications(data.recurringExpenses);

  // 4. Update Checker
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const { updateInfo, isChecking: isCheckingUpdate, skipVersion, checkForUpdates, clearSkipped } = useUpdateChecker();

  // 5. Settings Sidebar & Screens
  const [isSettingsSidebarOpen, setIsSettingsSidebarOpen] = useState(false);
  const [isThemePickerOpen, setIsThemePickerOpen] = useState(false);
  const [isSecurityScreenOpen, setIsSecurityScreenOpen] = useState(false);
  const [isCardManagerOpen, setIsCardManagerOpen] = useState(false);
  const [isImportExportModalOpen, setIsImportExportModalOpen] = useState(false);

  const [pendingSubscriptionData, setPendingSubscriptionData] = useState<Partial<Expense> | null>(null);

  // Event Budgets Modal State
  const [isEventBudgetsOpen, setIsEventBudgetsOpen] = useState(false);

  // 6. Dashboard Config (Visible Cards & Order)
  const dashboardConfig = useDashboardConfig();

  // 7. Global Edge Swipe to Open Sidebar
  const mainLayoutRef = useRef<HTMLDivElement>(null);
  const { progress: swipeProgress, isSwiping: isDraggingSidebar } = useSwipe(mainLayoutRef, {
    onSwipeRight: () => {
      if (!isSettingsSidebarOpen) setIsSettingsSidebarOpen(true);
    }
  }, {
    maxStartX: 40, // Only trigger if swipe starts at the very left edge
    enabled: !ui.nav.isHistoryFilterOpen && !ui.nav.isCalculatorContainerOpen && !isCardManagerOpen && !ui.nav.isAccountsScreenOpen && !ui.nav.isRecurringScreenOpen && !ui.nav.isHistoryScreenOpen
  });


  useEffect(() => {
    if (updateInfo && updateInfo.available && !isCheckingUpdate) {
      console.log('🚀 Update detected - showing modal', updateInfo);
      setIsUpdateModalOpen(true);
    }
  }, [updateInfo, isCheckingUpdate]);

  // Handle back button for CardManagerScreen
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const modal = event.state?.modal;
      if (modal !== 'card_manager' && isCardManagerOpen) {
        setIsCardManagerOpen(false);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isCardManagerOpen]);

  // Handle bank sync on resume
  useEffect(() => {
    const handleResume = async () => {
      console.log('🔄 App resumed - checking bank sync');
      try {
        const result = await BankSyncService.syncAll();
        if (result.transactions > 0 || result.adjustments > 0) {
          let msg = "";
          if (result.transactions > 0) msg += `${result.transactions} nuovi movimenti. `;
          if (result.adjustments > 0) msg += `Patrimonio aggiornato.`;
          ui.showToast({ message: msg.trim(), type: 'success' });
        }
      } catch (e) {
        console.warn('Silent bank sync failed:', e);
      }
    };

    const resumeListener = CapApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) handleResume();
    });

    return () => {
      resumeListener.then(l => l.remove());
    };
  }, []);

  // Handle Web Shortcuts (PWA Query Params)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'quick_add') {
      window.history.replaceState({}, '', window.location.pathname);
      setTimeout(() => {
        ui.nav.setIsCalculatorContainerOpen(true);
      }, 500);
    }
  }, [ui.nav]);

  // Handle Quick Actions (Deep Links)
  useEffect(() => {
    const listenerPromise = CapApp.addListener('appUrlOpen', (data) => {
      if (data.url.includes('quick') || data.url.includes('add')) {
        console.log('🚀 Quick Add triggered via Deep Link');
        // Small delay to ensure UI is ready if cold start
        setTimeout(() => {
          ui.nav.setIsCalculatorContainerOpen(true);
        }, 300);
      }
    });

    return () => {
      listenerPromise.then(handle => handle.remove());
    };
  }, [ui.nav]);

  // Wrapper for Add Expense to include checks
  const handleAddExpenseWithChecks = (expense: Omit<Expense, 'id'> | Expense, callback?: () => void) => {
    data.handleAddExpense(expense, callback);
    checkBudgetAndNotify(expense);
  };


  const handleSkipUpdate = () => {
    skipVersion();
    setIsUpdateModalOpen(false);
  };

  const handleManualUpdateCheck = async () => {
    clearSkipped();
    const info = await checkForUpdates(true);
    if (info.available) {
      setIsUpdateModalOpen(true);
    } else {
      ui.showToast({ message: 'L\'app è già aggiornata!', type: 'info' });
    }
  };

  // 5. Install Prompt
  const { installPromptEvent, isInstallModalOpen, setIsInstallModalOpen, handleInstallClick } = useInstallPrompt();

  // 6. Privacy Gate
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const { isBalanceVisible, isPinVerifierOpen, setIsPinVerifierOpen, handleToggleBalanceVisibility, handlePinVerified: coreHandlePinVerified } = usePrivacyGate();

  const handlePinVerified = () => {
    coreHandlePinVerified();
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  };

  // 7. Cloud Sync
  const { handleSyncFromCloud } = useCloudSync(
    currentEmail, isOnline,
    data.expenses, data.setExpenses,
    data.recurringExpenses, data.setRecurringExpenses,
    data.accounts, data.setAccounts,
    ui.showToast
  );

  // --- Image Analysis Handling ---
  useEffect(() => {
    if (ui.imageForAnalysis) {
      handleAnalyzeImage(ui.imageForAnalysis);
    }
  }, [ui.imageForAnalysis]);

  const handleAnalyzeImage = async (image: OfflineImage) => {
    if (!isOnline) { ui.showToast({ message: 'Connettiti a internet per analizzare.', type: 'error' }); return; }
    ui.setSyncingImageId(image.id);
    ui.setIsParsingImage(true);
    try {
      const { parseExpensesFromImage } = await import('./utils/ai');
      const parsedData = await parseExpensesFromImage(image.base64Image, image.mimeType);

      if (parsedData?.length === 1) {
        ui.setPrefilledData(data.sanitizeExpenseData(parsedData[0], image.base64Image));
        window.history.replaceState({ modal: 'form' }, '');
        ui.nav.setIsFormOpen(true);
      } else if (parsedData && parsedData.length > 1) {
        // Handle multiple expenses
        ui.setMultipleExpensesData(parsedData.map(e => data.sanitizeExpenseData(e, image.base64Image)));
        ui.nav.setIsMultipleExpensesModalOpen(true);
        window.history.replaceState({ modal: 'multiple_expenses' }, '');
      } else {
        ui.showToast({ message: 'Nessuna spesa trovata.', type: 'error' });
      }

      await deleteImageFromQueue(image.id);
      ui.refreshPendingImages();
    } catch (error) {
      console.error('Error analyzing image:', error);
      ui.showToast({ message: 'Errore durante l\'analisi.', type: 'error' });
    } finally {
      ui.setSyncingImageId(null);
      ui.setIsParsingImage(false);
    }
  };

  const handleVoiceParsed = (voiceData: Partial<Omit<Expense, 'id'>>) => {
    ui.setPrefilledData(voiceData);
    ui.nav.setIsVoiceModalOpen(false);

    // Open form
    window.history.pushState({ modal: 'form' }, '');
    ui.nav.setIsFormOpen(true);

    ui.showToast({ message: 'Dati vocali rilevati', type: 'success' });
  };

  const handleImportFile = async (content: string) => {
    // Import file logic
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        // Assume it's an array of expenses
        parsed.forEach(e => data.handleAddExpense(e));
        ui.showToast({ message: `Importati ${parsed.length} elementi`, type: 'success' });
      }
    } catch (e) {
      ui.showToast({ message: 'Errore importazione file', type: 'error' });
    }
  };

  // Event Budget Handlers
  const handleSaveEventBudget = (budget: EventBudget) => {
    data.setEventBudgets(prev => {
      const exists = prev.find(p => p.id === budget.id);
      if (exists) return prev.map(p => p.id === budget.id ? budget : p);
      return [...prev, budget];
    });
  };

  const handleDeleteEventBudget = (id: string) => {
    data.setEventBudgets(prev => prev.filter(p => p.id !== id));
  };


  const fabStyle = (ui.nav.isHistoryScreenOpen && !ui.nav.isHistoryClosing) || (ui.nav.isIncomeHistoryOpen && !ui.nav.isIncomeHistoryClosing) ? { bottom: `calc(90px + env(safe-area-inset-bottom, 0px))` } : undefined;

  return (
    <MainLayout
      ref={mainLayoutRef}
      header={
        <Header
          pendingSyncs={ui.pendingImages.length}
          isOnline={isOnline}
          onInstallClick={handleInstallClick}
          installPromptEvent={installPromptEvent}
          onOpenSettings={() => setIsSettingsSidebarOpen(true)}
          onLogout={onLogout}
          isNotificationListenerEnabled={auto.isNotificationListenerEnabled}
          requestNotificationPermission={auto.requestNotificationPermission}
        />
      }
      badges={
        auto.pendingCount > 0 ? (
          <PendingTransactionsBadge
            count={auto.pendingCount}
            onClick={() => auto.setIsPendingTransactionsModalOpen(true)}
          />
        ) : null
      }
      fab={
        !ui.nav.isCalculatorContainerOpen && !ui.nav.isHistoryFilterOpen && (
          <FloatingActionButton
            onAddManually={() => { window.history.pushState({ modal: 'calculator' }, ''); ui.nav.setIsCalculatorContainerOpen(true); }}
            onAddFromImage={() => { window.history.pushState({ modal: 'source' }, ''); ui.nav.setIsImageSourceModalOpen(true); }}
            onAddFromVoice={() => { window.history.pushState({ modal: 'voice' }, ''); ui.nav.setIsVoiceModalOpen(true); }}
            onSearch={() => { window.history.pushState({ modal: 'search' }, ''); ui.nav.setIsSearchModalOpen(true); }}
            onChat={() => { window.history.pushState({ modal: 'chat' }, ''); ui.nav.setIsChatModalOpen(true); }}
            style={fabStyle}
          />
        )
      }
      modals={
        <>
          <SuccessIndicator show={data.showSuccessIndicator} />

          <CalculatorContainer
            isOpen={ui.nav.isCalculatorContainerOpen}
            onClose={ui.nav.closeModalWithHistory}
            onSubmit={(d) => {
              handleAddExpenseWithChecks(d);
              ui.nav.closeModalWithHistory();
            }}
            accounts={data.accounts}
            expenses={data.expenses}
            onEditExpense={(e) => {
              ui.setEditingExpense(e);
              ui.formOpenedFromCalculatorRef.current = ui.nav.isCalculatorContainerOpen;
              window.history.pushState({ modal: 'form' }, '');
              ui.nav.setIsFormOpen(true);
            }}
            onDeleteExpense={data.handleDeleteRequest}
            onMenuStateChange={() => { }}
          />

          <ExpenseForm
            isOpen={ui.nav.isFormOpen}
            onClose={ui.nav.closeModalWithHistory}
            onSubmit={(d) => {
              handleAddExpenseWithChecks(d, () => {
                if (ui.nav.isFormOpen) {
                  if (ui.formOpenedFromCalculatorRef.current) {
                    ui.formOpenedFromCalculatorRef.current = false;
                    window.history.back();
                    setTimeout(() => { window.history.back(); }, 50);
                  } else { window.history.back(); }
                } else if (ui.nav.isCalculatorContainerOpen) { ui.nav.closeModalWithHistory(); }
              });
            }}
            initialData={ui.editingExpense || ui.editingRecurringExpense}
            prefilledData={ui.prefilledData}
            accounts={data.accounts}
            isForRecurringTemplate={!!ui.editingRecurringExpense}
          />

          {ui.nav.isImageSourceModalOpen && (
            <div className="fixed inset-0 z-[5200] flex justify-center items-center p-4 bg-midnight/60 backdrop-blur-md" onClick={ui.nav.closeModalWithHistory}>
              <div className="bg-white dark:bg-midnight-card rounded-lg shadow-xl w-full max-w-lg border border-transparent dark:border-electric-violet/30" onClick={(e) => e.stopPropagation()}>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ImageSourceCard icon={<CameraIcon className="w-8 h-8" />} title="Scatta Foto" description="Usa la fotocamera." onClick={() => { ui.nav.setIsImageSourceModalOpen(false); ui.handleImagePick('camera'); }} />
                  <ImageSourceCard icon={<ComputerDesktopIcon className="w-8 h-8" />} title="Galleria" description="Carica da file." onClick={() => { ui.nav.setIsImageSourceModalOpen(false); ui.handleImagePick('gallery'); }} />
                </div>
              </div>
            </div>
          )}

          <VoiceInputModal isOpen={ui.nav.isVoiceModalOpen} onClose={ui.nav.closeModalWithHistory} onParsed={handleVoiceParsed} />

          <ConfirmationModal isOpen={data.isConfirmDeleteModalOpen} onClose={() => data.setIsConfirmDeleteModalOpen(false)} onConfirm={data.confirmDelete} title="Conferma Eliminazione" message="Azione irreversibile." variant="danger" />

          {/* --- Overlay Modals (Auto/System) --- */}
          <UpdateAvailableModal isOpen={isUpdateModalOpen} onClose={() => setIsUpdateModalOpen(false)} onSkip={handleSkipUpdate} updateInfo={updateInfo} />
          <PinVerifierModal isOpen={isPinVerifierOpen} onClose={() => { setIsPinVerifierOpen(false); setPendingAction(null); }} onSuccess={handlePinVerified} email={currentEmail} />
          <PendingTransactionsModal
            isOpen={auto.isPendingTransactionsModalOpen}
            onClose={() => auto.setIsPendingTransactionsModalOpen(false)}
            transactions={auto.pendingTransactions}
            expenses={data.expenses}
            accounts={data.accounts}
            onConfirm={auto.handleConfirmTransaction}
            onIgnore={auto.handleIgnoreTransaction}
            onIgnoreAll={auto.handleIgnoreAllTransactions}
          />
          <TransferConfirmationModal
            isOpen={auto.isTransferConfirmationModalOpen}
            onClose={() => auto.setIsTransferConfirmationModalOpen(false)}
            transaction={auto.currentConfirmationTransaction}
            accounts={data.accounts}
            onConfirmAsTransfer={auto.handleConfirmAsTransfer}
            onConfirmAsExpense={auto.handleConfirmAsExpense}
          />
          <NotificationPermissionModal
            isOpen={auto.isNotificationPermissionModalOpen}
            onClose={() => auto.setIsNotificationPermissionModalOpen(false)}
            onEnableClick={async () => { await auto.requestNotificationPermission(); }}
            isEnabled={auto.isNotificationListenerEnabled}
          />

          {ui.toast && <Toast message={ui.toast.message} type={ui.toast.type} onClose={() => ui.showToast(null)} />}

          {/* Screens */}
          {ui.nav.isRecurringScreenOpen && (
            <RecurringExpensesScreen
              recurringExpenses={data.recurringExpenses}
              expenses={data.expenses}
              accounts={data.accounts}
              onClose={() => ui.nav.closeModalWithHistory()}
              onEdit={(e) => {
                ui.setEditingRecurringExpense(e);
                window.history.pushState({ modal: 'form' }, '');
                ui.nav.setIsFormOpen(true);
              }}
              onDelete={data.handleDeleteRequest}
              onDeleteRecurringExpenses={data.deleteRecurringExpenses}
              onLinkSubscription={(expense) => {
                setPendingSubscriptionData(expense);
                window.history.pushState({ modal: 'subscriptions' }, '');
                ui.nav.setIsSubscriptionManagerOpen(true);
              }}
            />
          )}

          {ui.nav.isSubscriptionManagerOpen && (
            <SubscriptionManagerScreen
              accounts={data.accounts}
              recurringExpenses={data.recurringExpenses}
              onClose={() => ui.nav.closeModalWithHistory()}
              onAddRecurringExpense={(expense) => {
                data.setRecurringExpenses(prev => [expense, ...prev]);
              }}
              initialSubscription={pendingSubscriptionData ? {
                name: pendingSubscriptionData.description || pendingSubscriptionData.subcategory || '',
                amount: Number(pendingSubscriptionData.amount),
                category: pendingSubscriptionData.category,
                linkedRecurringExpenseId: pendingSubscriptionData.id,
                frequency: pendingSubscriptionData.recurrence === 'monthly' ? 'monthly' : 'yearly'
              } : undefined}
            />
          )}

          {(ui.nav.isHistoryScreenOpen || ui.nav.isIncomeHistoryOpen) && (
            <HistoryScreen
              filterType={ui.nav.isIncomeHistoryOpen ? 'income' : 'expense'}
              onClose={() => ui.nav.closeModalWithHistory()}
              expenses={data.expenses}
              accounts={data.accounts}
              onEditExpense={(e) => {
                ui.setEditingExpense(e);
                window.history.pushState({ modal: 'form' }, '');
                ui.nav.setIsFormOpen(true);
              }}
              onDeleteExpense={data.handleDeleteRequest}
              onDeleteExpenses={data.deleteExpenses}
              isEditingOrDeleting={ui.nav.isFormOpen || data.isConfirmDeleteModalOpen}
              onDateModalStateChange={() => { }}
              onFilterPanelOpenStateChange={(isOpen) => ui.nav.setIsHistoryFilterOpen(isOpen)}
              isOverlayed={false}
            />
          )}

          {ui.nav.isMultipleExpensesModalOpen && (
            <MultipleExpensesModal
              isOpen={ui.nav.isMultipleExpensesModalOpen}
              expenses={ui.multipleExpensesData}
              accounts={data.accounts}
              onClose={() => ui.nav.closeModalWithHistory()}
              onConfirm={(expenses) => {
                expenses.forEach(exp => data.handleAddExpense(exp));
                ui.nav.closeModalWithHistory();
                ui.showToast({ message: `${expenses.length} spese aggiunte!`, type: 'success' });
              }}
            />
          )}

          {ui.nav.isAccountsScreenOpen && (
            <AccountsScreen
              expenses={data.expenses}
              accounts={data.accounts}
              onClose={() => ui.nav.closeModalWithHistory()}
              onDeleteTransaction={data.handleDeleteRequest}
              onAddTransaction={data.handleAddExpense}
              onDeleteTransactions={data.deleteExpenses}
            />
          )}

          <EventBudgetsModal
            isOpen={isEventBudgetsOpen}
            onClose={() => setIsEventBudgetsOpen(false)}
            eventBudgets={data.eventBudgets}
            onSaveEventBudget={handleSaveEventBudget}
            onDeleteEventBudget={handleDeleteEventBudget}
            expenses={data.expenses}
          />
        </>
      }
    >
      <Dashboard
        items={dashboardConfig.items}
        onOrderChange={dashboardConfig.saveOrder}
        onRemoveCard={dashboardConfig.toggleCard}
        accounts={data.accounts}
        expenses={data.expenses || []}
        recurringExpenses={data.recurringExpenses || []}
        eventBudgets={data.eventBudgets} // Pass new event budgets
        onNavigateToRecurring={() => { window.history.pushState({ modal: 'recurring' }, ''); ui.nav.setIsRecurringScreenOpen(true); }}
        onNavigateToSubscriptions={() => { window.history.pushState({ modal: 'subscriptions' }, ''); ui.nav.setIsSubscriptionManagerOpen(true); }}
        onNavigateToHistory={() => { window.history.pushState({ modal: 'history' }, ''); ui.nav.setIsHistoryClosing(false); ui.nav.setIsHistoryScreenOpen(true); }}
        onNavigateToIncomes={() => {
          const action = () => {
            window.history.pushState({ modal: 'income_history' }, '');
            ui.nav.setIsIncomeHistoryClosing(false);
            ui.nav.setIsIncomeHistoryOpen(true);
          };
          if (!isBalanceVisible) {
            setPendingAction(() => action);
            setIsPinVerifierOpen(true);
          } else {
            action();
          }
        }}
        onNavigateToAccounts={() => {
          const action = () => {
            window.history.pushState({ modal: 'accounts' }, '');
            ui.nav.setIsAccountsScreenOpen(true);
          };
          if (!isBalanceVisible) {
            setPendingAction(() => action);
            setIsPinVerifierOpen(true);
          } else {
            action();
          }
        }}
        onReceiveSharedFile={ui.handleSharedFile}
        onImportFile={(file: File) => {
          const reader = new FileReader();
          reader.onload = (e) => handleImportFile(e.target?.result as string);
          reader.readAsText(file);
        }}
        onSync={() => handleSyncFromCloud(false)}
        onOpenBankSyncSettings={() => {
          window.history.pushState({ modal: 'bank_sync' }, '');
          ui.nav.setIsBankSyncModalOpen(true);
        }}
        isBalanceVisible={isBalanceVisible}
        onToggleBalanceVisibility={handleToggleBalanceVisibility}
        showToast={ui.showToast}
        budgets={budgets} // Pass budgets
        onOpenBudgetSettings={() => {
          window.history.pushState({ modal: 'budget' }, '');
          ui.nav.setIsBudgetModalOpen(true);
        }}
        onOpenEventBudgets={() => setIsEventBudgetsOpen(true)} // Open event budgets
        isDraggingDisabled={
          ui.nav.isHistoryScreenOpen ||
          ui.nav.isIncomeHistoryOpen ||
          ui.nav.isRecurringScreenOpen ||
          ui.nav.isAccountsScreenOpen ||
          ui.nav.isSubscriptionManagerOpen ||
          ui.nav.isCalculatorContainerOpen ||
          ui.nav.isFormOpen ||
          ui.nav.isBankSyncModalOpen ||
          isPinVerifierOpen
        }
        onOpenCardManager={() => setIsCardManagerOpen(true)}
      />
      <PendingImages images={ui.pendingImages} onAnalyze={handleAnalyzeImage} onDelete={async (id) => { await deleteImageFromQueue(id); ui.refreshPendingImages(); }} isOnline={isOnline} syncingImageId={ui.syncingImageId} />

      {/* Global Loading Overlay for Image Analysis */}
      <LoadingOverlay isVisible={ui.isParsingImage} message="Analisi scontrino in corso..." />

      {/* QR Share Modal */}
      <ShareQrModal
        isOpen={ui.nav.isQrModalOpen}
        onClose={() => ui.nav.setIsQrModalOpen(false)}
      />

      {/* Bank Sync Settings */}
      <BankSyncSettingsModal
        isOpen={ui.nav.isBankSyncModalOpen}
        onClose={() => ui.nav.closeModalWithHistory()}
        showToast={ui.showToast}
      />

      <GlobalSearchModal
        isOpen={ui.nav.isSearchModalOpen}
        onClose={() => ui.nav.closeModalWithHistory()}
        expenses={data.expenses}
        accounts={data.accounts}
        onSelectExpense={(e) => {
          ui.setEditingExpense(e);
          window.history.pushState({ modal: 'form' }, '');
          ui.nav.setIsFormOpen(true);
        }}
      />

      <AIChatModal
        isOpen={ui.nav.isChatModalOpen}
        onClose={() => ui.nav.closeModalWithHistory()}
        expenses={data.expenses}
        accounts={data.accounts}
      />

      <BudgetSettingsModal
        isOpen={ui.nav.isBudgetModalOpen}
        onClose={() => ui.nav.closeModalWithHistory()}
        currentBudgets={budgets}
        onSave={handleSaveBudgets}
      />

      {/* Categories Settings Screen */}
      {ui.nav.isCategoriesScreenOpen && (
        <CategoriesSettingsScreen
          onBack={() => {
            window.history.back();
            ui.nav.setIsCategoriesScreenOpen(false);
          }}
        />
      )}

      {/* Settings Sidebar */}
      <SettingsSidebar
        isOpen={isSettingsSidebarOpen}
        onClose={() => setIsSettingsSidebarOpen(false)}
        email={currentEmail}
        onShowQr={() => { window.history.pushState({ modal: 'qr' }, ''); ui.nav.setIsQrModalOpen(true); }}
        onOpenImportExport={() => {
          // window.history.pushState({ modal: 'import_export_main' }, ''); // Optional history support
          setIsImportExportModalOpen(true);
        }}
        onOpenCardManager={() => { window.history.pushState({ modal: 'card_manager' }, ''); setIsCardManagerOpen(true); }}
        onOpenThemePicker={() => setIsThemePickerOpen(true)}
        onOpenSecurity={() => setIsSecurityScreenOpen(true)}
        onOpenBudgetSettings={() => {
          window.history.pushState({ modal: 'budget' }, '');
          ui.nav.setIsBudgetModalOpen(true);
        }}
        onOpenEventBudgets={() => setIsEventBudgetsOpen(true)}
        onOpenCategories={() => {
          window.history.pushState({ modal: 'categories' }, '');
          ui.nav.setIsCategoriesScreenOpen(true);
        }}
        onOpenSubscriptions={() => {
          window.history.pushState({ modal: 'subscriptions' }, '');
          ui.nav.setIsSubscriptionManagerOpen(true);
        }}
        onOpenBankSync={() => ui.nav.setIsBankSyncModalOpen(true)}
        onCheckUpdate={handleManualUpdateCheck}
        onLogout={onLogout}
        isSwiping={isDraggingSidebar}
        openProgress={swipeProgress}
      />

      {/* Theme Picker */}
      <ThemePicker
        isOpen={isThemePickerOpen}
        onClose={() => setIsThemePickerOpen(false)}
      />

      {/* Security Settings */}
      <SecuritySettingsScreen
        isOpen={isSecurityScreenOpen}
        onClose={() => setIsSecurityScreenOpen(false)}
        email={currentEmail}
        onForgotPassword={() => {
          // Navigate to forgot password - this would need integration with AuthGate
          ui.showToast({ message: 'Apri l\'app e usa "Password dimenticata" dal login', type: 'info' });
        }}
        onEmailChanged={onEmailChanged}
      />

      {/* Card Manager */}
      <CardManagerScreen
        isOpen={isCardManagerOpen}
        onClose={() => { if (window.history.state?.modal === 'card_manager') window.history.back(); setIsCardManagerOpen(false); }}
        items={dashboardConfig.items}
        onToggleCard={dashboardConfig.toggleCard}
        expenses={data.expenses}
        accounts={data.accounts}
        budgets={budgets}
        onOpenBudgetSettings={() => {
          setIsCardManagerOpen(false);
          setTimeout(() => ui.nav.setIsBudgetModalOpen(true), 150);
        }}
      />

      <ImportExportModal
        isOpen={isImportExportModalOpen}
        onClose={() => setIsImportExportModalOpen(false)}
        onImportFile={(file) => {
          const reader = new FileReader();
          reader.onload = (e) => handleImportFile(e.target?.result as string);
          reader.readAsText(file);
        }}
        onSync={handleSyncFromCloud}
        onOpenBankSyncSettings={() => {
          setIsImportExportModalOpen(false);
          setTimeout(() => ui.nav.setIsBankSyncModalOpen(true), 150);
        }}
        expenses={data.expenses}
        showToast={ui.showToast}
      />

    </MainLayout>
  );
};

export default App;
