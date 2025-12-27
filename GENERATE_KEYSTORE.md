# 🔑 GENERAZIONE KEYSTORE PERSISTENTE

## ⚠️ CRITICO: Devi eseguire QUESTI step UNA SOLA VOLTA

---

## Problema

Ogni build genera un **nuovo keystore** con chiavi casuali. Android identifica le app dalla firma della chiave, quindi:
- APK firmato con Keystore A ≠ APK firmato con Keystore B
- Risultato: **"Conflitto pacchetto"** quando provi ad aggiornare

---

## Soluzione

Generare UN SOLO keystore e **committarlo nel repository**. Tutti i futuri build useranno lo stesso keystore = stessa firma = aggiornamenti senza conflitti.

---

## Step da Eseguire

### 1️⃣ Genera il Keystore (SOLO SE NON ESISTE)

```bash
# Verifica se esiste già
ls -lh android-config/debug.keystore

# Se NON esiste, generalo:
keytool -genkeypair -v \
  -storetype PKCS12 \
  -keystore android-config/debug.keystore \
  -alias androiddebugkey \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass android \
  -keypass android \
  -dname "CN=Android Debug,OU=Android,O=Android,L=Rome,ST=Lazio,C=IT"
```

**PARAMETRI CRITICI** (NON modificare):
- `-storepass android` e `-keypass android`: password standard debug
- `-alias androiddebugkey`: alias standard Android
- `-storetype PKCS12`: formato moderno

---

### 2️⃣ Verifica il Keystore

```bash
# Controlla che il file esista
ls -lh android-config/debug.keystore

# Output atteso:
# -rw-r--r-- 1 user user 2.5K Dec 27 12:00 android-config/debug.keystore

# Verifica contenuto
keytool -list -v -keystore android-config/debug.keystore -storepass android

# Output deve mostrare:
# Alias name: androiddebugkey
# Creation date: ...
# Entry type: PrivateKeyEntry
```

---

### 3️⃣ Committa nel Repository

```bash
# Aggiungi al git
git add android-config/debug.keystore

# Committa
git commit -m "feat: add persistent debug keystore for consistent signing"

# Pusha
git push origin main
```

**✅ FATTO!** Il prossimo build userà questo keystore persistente.

---

## 🔒 Sicurezza

**Q: È sicuro committare il keystore?**

**A:** Sì, per **debug builds**:
- Questo è un keystore **debug**, non production
- Password standard `android` (pubblica)
- Non può essere usato per pubblicare su Google Play Store
- Serve SOLO per installazione manuale (sideload)

**Per production builds** (Google Play):
- Usare un keystore **separato** e privato
- Non committare MAI il keystore production
- Usare GitHub Secrets per CI/CD

---

## 📋 Verifica Funzionamento

Dopo aver committato:

1. **Primo build**: GitHub Actions userà il keystore dal repo
2. **Installa APK** sul telefono
3. **Secondo build**: GitHub Actions userà lo STESSO keystore
4. **Aggiorna APK**: Android chiederà "Vuoi aggiornare?"
5. ✅ **SUCCESS**: Nessun conflitto!

---

## ⚠️ Se il Keystore Esiste Già

Se `android-config/debug.keystore` esiste già:

```bash
# NON generarlo di nuovo!
# Usa quello esistente

# Se vuoi ricominciare da zero (ATTENZIONE!):
rm android-config/debug.keystore
# Poi segui Step 1
```

**⚠️ ATTENZIONE**: Se generi un nuovo keystore, TUTTE le installazioni precedenti dovranno essere **disinstallate** prima di aggiornare.

---

## 🛠️ Troubleshooting

### Errore: "keytool: command not found"

```bash
# Installa JDK
sudo apt-get install default-jdk
# oppure
brew install openjdk
```

### Errore: "Permission denied"

```bash
chmod +w android-config/
chmod +w android-config/debug.keystore
```

### Workflow Fallback

Il workflow ha un **fallback**: se `android-config/debug.keystore` NON esiste, genera un keystore temporaneo (ma causarà conflitti!).

**Log workflow**:
```
⚠️ WARNING: Persistent keystore NOT found in repo!
⚠️ Generating a NEW keystore (this will cause package conflict!)
```

Se vedi questo warning → Esegui gli step sopra!

---

## 🔗 Link Utili

- [Android Keystore Documentation](https://developer.android.com/studio/publish/app-signing)
- [keytool Documentation](https://docs.oracle.com/javase/8/docs/technotes/tools/unix/keytool.html)

---

✅ **La tua reputazione è salva**: Con questo keystore persistente, gli aggiornamenti funzioneranno sempre!
