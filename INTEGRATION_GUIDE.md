# 🔗 Integration Guide - Auto Transaction Detection

## Come Integrare in App.tsx

Questa guida mostra **esattamente** come modificare `App.tsx` per integrare il sistema di auto-detection.

---

## 📦 Step 1: Importa i Componenti

Aggiungi questi import all'inizio di `App.tsx`:

```typescript
// Auto-Transaction Detection
import { useAutoTransactions } from './hooks/useAutoTransactions';
import PendingTransactionsModal from './components/PendingTransactionsModal';
import PendingTransactionsBadge from './components/PendingTransactionsBadge';
```

---

## 🎯 Step 2: Usa il Hook

Dentro il componente `App`, aggiungi il custom hook:

```typescript
const App: React.FC<{ onLogout: () => void; currentEmail: string }> = ({ onLogout, currentEmail }) => {
  // ... existing state ...

  // 🆕 Auto-Transaction Detection Hook
  const { 
    pendingCount, 
    isInitialized,
    notificationListenerEnabled,
    loadPending,
    requestNotificationPermission 
  } = useAutoTransactions();

  // State per modal pending transactions
  const [isPendingModalOpen, setIsPendingModalOpen] = useState(false);

  // ... rest of your code ...
}
```

---

## 📍 Step 3: Aggiungi Badge nell'Header

Modifica il componente `Header` per mostrare il badge:

```typescript
<Header 
    pendingSyncs={pendingImages.length} 
    isOnline={isOnline} 
    onInstallClick={handleInstallClick} 
    installPromptEvent={installPromptEvent} 
    onLogout={onLogout} 
    onShowQr={() => { window.history.pushState({ modal: 'qr' }, ''); nav.setIsQrModalOpen(true); }}
    // 🆕 AGGIUNGI QUESTO
    pendingTransactionsCount={pendingCount}
    onShowPendingTransactions={() => {
      window.history.pushState({ modal: 'pending-transactions' }, '');
      setIsPendingModalOpen(true);
    }}
/>
```

**NOTA**: Devi aggiornare `components/Header.tsx` per accettare queste props:

```typescript
// In Header.tsx
interface HeaderProps {
  // ... existing props ...
  pendingTransactionsCount?: number;
  onShowPendingTransactions?: () => void;
}

const Header: React.FC<HeaderProps> = ({
  // ... existing props ...
  pendingTransactionsCount = 0,
  onShowPendingTransactions
}) => {
  return (
    <header className="...">
      {/* ... existing content ... */}
      
      {/* Aggiungi badge prima del menu hamburger */}
      {onShowPendingTransactions && (
        <PendingTransactionsBadge 
          count={pendingTransactionsCount}
          onClick={onShowPendingTransactions}
        />
      )}
      
      {/* ... hamburger menu ... */}
    </header>
  );
};
```

---

## 💬 Step 4: Aggiungi la Modal

Alla fine del JSX in `App.tsx`, prima della chiusura `</div>`, aggiungi:

```typescript
return (
  <div className="h-full w-full bg-slate-100 flex flex-col font-sans">
    {/* ... existing content ... */}
    
    {/* 🆕 Pending Transactions Modal */}
    <PendingTransactionsModal 
      isOpen={isPendingModalOpen}
      onClose={() => {
        setIsPendingModalOpen(false);
        window.history.back();
        loadPending(); // Refresh count
      }}
      onAddExpense={handleAddExpense}
    />
    
    {/* ... other modals ... */}
  </div>
);
```

---

## 🔔 Step 5: Gestisci Navigation

Aggiungi gestione dello stato `pending-transactions` al tuo `useBackNavigation` hook:

```typescript
// In hooks/useBackNavigation.ts (se esiste) o direttamente in App.tsx

useEffect(() => {
  const handlePopState = (e: PopStateEvent) => {
    const modal = e.state?.modal;
    
    // ... existing modal handling ...
    
    if (modal === 'pending-transactions') {
      setIsPendingModalOpen(true);
    } else if (isPendingModalOpen) {
      setIsPendingModalOpen(false);
    }
  };

  window.addEventListener('popstate', handlePopState);
  return () => window.removeEventListener('popstate', handlePopState);
}, [isPendingModalOpen, /* other dependencies */]);
```

