# 📱 Setup Lettura SMS - Guida Completa

## 🎯 Cosa Fa

La funzione di lettura SMS rileva **automaticamente** le transazioni bancarie dai messaggi SMS delle tue banche italiane.

### Banche Supportate (SMS):
- ✅ **Revolut**
- ✅ **PayPal**  
- ✅ **Postepay**
- ✅ **BBVA**
- ✅ **Intesa Sanpaolo**

---

## ⚡ Setup Automatico (RACCOMANDATO)

### Windows (PowerShell)

```powershell
# 1. Sync Capacitor
npx cap sync android

# 2. Esegui setup automatico
.\setup-android-plugins.ps1

# 3. Verifica AndroidManifest.xml (lo script ti dice cosa aggiungere se manca)

# 4. Build
npm run build:android
```

### Linux/Mac (Bash)

```bash
# 1. Sync Capacitor
npx cap sync android

# 2. Rendi eseguibile lo script
chmod +x setup-android-plugins.sh

# 3. Esegui setup
./setup-android-plugins.sh

# 4. Verifica AndroidManifest.xml

# 5. Build
npm run build:android
```

---

## 🔧 Setup Manuale

Se gli script automatici non funzionano, segui questi passaggi:

### Step 1: Sync Capacitor

```bash
npx cap sync android
```

### Step 2: Copia Plugin Java

```bash
# Windows PowerShell
Copy-Item android-config\SMSReaderPlugin.java android\app\src\main\java\com\gestorefinanze\app\
Copy-Item android-config\NotificationListenerPlugin.java android\app\src\main\java\com\gestorefinanze\app\
Copy-Item android-config\NotificationListenerService.java android\app\src\main\java\com\gestorefinanze\app\

# Linux/Mac
cp android-config/SMSReaderPlugin.java android/app/src/main/java/com/gestorefinanze/app/
cp android-config/NotificationListenerPlugin.java android/app/src/main/java/com/gestorefinanze/app/
cp android-config/NotificationListenerService.java android/app/src/main/java/com/gestorefinanze/app/
```

### Step 3: Modifica MainActivity.java

Apri: `android/app/src/main/java/com/gestorefinanze/app/MainActivity.java`

```java
package com.gestorefinanze.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.gestorefinanze.app.SMSReaderPlugin;              // ← ADD
import com.gestorefinanze.app.NotificationListenerPlugin;   // ← ADD

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Register custom plugins
        registerPlugin(SMSReaderPlugin.class);              // ← ADD
        registerPlugin(NotificationListenerPlugin.class);   // ← ADD
    }
}
```

### Step 4: Aggiungi Permessi AndroidManifest.xml

Apri: `android/app/src/main/AndroidManifest.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <!-- ⭐ AGGIUNGI QUESTI PERMESSI -->
    <uses-permission android:name="android.permission.READ_SMS" />
    <uses-permission android:name="android.permission.RECEIVE_SMS" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE" />
    
    <!-- ... altri permessi esistenti ... -->

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/AppTheme">

        <!-- ... Activity esistenti ... -->

        <!-- ⭐ AGGIUNGI QUESTO SERVICE -->
        <service
            android:name=".NotificationListenerService"
            android:exported="true"
            android:permission="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE">
            <intent-filter>
                <action android:name="android.service.notification.NotificationListenerService" />
            </intent-filter>
        </service>

    </application>

</manifest>
```

### Step 5: Build Android

```bash
npm run build:android
```

Oppure apri Android Studio:

```bash
npx cap open android
```

---

## 🧪 Test nell'App

### 1. Richiedi Permessi

```typescript
import { SMSReader } from './plugins/sms-reader';

const requestSMSPermission = async () => {
  const result = await SMSReader.requestPermission();
  
  if (result.granted) {
    console.log('✅ Permesso SMS concesso');
  } else {
    console.log('❌ Permesso SMS negato');
  }
};
```

### 2. Leggi SMS

```typescript
const scanSMS = async () => {
  // Leggi SMS ultimi 24h
  const result = await SMSReader.readSMS({
    maxCount: 100,
    fromDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  });
  
  console.log(`Trovati ${result.messages.length} SMS`);
  
  result.messages.forEach(sms => {
    console.log(`Da: ${sms.address}`);
    console.log(`Testo: ${sms.body}`);
    console.log(`Data: ${sms.date}`);
  });
};
```

### 3. Integrazione con Auto-Transaction Service

```typescript
import { AutoTransactionService } from './services/auto-transaction-service';

const service = AutoTransactionService.getInstance();

// Inizializza
await service.initialize();

// Scan SMS manuale
await service.scanSMS({ days: 1 });

// Ottieni pending transactions
const pending = await service.getPendingTransactions();
console.log(`${pending.length} transazioni da confermare`);
```

---

## 📋 Come Funziona

### Flow Completo:

1. **SMS Arriva** 
   - Banca invia SMS: "Pagamento 30.00€ presso Esselunga"
   - Android salva in ContentProvider

