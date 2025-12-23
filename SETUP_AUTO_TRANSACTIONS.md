# 🔔 Setup Auto-Transaction Detection

## Overview

**Questa feature rileva automaticamente transazioni da notifiche app bancarie** (Revolut, PayPal, Postepay, BBVA, Intesa, BNL, Unicredit).

Le transazioni rilevate vengono salvate come **pending** e richiedono conferma manuale.

### ⚠️ Nota SMS

Il rilevamento SMS **non è incluso in questa versione** perché richiede un plugin Android custom aggiuntivo. Il **Notification Listener è sufficiente** per rilevare la maggior parte delle transazioni, dato che tutte le app bancarie moderne inviano notifiche.

---

## 🛠️ Configurazione Android

### 1. Copia i file Java nel progetto Android

Dopo `npx cap sync`, copia i file Java:

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
<!-- Notification Listener -->
<uses-permission android:name="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE" />

<!-- Local Notifications -->
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />
```

**Nota**: I permessi SMS sono opzionali e **non necessari** per il funzionamento base.

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

In `App.tsx`, il hook `useAutoTransactions` inizializza automaticamente:

```typescript
import { useAutoTransactions } from './hooks/useAutoTransactions';

const { 
  pendingCount, 
  notificationListenerEnabled,
  requestNotificationPermission 
} = useAutoTransactions();
```

**L'hook fa automaticamente**:
- ✅ Init notification listener
- ✅ Load pending transactions
- ✅ Cleanup old transactions
- ✅ Listen for new transactions

### Mostra Banner se Non Abilitato

```typescript
{!notificationListenerEnabled && (
  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
    <h3 className="font-semibold text-yellow-900">Abilita Rilevamento Automatico</h3>
    <p className="text-sm text-yellow-700 mb-3">
      Consenti all'app di leggere le notifiche bancarie.
    </p>
    <button
      onClick={requestNotificationPermission}
      className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg"
    >
      Abilita Ora
    </button>
  </div>
)}
```

### Mostra Pending Count

```typescript
import PendingTransactionsBadge from './components/PendingTransactionsBadge';

<PendingTransactionsBadge 
  count={pendingCount}
  onClick={() => setIsPendingModalOpen(true)}
/>
```

### Mostra Modal per Review

```typescript
import PendingTransactionsModal from './components/PendingTransactionsModal';

<PendingTransactionsModal 
  isOpen={isPendingModalOpen}
  onClose={() => setIsPendingModalOpen(false)}
  onAddExpense={handleAddExpense}
/>
```

---

## 🔧 App Bancarie Supportate

**7 app monitorate automaticamente**:
- ✅ Revolut (`com.revolut.revolut`)
- ✅ PayPal (`com.paypal.android.p2pmobile`)
- ✅ Postepay (`it.poste.postepay`)
- ✅ BBVA (`com.bbva.mobile.android`)
- ✅ Intesa Sanpaolo (`com.latuabancaperandroid`)
- ✅ BNL (`it.bnl.apps.banking`)
- ✅ Unicredit (`it.nogood.container`)

### Aggiungi Nuova App

In `NotificationListenerService.java`, aggiungi:

```java
private static final List<String> BANK_PACKAGES = Arrays.asList(
    // ... existing ...
    "com.mybank.app"  // Your package name
);
```

E in `notification-transaction-parser.ts`:

```typescript
NotificationTransactionParser.addAppConfig({
  name: 'MyBank',
  identifier: 'mybank',
  accountName: 'MyBank Account',
  patterns: {
    expense: /spent\s+€?([\d.,]+)\s+at\s+(.+)/i
  }
});
```

---

## ⚠️ Note Importanti

1. **Solo Android**: iOS non permette accesso a notifiche di altre app

2. **Permesso Utente**: L'app chiederà automaticamente di abilitare "Notification Access" nelle Settings Android

3. **Background Service**: Il NotificationListener gira in background anche con app chiusa

4. **Privacy**: Le transazioni pending restano locali (IndexedDB) fino a conferma manuale

5. **Battery**: Impatto minimo, usa eventi passivi Android

6. **Duplicati**: Hash MD5 previene duplicati se stessa notifica viene rilevata più volte

---

## 🐛 Troubleshooting

### Il badge non appare
- Verifica che notification listener sia abilitato: Settings → Apps → Gestore Finanze → Notification Access
- Riavvia l'app dopo aver abilitato
- Controlla logcat: `adb logcat | grep NotificationListener`

### Nessuna transazione rilevata
- Verifica che l'app bancaria sia nella lista `BANK_PACKAGES`
- Controlla che le notifiche dell'app bancaria siano abilitate
- Testa inviando una notifica test

### Build Error
- Verifica che i file Java siano nella cartella corretta
- Controlla il package name in MainActivity.java
- Pulisci build: `cd android && ./gradlew clean`

### Android 14+ Permission Denied
- Android 14+ richiede conferma extra per notification listener
- Vai manualmente in Settings e abilita

---

## 📚 Documentazione Aggiuntiva

- **Integration Guide**: `INTEGRATION_GUIDE.md` - Come integrare in App.tsx
- **Examples**: `EXAMPLES.md` - Esempi pratici e test
- **README**: `AUTO_TRANSACTIONS_README.md` - Overview completa

---

**Buon sviluppo! 🚀**
