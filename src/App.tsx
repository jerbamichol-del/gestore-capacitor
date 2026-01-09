import React, { useEffect, useState, useRef } from 'react';
import AppRoutes from './AppRoutes';
import { useLocation, matchPath } from 'react-router-dom';
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
import MultipleExpensesModal from './components/MultipleExpensesModal';
import ShareQrModal from './components/ShareQrModal';
import { MainLayout } from './components/MainLayout';
import LoadingOverlay from './components/LoadingOverlay';

// Screens
import HistoryScreen from './screens/HistoryScreen';
import RecurringExpensesScreen from './screens/RecurringExpensesScreen';
import AccountsScreen from './screens/AccountsScreen';

// Hooks
import { useTransactions } from './context/TransactionsContext';
import { useUI } from './context/UIContext';
import { useAutoFlow } from './hooks/useAutoFlow';
import { usePendingImages } from './hooks/usePendingImages';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { useCloudSync } from './hooks/useCloudSync';
import { useInstallPrompt } from './hooks/useInstallPrompt';
import { usePrivacyGate } from './hooks/usePrivacyGate';
import { useUpdateChecker } from './hooks/useUpdateChecker';
import { App as CapApp } from '@capacitor/app';

const App: React.FC<{ onLogout: () => void; currentEmail: string }> = ({ onLogout, currentEmail }) => {
  const isOnline = useOnlineStatus();

  const {
    toast, showToast,
    isAddModalOpen, setIsAddModalOpen,
    editingExpense, setEditingExpense,
    editingRecurringExpense, setEditingRecurringExpense,
    isVoiceModalOpen, setIsVoiceModalOpen,
    isQrModalOpen, setIsQrModalOpen,
    isCalculatorContainerOpen, setIsCalculatorContainerOpen,
    isImageSourceModalOpen, setIsImageSourceModalOpen,
    isHistoryFilterOpen, setIsHistoryFilterOpen
  } = useUI();

  const [prefilledData, setPrefilledData] = useState<Partial<Expense> | null>(null);
  const formOpenedFromCalculatorRef = useRef(false);
  const location = useLocation();

  const closeModalWithHistory = () => {
    // If we have state, it's safer to go back. 
    // If not, we just close everything via UI state as fallback.
    if (window.history.state && window.history.state.modal) {
      window.history.back();
    } else {
      // Fallback: manually close all modals if history is lost
      setIsAddModalOpen(false);
      setEditingExpense(undefined);
      setIsVoiceModalOpen(false);
      setIsQrModalOpen(false);
      setIsCalculatorContainerOpen(false);
      setIsImageSourceModalOpen(false);
      setIsHistoryFilterOpen(false);
    }
  };

  const {
    accounts, expenses, recurringExpenses, setExpenses, setRecurringExpenses, setAccounts,
    handleAddExpense, handleDeleteRequest, deleteExpenses, deleteRecurringExpenses,
    isConfirmDeleteModalOpen, setIsConfirmDeleteModalOpen, confirmDelete,
    sanitizeExpenseData
  } = useTransactions();

  // 2. Pending Images
  const {
    pendingImages, setPendingImages, syncingImageId, setSyncingImageId,
    imageForAnalysis, setImageForAnalysis, refreshPendingImages,
    handleSharedFile, handleImagePick, sharedImageIdRef
  } = usePendingImages(isOnline, showToast);

  const [isParsingImage, setIsParsingImage] = useState(false);
  const [isMultipleExpensesModalOpen, setIsMultipleExpensesModalOpen] = useState(false);
  const [multipleExpensesData, setMultipleExpensesData] = useState<Partial<Omit<Expense, 'id'>>[]>([]);

  // 3. Auto Flow
  const auto = useAutoFlow(accounts, handleAddExpense, showToast);

  // 4. Update Checker
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const { updateInfo, isChecking: isCheckingUpdate, skipVersion } = useUpdateChecker();

  useEffect(() => {
    if (updateInfo && updateInfo.available && !isCheckingUpdate) {
      console.log('Update detected', updateInfo);
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
    expenses, setExpenses,
    recurringExpenses, setRecurringExpenses,
    accounts, setAccounts,
    showToast
  );

  // --- Image Analysis Handling ---
  useEffect(() => {
    if (imageForAnalysis) {
      handleAnalyzeImage(imageForAnalysis);
    }
  }, [imageForAnalysis]);

  // 8. History/Modal Sync
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state;
      const modal = state?.modal;

      // Close all modals by default, then open the one in state if any
      setIsQrModalOpen(modal === 'qr');
      setIsCalculatorContainerOpen(modal === 'calculator');
      setIsImageSourceModalOpen(modal === 'source');
      setIsVoiceModalOpen(modal === 'voice');
      setIsAddModalOpen(modal === 'form');
      setIsHistoryFilterOpen(modal === 'filter');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [
    setIsQrModalOpen,
    setIsCalculatorContainerOpen,
    setIsImageSourceModalOpen,
    setIsVoiceModalOpen,
    setIsAddModalOpen,
    setIsHistoryFilterOpen
  ]);

  const handleAnalyzeImage = async (image: OfflineImage) => {
    setImageForAnalysis(null); // Clear state immediately to prevent re-render loop
    if (!isOnline) { showToast({ message: 'Connettiti a internet per analizzare.', type: 'error' }); return; }
    setSyncingImageId(image.id);
    setIsParsingImage(true);
    try {
      const { parseExpensesFromImage } = await import('./utils/ai');
      const parsedData = await parseExpensesFromImage(image.base64Image, image.mimeType);

      if (parsedData?.length === 1) {
        setMultipleExpensesData([sanitizeExpenseData(parsedData[0], image.base64Image)]); // Workaround: logic seems expecting single but we might want consistent handling
        // ... (prefill single logic if confirmed, for now existing path)
        // For single item, existing flow:
        const singleData = sanitizeExpenseData(parsedData[0], image.base64Image);
        setEditingExpense(undefined); // Ensure we are in add mode
        setPrefilledData(singleData);
        setIsAddModalOpen(true);

      } else if (parsedData && parsedData.length > 1) {
        setMultipleExpensesData(parsedData.map(d => sanitizeExpenseData(d, image.base64Image)));
        setIsMultipleExpensesModalOpen(true);
      }
    } finally {
      setSyncingImageId(null);
      setIsParsingImage(false);
    }
  };

  const handleVoiceParsed = (data: Partial<Omit<Expense, 'id'>>) => {
    setPrefilledData(data);

    // Use history-aware close
    closeModalWithHistory();

    // Then open the form with the prefilled data
    setTimeout(() => {
      window.history.pushState({ modal: 'form' }, '');
      setIsAddModalOpen(true);
    }, 100);

    showToast({ message: 'Dati vocali rilevati', type: 'success' });
  };

  const handleImportFile = async (content: string) => {
    // Import file logic
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        // Assume it's an array of expenses
        parsed.forEach(e => handleAddExpense(e));
        showToast({ message: `Importati ${parsed.length} elementi`, type: 'success' });
      }
    } catch (e) {
      showToast({ message: 'Errore importazione file', type: 'error' });
    }
  };


  const isHistoryScreenOpen = !!matchPath('/history', location.pathname);
  const isIncomeHistoryOpen = !!matchPath('/income', location.pathname);

  // Logic for FAB position when history is open (if needed)
  // For now simple check
  const fabStyle = (isHistoryScreenOpen || isIncomeHistoryOpen) ? { bottom: `calc(90px + env(safe-area-inset-bottom, 0px))` } : undefined;

  return (
    <MainLayout
      header={
        <Header
          pendingSyncs={pendingImages.length}
          isOnline={isOnline}
          onInstallClick={handleInstallClick}
          installPromptEvent={installPromptEvent}
          onLogout={onLogout}
          onShowQr={() => { window.history.pushState({ modal: 'qr' }, ''); setIsQrModalOpen(true); }}
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
        !isCalculatorContainerOpen && !isHistoryFilterOpen && (
          <FloatingActionButton
            onAddManually={() => { window.history.pushState({ modal: 'calculator' }, ''); setIsCalculatorContainerOpen(true); }}
            onAddFromImage={() => { window.history.pushState({ modal: 'source' }, ''); setIsImageSourceModalOpen(true); }}
            onAddFromVoice={() => { window.history.pushState({ modal: 'voice' }, ''); setIsVoiceModalOpen(true); }}
            style={fabStyle}
          />
        )
      }
      modals={
        <>
          <SuccessIndicator show={false} /> {/* Removed data.showSuccessIndicator for now or add to context */}

          <CalculatorContainer
            isOpen={isCalculatorContainerOpen}
            onClose={closeModalWithHistory}
            onSubmit={(data) => {
              handleAddExpense(data);
              closeModalWithHistory();
            }}
            accounts={accounts}
            expenses={expenses}
            onEditExpense={(e) => {
              setEditingExpense(e);
              formOpenedFromCalculatorRef.current = isCalculatorContainerOpen;
              window.history.pushState({ modal: 'form' }, '');
              setIsAddModalOpen(true);
            }}
            onDeleteExpense={handleDeleteRequest}
            onMenuStateChange={() => { }}
          />

          <ExpenseForm
            isOpen={isAddModalOpen}
            onClose={closeModalWithHistory}
            onSubmit={(d) => {
              handleAddExpense(d, () => {
                if (isAddModalOpen) {
                  if (formOpenedFromCalculatorRef.current) {
                    formOpenedFromCalculatorRef.current = false;
                    window.history.back();
                    setTimeout(() => { window.history.back(); }, 50);
                  } else { window.history.back(); }
                } else if (isCalculatorContainerOpen) { closeModalWithHistory(); }
              });
            }}
            initialData={editingExpense || editingRecurringExpense}
            prefilledData={prefilledData}
            accounts={accounts}
            isForRecurringTemplate={!!editingRecurringExpense}
          />

          {isImageSourceModalOpen && (
            <div className="fixed inset-0 z-[5200] flex justify-center items-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={closeModalWithHistory}>
              <div className="bg-slate-50 rounded-lg shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ImageSourceCard icon={<CameraIcon className="w-8 h-8" />} title="Scatta Foto" description="Usa la fotocamera." onClick={() => { closeModalWithHistory(); handleImagePick('camera'); }} />
                  <ImageSourceCard icon={<ComputerDesktopIcon className="w-8 h-8" />} title="Galleria" description="Carica da file." onClick={() => { closeModalWithHistory(); handleImagePick('gallery'); }} />
                </div>
              </div>
            </div>
          )}

          <VoiceInputModal isOpen={isVoiceModalOpen} onClose={closeModalWithHistory} onParsed={handleVoiceParsed} />

          <ConfirmationModal isOpen={isConfirmDeleteModalOpen} onClose={() => setIsConfirmDeleteModalOpen(false)} onConfirm={confirmDelete} title="Conferma Eliminazione" message="Azione irreversibile." variant="danger" />

          {/* --- Overlay Modals (Auto/System) --- */}
          <UpdateAvailableModal isOpen={isUpdateModalOpen} onClose={() => setIsUpdateModalOpen(false)} onSkip={handleSkipUpdate} updateInfo={updateInfo} />
          <ShareQrModal isOpen={isQrModalOpen} onClose={closeModalWithHistory} userEmail={currentEmail} />
          <PinVerifierModal isOpen={isPinVerifierOpen} onClose={() => setIsPinVerifierOpen(false)} onSuccess={handlePinVerified} email={currentEmail} />
          <PendingTransactionsModal
            isOpen={auto.isPendingTransactionsModalOpen}
            onClose={() => auto.setIsPendingTransactionsModalOpen(false)}
            transactions={auto.pendingTransactions}
            expenses={expenses} // Pass existing expenses for duplicate check
            accounts={accounts}
            onConfirm={auto.handleConfirmTransaction}
            onIgnore={auto.handleIgnoreTransaction}
          />
          <TransferConfirmationModal
            isOpen={auto.isTransferConfirmationModalOpen}
            onClose={() => auto.setIsTransferConfirmationModalOpen(false)}
            transaction={auto.currentConfirmationTransaction}
            accounts={accounts}
            onConfirmAsTransfer={auto.handleConfirmAsTransfer}
            onConfirmAsExpense={auto.handleConfirmAsExpense}
          />
          <NotificationPermissionModal
            isOpen={auto.isNotificationPermissionModalOpen}
            onClose={() => auto.setIsNotificationPermissionModalOpen(false)}
            onEnableClick={async () => { await auto.requestNotificationPermission(); }}
            isEnabled={auto.isNotificationListenerEnabled}
          />

          <MultipleExpensesModal
            isOpen={isMultipleExpensesModalOpen}
            onClose={() => setIsMultipleExpensesModalOpen(false)}
            expenses={multipleExpensesData}
            accounts={accounts}
            onConfirm={(savedExpenses) => {
              savedExpenses.forEach(e => handleAddExpense(e));
              setIsMultipleExpensesModalOpen(false);
              showToast({ message: `${savedExpenses.length} spese salvate.`, type: 'success' });
            }}
          />

          {toast && <Toast message={toast.message} type={toast.type} onClose={() => showToast(null)} />}

        </>
      }
    >
      <AppRoutes
        currentEmail={currentEmail}
        onLogout={onLogout}
        onSync={() => handleSyncFromCloud(false)}
        isBalanceVisible={isBalanceVisible}
        onToggleBalanceVisibility={handleToggleBalanceVisibility}
      />
      <PendingImages images={pendingImages} onAnalyze={handleAnalyzeImage} onDelete={async (id) => { await deleteImageFromQueue(id); refreshPendingImages(); }} isOnline={isOnline} syncingImageId={syncingImageId} />

      {/* Global Loading Overlay for Image Analysis */}
      <LoadingOverlay isVisible={isParsingImage} message="Analisi scontrino in corso..." />


    </MainLayout>
  );
};

export default App;
