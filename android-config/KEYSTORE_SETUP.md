# 🔑 Keystore Setup per Build Consistenti

## 🎯 Problema

Quando un utente scarica e installa manualmente l'APK, Android richiede che ogni aggiornamento sia firmato con **lo stesso keystore**.

Se il keystore cambia:
- ❌ **Errore: "Pacchetto in conflitto"**
- ❌ L'utente deve DISINSTALLARE l'app (perdendo i dati)
- ❌ Esperienza utente DISASTROSA

## ✅ Soluzione

Committare UN keystore fisso nel repository. Tutti i build useranno SEMPRE questo keystore.

**Risultato**:
- ✅ Stesso keystore per SEMPRE
- ✅ Utenti possono aggiornare senza disinstallare
- ✅ Dati preservati automaticamente

---

## 🛠️ Setup (DA FARE UNA SOLA VOLTA)

### Passo 1: Genera il Keystore

```bash
chmod +x scripts/generate-keystore.sh
./scripts/generate-keystore.sh
```

Questo creerà il file `android/app/debug.keystore` con parametri fissi:

- **Alias**: `androiddebugkey`
- **Password Store**: `android`
- **Password Key**: `android`
- **DN**: `CN=Gestore Spese Debug, OU=Development, O=Gestore Spese, L=Rome, ST=Lazio, C=IT`
- **Validità**: 10000 giorni (~27 anni)

### Passo 2: Copia il Keystore nella Directory Corretta

```bash
cp android/app/debug.keystore android-config/debug.keystore
```

### Passo 3: Committa il Keystore nel Repository

```bash
git add android-config/debug.keystore
git add android-config/signing.gradle
git commit -m "chore: add persistent debug keystore for consistent signing"
git push
```

### Passo 4: Verifica che Funzioni

Controlla che il workflow GitHub Actions:
1. Trovi il keystore in `android-config/debug.keystore`
2. Lo copi in `android/app/debug.keystore`
3. Compili l'APK senza errori

---

## 🔍 Verifica Keystore

Per vedere le informazioni del keystore:

```bash
keytool -list -v -keystore android-config/debug.keystore -storepass android
```

**Output atteso**:

```
Keystore type: PKCS12
Keystore provider: SUN

Your keystore contains 1 entry

Alias name: androiddebugkey
Creation date: [DATA]
Entry type: PrivateKeyEntry
Certificate chain length: 1
Certificate[1]:
Owner: CN=Gestore Spese Debug, OU=Development, O=Gestore Spese, L=Rome, ST=Lazio, C=IT
Issuer: CN=Gestore Spese Debug, OU=Development, O=Gestore Spese, L=Rome, ST=Lazio, C=IT
...
```

---

## ⚠️ IMPORTANTE

### 🔒 Sicurezza

Questo è un **DEBUG keystore** per build di sviluppo e sideload.

- ✅ **OK per committare nel repo** (pubblico o privato)
- ✅ **OK per sideload manuale**
- ❌ **NON per Google Play Store** (usa release keystore separato e segreto)

### 🚫 NON Rigenerare

Una volta committato il keystore:
- **NON** rigenerarlo mai
- **NON** cancellarlo mai
- **NON** modificarlo mai

Se lo fai, tutti gli utenti che hanno l'app installata dovranno disinstallarla e reinstallarla.

### 📝 Per Builds Google Play

Quando vorrai pubblicare su Google Play Store:
1. Genera un **NUOVO** release keystore (con password sicura)
2. **NON committarlo** nel repository
3. Salvalo in modo sicuro (1Password, ecc.)
4. Usa GitHub Secrets per il workflow release

---

## 📊 Stato Attuale

- [ ] Keystore generato
- [ ] Keystore committato in `android-config/debug.keystore`
- [ ] Workflow aggiornato per usare keystore committato
- [ ] Build testato con nuovo keystore
- [ ] Aggiornamento testato su dispositivo reale

---

## 🔗 Riferimenti

- [Android Developer - Sign Your App](https://developer.android.com/studio/publish/app-signing)
- [keytool Documentation](https://docs.oracle.com/javase/8/docs/technotes/tools/unix/keytool.html)
