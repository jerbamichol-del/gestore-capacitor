import React, { useEffect, useState } from 'react';
import { OfflineImage, deleteImageFromQueue, addImageToQueue, getQueuedImages } from './utils/db';
import { Expense } from './types';

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
import { MainLayout } from './components/MainLayout';

// Screens
import HistoryScreen from './screens/HistoryScreen';
import RecurringExpensesScreen from './screens/RecurringExpensesScreen';
import AccountsScreen from './screens/AccountsScreen';

// Hooks
import { useTransactionsCore } from './hooks/useTransactionsCore';
import { useAutoFlow } from './hooks/useAutoFlow';
import { useAppUI } from './hooks/useAppUI';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { useCloudSync } from './hooks/useCloudSync';
import { useInstallPrompt } from './hooks/useInstallPrompt';
import { usePrivacyGate } from './hooks/usePrivacyGate';
import { useUpdateChecker } from './hooks/useUpdateChecker';
import { App as CapApp } from '@capacitor/app';

const App: React.FC<{ onLogout: () => void; currentEmail: string }> = ({ onLogout, currentEmail }) => {
  const isOnline = useOnlineStatus();

  // 1. UI State Manager (Navigation, Toasts, Forms, Image Parsing)
  const ui = useAppUI(isOnline);

  // 2. Data Core (Expenses, Accounts, Recurring)
  const data = useTransactionsCore(ui.showToast);

  // 3. Auto Flow (Notifications, SMS, Confirmations)
  const auto = useAutoFlow(data.accounts, data.handleAddExpense, ui.showToast);

  // 4. Update Checker
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const { updateInfo, isChecking: isCheckingUpdate, skipVersion } = useUpdateChecker();

  useEffect(() => {
    if (updateInfo && updateInfo.available && !isCheckingUpdate) {
      console.log('🚀 Update detected - showing modal', updateInfo);
      setIsUpdateModalOpen(true);
    }
  }, [updateInfo, isCheckingUpdate]);

  const handleSkipUpdate = () => {
    skipVersion();
    setIsUpdateModalOpen(false);
  };

  // 5. Install Prompt
  const { installPromptEvent, isInstallModalOpen, setIsInstallModalOpen, handleInstallClick } = useInstallPrompt();

  // 6. Privacy Gate
  const { isBalanceVisible, isPinVerifierOpen, setIsPinVerifierOpen, handleToggleBalanceVisibility, handlePinVerified } = usePrivacyGate();

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
      // Reset after triggering analysis (handleAnalyzeImage also nulls it, but safe to be sure)
      // ui.setImageForAnalysis(null); // Let handleAnalyzeImage do it after processing
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
        // Multi-expense logic could go here if implemented
        ui.showToast({ message: 'Trovate più spese, non ancora supportato.', type: 'info' });
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

  const handleVoiceParsed = (data: Partial<Omit<Expense, 'id'>>) => {
    ui.setPrefilledData(data);
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


  const fabStyle = (ui.nav.isHistoryScreenOpen && !ui.nav.isHistoryClosing) || (ui.nav.isIncomeHistoryOpen && !ui.nav.isIncomeHistoryClosing) ? { bottom: `calc(90px + env(safe-area-inset-bottom, 0px))` } : undefined;

  return (
    <MainLayout
      header={
        <Header
          pendingSyncs={ui.pendingImages.length}
          isOnline={isOnline}
          onInstallClick={handleInstallClick}
          installPromptEvent={installPromptEvent}
          onLogout={onLogout}
          onShowQr={() => { window.history.pushState({ modal: 'qr' }, ''); ui.nav.setIsQrModalOpen(true); }}
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
            onSubmit={data.handleAddExpense}
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
              data.handleAddExpense(d, () => {
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
            <div className="fixed inset-0 z-[5200] flex justify-center items-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={ui.nav.closeModalWithHistory}>
              <div className="bg-slate-50 rounded-lg shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
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
          <PinVerifierModal isOpen={isPinVerifierOpen} onClose={() => setIsPinVerifierOpen(false)} onSuccess={handlePinVerified} email={currentEmail} />
          <PendingTransactionsModal
            isOpen={auto.isPendingTransactionsModalOpen}
            onClose={() => auto.setIsPendingTransactionsModalOpen(false)}
            transactions={auto.pendingTransactions}
            accounts={data.accounts}
            onConfirm={auto.handleConfirmTransaction}
            onIgnore={auto.handleIgnoreTransaction}
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

          {ui.toast && <Toast message={ui.toast.message} type={ui.toast.type} onClose={() => ui.showToast(null as any)} />}

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
        </>
      }
    >
      <Dashboard
        accounts={data.accounts}
        expenses={data.expenses || []}
        recurringExpenses={data.recurringExpenses || []}
        onNavigateToRecurring={() => { window.history.pushState({ modal: 'recurring' }, ''); ui.nav.setIsRecurringScreenOpen(true); }}
        onNavigateToHistory={() => { window.history.pushState({ modal: 'history' }, ''); ui.nav.setIsHistoryClosing(false); ui.nav.setIsHistoryScreenOpen(true); }}
        onNavigateToIncomes={() => {
          if (!isBalanceVisible) { setIsPinVerifierOpen(true); } else {
            window.history.pushState({ modal: 'income_history' }, '');
            ui.nav.setIsIncomeHistoryClosing(false);
            ui.nav.setIsIncomeHistoryOpen(true);
          }
        }}
        onNavigateToAccounts={() => {
          if (!isBalanceVisible) { setIsPinVerifierOpen(true); } else {
            window.history.pushState({ modal: 'accounts' }, '');
            ui.nav.setIsAccountsScreenOpen(true);
          }
        }}
        onReceiveSharedFile={ui.handleSharedFile}
        onImportFile={(file: File) => {
          const reader = new FileReader();
          reader.onload = (e) => handleImportFile(e.target?.result as string);
          reader.readAsText(file);
        }}
        onSync={() => handleSyncFromCloud(false)}
        isBalanceVisible={isBalanceVisible}
        onToggleBalanceVisibility={handleToggleBalanceVisibility}
        showToast={ui.showToast}
      />
      <PendingImages images={ui.pendingImages} onAnalyze={handleAnalyzeImage} onDelete={async (id) => { await deleteImageFromQueue(id); ui.refreshPendingImages(); }} isOnline={isOnline} syncingImageId={ui.syncingImageId} />
    </MainLayout>
  );
};

export default App;
