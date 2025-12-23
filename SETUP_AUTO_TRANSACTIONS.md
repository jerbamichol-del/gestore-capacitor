# 🔔 Setup Auto-Transaction Detection

## Overview

Questa feature rileva automaticamente transazioni da:
- **SMS bancari** (Revolut, PayPal, Postepay, BBVA, Intesa)
- **Notifiche app bancarie** (background monitoring)

Le transazioni rilevate vengono salvate come **pending** e richiedono conferma manuale.

---

## 🛠️ Configurazione Android

### 1. Copia i file Java nel progetto Android

Dopo `npx cap sync`, copia i file Java nella cartella corretta:

```bash
# Da eseguire nella root del progetto
cp android-config/NotificationListenerPlugin.java android/app/src/main/java/com/gestorefinanze/app/
cp android-config/NotificationListenerService.java android/app/src/main/java/com/gestorefinanze/app/
```

**IMPORTANTE**: Modifica il package name se il tuo è diverso da `com.gestorefinanze.app`.

---

### 2. Registra il Plugin in MainActivity.java

Apri `android/app/src/main/java/com/gestorefinanze/app/MainActivity.java` e aggiungi:

```java
import com.gestorefinanze.app.NotificationListenerPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Registra il plugin custom
        registerPlugin(NotificationListenerPlugin.class);
    }
}
```

---

### 3. Aggiungi il Service in AndroidManifest.xml

Apri `android/app/src/main/AndroidManifest.xml` e aggiungi dentro `<application>`:

```xml
<application>
    <!-- ... existing content ... -->
    
    <!-- Notification Listener Service -->
    <service
        android:name=".NotificationListenerService"
        android:label="Gestore Finanze Notification Listener"
        android:permission="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE"
        android:exported="true">
        <intent-filter>
            <action android:name="android.service.notification.NotificationListenerService" />
        </intent-filter>
    </service>
</application>
```

---

### 4. Verifica Permessi

I permessi sono già in `android-config/AndroidManifest-permissions.xml`:

```xml
<!-- SMS Reading -->
<uses-permission android:name="android.permission.READ_SMS" />
<uses-permission android:name="android.permission.RECEIVE_SMS" />

<!-- Notification Listener -->
<uses-permission android:name="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE" />

<!-- Local Notifications -->
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />
```

---

### 5. Build e Test

```bash
# Installa dipendenze
npm install

# Sync Capacitor
npx cap sync android

# Copia file Java (se non fatto prima)
cp android-config/*.java android/app/src/main/java/com/gestorefinanze/app/

# Build Android
npm run build:android

# Oppure apri Android Studio
npx cap open android
```

---

## 📱 Utilizzo nell'App

### Inizializzazione

In `App.tsx`, aggiungi nella `useEffect` di mount:

```typescript
import { SMSTransactionParser } from './services/sms-transaction-parser';
import { NotificationListenerService } from './services/notification-listener-service';
import { SmartNotifications } from './services/smart-notifications';

useEffect(() => {
  const initAutoTransactions = async () => {
    // Init notifiche
    await SmartNotifications.init();
    
    // Init notification listener
    const notificationEnabled = await NotificationListenerService.init();
    if (!notificationEnabled) {
      console.log('⚠️ User needs to enable notification access');
    }
    
    // Scan SMS recenti (ultimi 24h)
    await SMSTransactionParser.scanRecentSMS(24);
  };
  
  initAutoTransactions();
}, []);
```

### Mostra Transazioni Pending

```typescript
import { AutoTransactionService } from './services/auto-transaction-service';

const [pendingTransactions, setPendingTransactions] = useState([]);

useEffect(() => {
  const loadPending = async () => {
    const pending = await AutoTransactionService.getPendingTransactions();
    setPendingTransactions(pending);
  };
  
  loadPending();
  
  // Listener per nuove transazioni
  const handleNewTransaction = (event: any) => {
    loadPending();
  };
  
  window.addEventListener('auto-transaction-added', handleNewTransaction);
  
  return () => {
    window.removeEventListener('auto-transaction-added', handleNewTransaction);
  };
}, []);
```

### Conferma/Ignora Transazione

```typescript
const handleConfirm = async (transactionId: string) => {
  await AutoTransactionService.confirmTransaction(
    transactionId,
    handleAddExpense // La tua funzione per aggiungere spese
  );
  // Reload pending
};

const handleIgnore = async (transactionId: string) => {
  await AutoTransactionService.ignoreTransaction(transactionId);
  // Reload pending
};
```

---

## 🔧 Configurazione Banche

### Aggiungi Nuova Banca (SMS)

In `services/sms-transaction-parser.ts`, aggiungi al runtime:

```typescript
SMSTransactionParser.addBankConfig({
  name: 'MyBank',
  identifier: 'MYBANK',
  accountName: 'MyBank Account',
  patterns: {
    expense: /pagamento\s+([\d.,]+).*?presso\s+(.+)/i,
    income: /accredito\s+([\d.,]+)/i
  }
});
```

### Aggiungi Nuova App (Notifiche)

In `services/notification-transaction-parser.ts`, stesso sistema.

---

## ⚠️ Note Importanti

1. **Permessi Utente**: L'app chiederà automaticamente:
   - SMS read permission
   - Notification listener access (apre Settings)
   - Local notification permission

2. **Privacy**: Le transazioni pending restano locali (IndexedDB) fino a conferma.

3. **Duplicati**: L'hash MD5 previene duplicati da SMS + Notifica della stessa transazione.

4. **Background**: Il NotificationListenerService gira in background anche con app chiusa.

5. **Battery**: Impatto minimo, usa eventi nativi Android.

---

## 🐛 Debug

### Logcat Android Studio

```bash
adb logcat | grep "NotificationListener"
```

### Console Browser (Web)

```javascript
// Verifica DB
import { getAutoTransactions } from './utils/db';
const all = await getAutoTransactions();
console.log('All transactions:', all);

// Stats
import { AutoTransactionService } from './services/auto-transaction-service';
const stats = await AutoTransactionService.getStats();
console.log('Stats:', stats);
```

---

## 🎯 Prossimi Step

- [ ] Creare UI modal per pending transactions
- [ ] Aggiungere AI categorization automatica
- [ ] Supporto per più banche italiane
- [ ] Sync cloud delle transazioni confermate
- [ ] Widget Android con saldo aggiornato

---

**Buon sviluppo! 🚀**
