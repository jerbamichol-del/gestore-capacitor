# 🔔 Setup Auto-Transaction Detection

## Overview

**Questa feature rileva automaticamente transazioni da**:
- 💬 **SMS bancari** (5 banche: Revolut, PayPal, Postepay, BBVA, Intesa)
- 🔔 **Notifiche app bancarie** (7 app: + BNL, Unicredit)

Le transazioni rilevate vengono salvate come **pending** e richiedono conferma manuale.

---

## 🛠️ Configurazione Android

### 1. Copia i file Java nel progetto Android

Dopo `npx cap sync`, copia **3 file Java**:

```bash
# Da eseguire nella root del progetto
cp android-config/NotificationListenerPlugin.java android/app/src/main/java/com/gestorefinanze/app/
cp android-config/NotificationListenerService.java android/app/src/main/java/com/gestorefinanze/app/
cp android-config/SMSReaderPlugin.java android/app/src/main/java/com/gestorefinanze/app/
```

**IMPORTANTE**: Modifica il package name se il tuo è diverso da `com.gestorefinanze.app`.

---

### 2. Registra i Plugin in MainActivity.java

Apri `android/app/src/main/java/com/gestorefinanze/app/MainActivity.java` e aggiungi:

```java
import com.gestorefinanze.app.NotificationListenerPlugin;
import com.gestorefinanze.app.SMSReaderPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Registra i plugin custom
        registerPlugin(NotificationListenerPlugin.class);
        registerPlugin(SMSReaderPlugin.class);
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

In `App.tsx`, il hook `useAutoTransactions` inizializza automaticamente:

```typescript
import { useAutoTransactions } from './hooks/useAutoTransactions';

const { 
  pendingCount, 
  notificationListenerEnabled,
  smsPermissionGranted,
  requestNotificationPermission,
  requestSMSPermission,
  scanSMS
} = useAutoTransactions();
```

**L'hook fa automaticamente**:
- ✅ Init notification listener
- ✅ Check SMS permission
- ✅ Scan SMS ultimi 24h (se permesso granted)
- ✅ Load pending transactions
- ✅ Cleanup old transactions
- ✅ Listen for new transactions

### Richiedi Permessi

```typescript
// Notification Listener
if (!notificationListenerEnabled) {
  await requestNotificationPermission();
}

// SMS Reader
if (!smsPermissionGranted) {
  const granted = await requestSMSPermission();
  // Se granted, scan automatico parte subito!
}
```

### Scan Manuale SMS

```typescript
// Scan ultimi 3 giorni
const transactions = await scanSMS(72);
console.log(`Found ${transactions.length} transactions`);
```

### Mostra Banner Permessi

```typescript
{!smsPermissionGranted && (
  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
    <h3 className="font-semibold text-yellow-900">Abilita Lettura SMS</h3>
    <p className="text-sm text-yellow-700 mb-3">
      Consenti all'app di leggere SMS bancari per rilevare transazioni.
    </p>
    <button
      onClick={requestSMSPermission}
      className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg"
    >
      Abilita SMS
    </button>
  </div>
)}

{!notificationListenerEnabled && (
  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
    <h3 className="font-semibold text-blue-900">Abilita Notifiche</h3>
    <p className="text-sm text-blue-700 mb-3">
      Consenti all'app di leggere notifiche app bancarie.
    </p>
    <button
      onClick={requestNotificationPermission}
      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
    >
      Abilita Notifiche
    </button>
  </div>
)}
```

---

## 🎯 Banche/App Supportate

### SMS (5 banche)
- ✅ Revolut
- ✅ PayPal
- ✅ Postepay
- ✅ BBVA
- ✅ Intesa Sanpaolo

### Notifiche (7 app)
- ✅ Revolut (`com.revolut.revolut`)
- ✅ PayPal (`com.paypal.android.p2pmobile`)
- ✅ Postepay (`it.poste.postepay`)
- ✅ BBVA (`com.bbva.mobile.android`)
- ✅ Intesa Sanpaolo (`com.latuabancaperandroid`)
- ✅ BNL (`it.bnl.apps.banking`)
- ✅ Unicredit (`it.nogood.container`)

### Aggiungi Nuova Banca SMS

```typescript
import { SMSTransactionParser } from './services/sms-transaction-parser';

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

### Aggiungi Nuova App Notifiche

In `NotificationListenerService.java`:

```java
private static final List<String> BANK_PACKAGES = Arrays.asList(
    // ... existing ...
    "com.mybank.app"  // Your package
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

1. **Solo Android**: iOS non permette accesso a SMS o notifiche di altre app

2. **Permessi Utente**: L'app chiederà automaticamente:
   - SMS read permission (dialog Android)
   - Notification listener access (apre Settings)
   - Local notification permission

3. **Background Service**: Il NotificationListener gira in background anche con app chiusa

4. **SMS Scan**: Parte solo se permesso granted, altrimenti mostra banner per richiederlo

5. **Privacy**: Le transazioni pending restano locali (IndexedDB) fino a conferma manuale

6. **Battery**: Impatto minimo, usa eventi passivi Android

7. **Duplicati**: Hash MD5 previene duplicati tra SMS e Notifiche

---

## 🐛 Troubleshooting

### Il badge non appare
- Verifica che almeno uno dei due permessi sia abilitato
- Riavvia l'app dopo aver abilitato permessi
- Controlla logcat: `adb logcat | grep -E "NotificationListener|SMSReader"`

### Nessuna transazione da SMS
- Verifica che SMS permission sia granted
- Controlla che l'SMS sia da una banca supportata
- Testa pattern con `SMSTransactionParser.parseSMS()`

### Nessuna transazione da Notifiche
- Verifica che notification listener sia abilitato
- Controlla che l'app bancaria sia nella lista `BANK_PACKAGES`
- Verifica che notifiche app bancaria siano abilitate

### Build Error - Plugin not found
- Verifica che `SMSReaderPlugin.java` sia copiato
- Verifica che sia registrato in `MainActivity.java`
- Pulisci build: `cd android && ./gradlew clean`

### Android 14+ Permission Denied
- Android 14+ richiede conferma extra per notification listener
- Vai manualmente in Settings e abilita
- SMS permission usa dialog standard Android

---

## 📚 Documentazione Aggiuntiva

- **Integration Guide**: `INTEGRATION_GUIDE.md` - Come integrare in App.tsx
- **Examples**: `EXAMPLES.md` - Esempi pratici e test
- **README**: `AUTO_TRANSACTIONS_README.md` - Overview completa

---

**Buon sviluppo! 🚀**
