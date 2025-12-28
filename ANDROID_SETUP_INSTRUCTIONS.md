# 📱 Android Setup per Auto-Rilevamento Transazioni

## ⚠️ IMPORTANTE

Questo progetto è un **PWA convertito in Capacitor**. Per abilitare l'auto-rilevamento delle transazioni bancarie, devi:

1. **Inizializzare Capacitor** (se non l'hai già fatto)
2. **Configurare i permessi Android**
3. **Registrare il plugin** nel MainActivity

---

## 🔧 Step 1: Inizializza Capacitor

Se non hai ancora inizializzato il progetto Android:

```bash
npm install @capacitor/core @capacitor/cli
npm install @capacitor/android
npx cap init
# Quando richiesto:
# App name: Gestore Spese
# App ID: io.ionic.starter (o il tuo custom)

npx cap add android
```

---

## 📝 Step 2: Aggiungi Permessi in AndroidManifest.xml

Apri `android/app/src/main/AndroidManifest.xml` e aggiungi:

```xml
<manifest>
    <!-- Permesso per leggere le notifiche -->
    <uses-permission android:name="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE" />

    <application>
        <!-- ... altre configurazioni ... -->

        <!-- Registra il NotificationListener Service -->
        <service
            android:name=".NotificationListener"
            android:label="Gestore Spese Notification Listener"
            android:permission="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE"
            android:exported="true">
            <intent-filter>
                <action android:name="android.service.notification.NotificationListenerService" />
            </intent-filter>
        </service>
    </application>
</manifest>
```

---

## 🔌 Step 3: Registra il Plugin in MainActivity

Apri `android/app/src/main/java/io/ionic/starter/MainActivity.java` e:

```java
package io.ionic.starter;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Registra il plugin NotificationListener
        registerPlugin(NotificationListenerPlugin.class);
    }
}
```

---

## 📦 Step 4: Build e Test

```bash
# Sincronizza i file con Android Studio
npx cap sync

# Apri il progetto in Android Studio
npx cap open android

# Oppure builda direttamente
cd android
./gradlew assembleDebug
```

---

## ✅ Step 5: Abilita il Permesso sul Telefono

1. Installa l'APK sul telefono
2. Apri l'app
3. Clicca sul banner **"Abilita Auto-Rilevamento"**
4. Vai su **Impostazioni → Notifiche → Accesso alle notifiche**
5. Attiva **"Gestore Spese"**
6. Torna nell'app

---

## 🧪 Test del Sistema

1. Fai un pagamento con una delle banche supportate:
   - Revolut
   - PayPal
   - Postepay
   - BBVA
   - Intesa Sanpaolo
   - BNL
   - UniCredit

2. Ricevi la notifica dalla banca

3. Riapri l'app → Dovresti vedere:
   - **Badge rosso** in alto a destra con il numero di transazioni
   - **Modal automatico** con la transazione da confermare

4. Clicca **✓ Conferma** per aggiungere la spesa automaticamente

---

## 🔍 Debug

Per vedere i log del NotificationListener:

```bash
adb logcat | grep "NotificationListener"
```

Dovresti vedere:
```
D/NotificationListener: Bank notification from: com.unicredit
D/NotificationListener: Title: Pagamento effettuato
D/NotificationListener: Text: Hai speso 15,50 EUR
D/NotificationListener: Broadcast sent to plugin
```

---

## 📂 File Creati

✅ `android/app/src/main/java/io/ionic/starter/NotificationListener.java` - Intercetta notifiche  
✅ `android/app/src/main/java/io/ionic/starter/NotificationListenerPlugin.java` - Bridge Capacitor  
✅ `src/services/notification-transaction-parser.ts` - Parser 7 banche  
✅ `src/services/notification-listener-service.ts` - Gestione transazioni pendenti  
✅ `src/hooks/useNotificationListener.ts` - React hook  
✅ `src/components/PendingTransactionsModal.tsx` - UI conferma transazioni  
✅ `src/components/NotificationPermissionModal.tsx` - UI richiesta permessi  
✅ `src/components/NotificationSettingsButton.tsx` - Bottone impostazioni  

---

## 🎉 Sistema Completo!

Quando tutto è configurato correttamente:

1. **Backend Android** intercetta le notifiche bancarie ✅
2. **Parser TypeScript** estrae importo e descrizione ✅
3. **LocalStorage** salva le transazioni pendenti ✅
4. **UI Modal** mostra la conferma con un clic ✅
5. **Auto-add** aggiunge la spesa con account corretto ✅

----

## ❓ Troubleshooting

### "Il permesso non si attiva"
- Vai su Impostazioni → App → Gestore Spese → Notifiche
- Assicurati che le notifiche siano abilitate
- Poi vai su Impostazioni → Notifiche → Accesso alle notifiche

### "Le notifiche non vengono rilevate"
- Controlla i log con `adb logcat`
- Verifica che il package name della banca sia nella lista `MONITORED_PACKAGES`
- Alcune app bancarie usano notifiche "silent" che non vengono intercettate

### "Il modal non appare"
- Controlla che il hook `useNotificationListener` sia chiamato in `App.tsx`
- Verifica che localStorage non sia pieno
- Controlla la console browser per errori JavaScript