2. **App Scan** (manuale o auto all'apertura)
   - `SMSReader.readSMS()` legge inbox
   - Parser riconosce formato banca
   - Estrae: importo, merchant, tipo

3. **Salva Pending**
   - Transazione salvata come `status: 'pending'`
   - Badge appare nell'app
   - Notifica locale all'utente

4. **Utente Conferma**
   - Review in "Pending Transactions" tab
   - Modifica se necessario
   - Conferma → salvata in transactions principale

---

## 🔍 Esempi SMS Riconosciuti

### Revolut
```
You spent €25.50 at Amazon
You received €100.00 from John
Card payment of €15.99 at McDonald's
```

### Postepay
```
Pagamento 30.00€ presso Esselunga
Ricarica di 50.00€ ricevuta
Prelievo di 20.00€ effettuato
```

### BBVA
```
Compra: 45.50 EUR en ZARA MADRID
Abono: 200.00 EUR - Transferencia
Cargo: 12.99 EUR - Netflix
```

### Intesa Sanpaolo
```
Pagamento carta 25.00 EUR presso ESSELUNGA
Bonifico in entrata 150.00 EUR da ROSSI MARIO
Prelievo ATM 50.00 EUR
```

---

## ⚙️ Configurazione Avanzata

### Aggiungi Nuova Banca

Modifica `src/services/sms-transaction-parser.ts`:

```typescript
const SMS_BANK_PATTERNS = [
  // ... pattern esistenti ...
  
  // La tua nuova banca
  {
    sender: /TUABANCA/i,
    patterns: [
      {
        regex: /pagamento\s+([0-9,.]+)\s*€?\s+presso\s+(.+)/i,
        type: 'expense' as const,
        amountIndex: 1,
        descriptionIndex: 2
      }
    ]
  }
];
```

### Test Pattern

```typescript
import { parseSMSTransaction } from './services/sms-transaction-parser';

const testSMS = {
  address: 'TUABANCA',
  body: 'Pagamento 25.50€ presso Amazon',
  date: new Date().toISOString()
};

const result = parseSMSTransaction(testSMS);
console.log(result);
// {
//   type: 'expense',
//   amount: 25.50,
//   description: 'Amazon',
//   account: 'Tuabanca',
//   ...
// }
```

---

## 🐛 Troubleshooting

### Permessi Negati

```typescript
// Check permesso
const status = await SMSReader.checkPermission();

if (!status.granted) {
  // Richiedi di nuovo
  const result = await SMSReader.requestPermission();
  
  if (!result.granted) {
    // Mostra dialog per aprire Settings
    alert('Vai in Impostazioni > App > Gestore Finanze > Permessi > SMS');
  }
}
```

### SMS Non Riconosciuti

1. Abilita logging nel parser:

```typescript
// In sms-transaction-parser.ts
const DEBUG = true;

export const parseSMSTransaction = (sms: SMSMessage) => {
  if (DEBUG) {
    console.log('🔍 Parsing SMS:', {
      sender: sms.address,
      body: sms.body
    });
  }
  // ...
};
```

2. Controlla log Android:

```bash
npx cap run android
# Poi in Android Studio > Logcat > filtra "SMS"
```

### Build Failures

```bash
# Clean build
cd android
./gradlew clean
cd ..

# Rebuild
npm run build:android
```

---

## 📚 Documentazione Completa

- **Setup Dettagliato**: `docs/SETUP_AUTO_TRANSACTIONS.md`
- **Plugin SMS**: `android-config/README_SMS_PLUGIN.md`
- **Integrazione UI**: `docs/INTEGRATION_GUIDE.md`
- **Esempi**: `docs/EXAMPLES.md`

---

## ✅ Checklist Setup

- [ ] `npx cap sync android` eseguito
- [ ] Plugin Java copiati in `android/app/src/main/java/com/gestorefinanze/app/`
- [ ] `MainActivity.java` aggiornato con `registerPlugin()`
- [ ] `AndroidManifest.xml` con permessi SMS
- [ ] `AndroidManifest.xml` con `NotificationListenerService`
- [ ] Build Android completata senza errori
- [ ] Permessi SMS richiesti in app
- [ ] Test `SMSReader.readSMS()` funzionante
- [ ] SMS parsati correttamente
- [ ] Pending transactions appaiono nell'app

---

## 🚀 Quick Start

**TL;DR** - Esegui questo:

```bash
# Windows
npx cap sync android
.\setup-android-plugins.ps1
npm run build:android

# Linux/Mac
npx cap sync android
chmod +x setup-android-plugins.sh
./setup-android-plugins.sh
npm run build:android
```

Poi nell'app:

```typescript
import { AutoTransactionService } from './services/auto-transaction-service';

const service = AutoTransactionService.getInstance();
await service.initialize();
await service.scanSMS({ days: 1 });
```

**FATTO! 🎉**