---

## ⚡ Step 6: (Opzionale) Mostra Alert se Notification Listener Non Abilitato

Aggiungi un banner informativo nella Dashboard:

```typescript
// In Dashboard.tsx o App.tsx
{!notificationListenerEnabled && isInitialized && (
  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
    <div className="flex items-start gap-3">
      <span className="text-2xl">🔔</span>
      <div className="flex-1">
        <h3 className="font-semibold text-yellow-900 mb-1">
          Abilita Rilevamento Automatico
        </h3>
        <p className="text-sm text-yellow-700 mb-3">
          Consenti all'app di leggere le notifiche bancarie per rilevare automaticamente le transazioni.
        </p>
        <button
          onClick={requestNotificationPermission}
          className="bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          Abilita Ora
        </button>
      </div>
    </div>
  </div>
)}
```

---

## 📊 Step 7: (Opzionale) Dashboard Widget

Aggiungi un widget nella Dashboard per mostrare pending transactions:

```typescript
// In Dashboard.tsx

interface DashboardProps {
  // ... existing props ...
  pendingTransactionsCount?: number;
  onNavigateToPending?: () => void;
}

// Nel render:
{pendingTransactionsCount > 0 && onNavigateToPending && (
  <div 
    className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-6 text-white cursor-pointer hover:shadow-lg transition-shadow"
    onClick={onNavigateToPending}
  >
    <div className="flex items-center justify-between">
      <div>
        <h3 className="text-lg font-semibold mb-1">
          🔔 Transazioni Rilevate
        </h3>
        <p className="text-indigo-100 text-sm">
          {pendingTransactionsCount} in attesa di conferma
        </p>
      </div>
      <div className="bg-white/20 rounded-full w-12 h-12 flex items-center justify-center text-2xl font-bold">
        {pendingTransactionsCount}
      </div>
    </div>
  </div>
)}
```

E passa le props da `App.tsx`:

```typescript
<Dashboard 
  // ... existing props ...
  pendingTransactionsCount={pendingCount}
  onNavigateToPending={() => {
    window.history.pushState({ modal: 'pending-transactions' }, '');
    setIsPendingModalOpen(true);
  }}
/>
```

---

## ✅ Step 8: Test

Dopo l'integrazione:

1. **Build Android**:
   ```bash
   npm run build:android
   ```

2. **Installa su dispositivo**:
   ```bash
   adb install android/app/build/outputs/apk/release/app-release.apk
   ```

3. **Abilita Notification Listener**:
   - Apri l'app
   - Clicca sul banner giallo "Abilita Rilevamento Automatico"
   - Abilita l'accesso alle notifiche

4. **Testa con SMS/Notifica**:
   - Ricevi un SMS da banca
   - Ricevi una notifica da app bancaria
   - Verifica che appaia il badge rosso nell'header
   - Clicca sul badge
   - Conferma/Ignora la transazione

---

## 🐛 Debug

### Console Log

```typescript
// In App.tsx, dopo useAutoTransactions:
useEffect(() => {
  console.log('Auto-transactions initialized:', isInitialized);
  console.log('Pending count:', pendingCount);
  console.log('Notification listener enabled:', notificationListenerEnabled);
}, [isInitialized, pendingCount, notificationListenerEnabled]);
```

### Logcat Android

```bash
adb logcat | grep -E "NotificationListener|AutoTransaction|SMSParser"
```

### IndexedDB Inspector

Apri Chrome DevTools → Application → IndexedDB → `expense-manager-db` → `auto-transactions`

---

## 💡 Tips

1. **Performance**: L'hook si inizializza solo una volta grazie a `isInitialized`.

2. **Battery**: Il NotificationListener usa eventi nativi Android, impatto minimo.

3. **Privacy**: Le transazioni restano locali fino a conferma, poi usano il tuo sistema di sync esistente.

4. **Cleanup**: Le transazioni ignorate/confermate vengono eliminate dopo 30 giorni automaticamente.

5. **Duplicati**: Hash MD5 previene duplicati tra SMS e notifiche.

---

## 🚀 Pronto!

Ora hai un sistema completo di auto-detection transazioni! 🎉

Per domande o problemi, controlla `SETUP_AUTO_TRANSACTIONS.md`.
