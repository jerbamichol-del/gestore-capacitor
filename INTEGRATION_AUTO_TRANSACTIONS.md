# Integrazione Auto-Transaction Detection

Guida completa per integrare il sistema di rilevamento automatico transazioni nell'app.

## 📚 Panoramica

Il sistema rileva automaticamente le transazioni bancarie dalle notifiche di 7 app:
- ✅ **Revolut**
- ✅ **PayPal**
- ✅ **Postepay**
- ✅ **BBVA**
- ✅ **Intesa Sanpaolo**
- ✅ **BNL**
- ✅ **UniCredit**

## 🛠️ Componenti Creati

### 1. Services
- `src/services/notification-transaction-parser.ts` - Parser con pattern per tutte le banche
- `src/services/notification-listener-service.ts` - Gestione transazioni pendenti

### 2. Hooks
- `src/hooks/useNotificationListener.ts` - Hook React per usare il servizio

### 3. Components
- `src/components/PendingTransactionsModal.tsx` - Modal per confermare/ignorare transazioni
- `src/components/PendingTransactionsModal.tsx` (PendingTransactionsBadge) - Badge con contatore

### 4. Android
- `android-config/BankNotificationListenerService.java` - Servizio background Android
- `android-config/NotificationListenerPlugin.java` - Bridge Capacitor con BroadcastReceiver
- `src/plugins/notification-listener.ts` - Interface TypeScript

## 🚀 Integrazione in App.tsx

### Step 1: Importa Hook e Componenti

```typescript
import { useNotificationListener } from './hooks/useNotificationListener';
import { 
  PendingTransactionsModal, 
  PendingTransactionsBadge 
} from './components/PendingTransactionsModal';
import { useState } from 'react';
```

### Step 2: Usa l'Hook nell'App

```typescript
function App() {
  const [showPendingModal, setShowPendingModal] = useState(false);
  
  const {
    pendingTransactions,
    pendingCount,
    isEnabled,
    requestPermission,
    confirmTransaction,
    ignoreTransaction,
  } = useNotificationListener();

  // ... resto del codice
}
```

### Step 3: Gestisci Conferma Transazione

```typescript
const handleConfirmTransaction = async (
  id: string, 
  transaction: PendingTransaction
) => {
  try {
    // 1. Conferma nel servizio
    await confirmTransaction(id);
    
    // 2. Aggiungi alla tua lista spese
    const newExpense: Expense = {
      id: Date.now().toString(),
      description: transaction.description,
      amount: transaction.amount,
      date: new Date(transaction.timestamp).toISOString().split('T')[0],
      category: 'Spesa', // Oppure usa categorizzazione automatica
      account: transaction.appName, // Nome banca
      type: transaction.type === 'expense' ? 'expense' : 'income',
    };
    
    // Aggiungi alle tue spese esistenti
    // setExpenses(prev => [...prev, newExpense]);
    
    console.log('Transaction confirmed and added:', newExpense);
  } catch (error) {
    console.error('Error confirming transaction:', error);
  }
};
```

### Step 4: Aggiungi UI nell'Header

```typescript
return (
  <div className="app">
    {/* Header con badge */}
    <header className="flex items-center justify-between p-4">
      <h1>Gestore Spese</h1>
      
      {/* Badge transazioni pendenti */}
      <PendingTransactionsBadge
        count={pendingCount}
        onClick={() => setShowPendingModal(true)}
      />
    </header>

    {/* Modal transazioni pendenti */}
    <PendingTransactionsModal
      isOpen={showPendingModal}
      transactions={pendingTransactions}
      onClose={() => setShowPendingModal(false)}
      onConfirm={handleConfirmTransaction}
      onIgnore={ignoreTransaction}
    />
    
    {/* Resto dell'app */}
  </div>
);
```

### Step 5: Richiedi Permessi al Primo Avvio

```typescript
useEffect(() => {
  // Chiedi permesso solo su Android e solo se non già abilitato
  if (!isEnabled && Capacitor.getPlatform() === 'android') {
    // Mostra un prompt per spiegare la feature
    const shouldEnable = window.confirm(
      'Vuoi abilitare il rilevamento automatico delle transazioni dalle notifiche bancarie?'
    );
    
    if (shouldEnable) {
      requestPermission();
    }
  }
}, [isEnabled]);
```

## ⚠️ Permessi Android Richiesti

Il workflow CI/CD aggiunge automaticamente:

```xml
<!-- Notification Listener -->
<uses-permission android:name="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE" />
```

E registra il servizio:

```xml
<service
    android:name=".BankNotificationListenerService"
    android:exported="true"
    android:permission="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE">
    <intent-filter>
        <action android:name="android.service.notification.NotificationListenerService" />
    </intent-filter>
</service>
```

## 🧪 Testing

### 1. Build APK
```bash
# Push su main triggera il workflow
git push origin main
```

### 2. Installa APK sul Telefono

### 3. Abilita Permesso Notification Listener
1. Vai in **Impostazioni > Notifiche > Accesso alle notifiche**
2. Trova **Gestore Spese**
3. Abilita l'accesso

### 4. Testa con Transazione Reale
1. Apri l'app Gestore Spese
2. Vai sull'app bancaria (es. UniCredit)
3. Fai un pagamento (anche piccolo, tipo caffè)
4. Ricevi la notifica dalla banca
5. Torna su Gestore Spese
6. Dovresti vedere il badge con "1 transazione"
7. Clicca per aprire il modal
8. Conferma o ignora

## 🐛 Debug

### Controlla i Log Android
```bash
adb logcat | grep -E "BankNotification|NotificationListener"
```

### Log Attesi
```
BankNotificationListener: Bank notification from: it.nogood.container
BankNotificationListener: Title: Pagamento carta
BankNotificationListener: Text: Hai speso € 2.50 presso Bar Roma
NotificationListenerPlugin: Received bank notification: {...}
```

### Problemi Comuni

1. **Badge non appare**
   - Controlla che il permesso sia abilitato
   - Verifica log Android
   - Controlla che l'app bancaria sia nella lista BANK_PACKAGES

2. **Transazione non viene parsata**
   - Controlla il formato della notifica nei log
   - Aggiungi/modifica il pattern in `notification-transaction-parser.ts`

3. **Build fallisce**
   - Controlla che tutti i file Java abbiano il package corretto
   - Verifica che il workflow abbia fatto il `sed` dei package names

## 🎉 Funzionalità

✅ Rilevamento automatico da 7 banche  
✅ Parsing intelligente importo/descrizione  
✅ Deduplicazione con hash MD5  
✅ Storage locale con auto-cleanup (30 giorni)  
✅ UI modal responsive  
✅ Badge con contatore  
✅ Zero dipendenze esterne  
✅ Funziona in background  

## 📝 Note

- **Solo Android**: iOS non permette accesso alle notifiche di altre app
- **Privacy**: Le notifiche restano solo sul dispositivo, nessun invio a server
- **Batteria**: Impatto minimo, il servizio è event-driven
- **Affidabilità**: Dipende dal formato delle notifiche bancarie (possono cambiare)

## 🔗 Link Utili

- [Android NotificationListenerService](https://developer.android.com/reference/android/service/notification/NotificationListenerService)
- [Capacitor Plugins](https://capacitorjs.com/docs/plugins)
