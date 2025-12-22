# Setup Automatico Gestore Capacitor

## 🚀 Comandi da Eseguire (Copia-Incolla)

Esegui questi comandi IN ORDINE sul tuo computer:

### 1. Clone e Setup Base

```bash
# Clone delle due repository
git clone https://github.com/jerbamichol-del/gestore.git
git clone https://github.com/jerbamichol-del/gestore-capacitor.git

cd gestore-capacitor
```

### 2. Copia File PWA (Tutti insieme)

```bash
# Copia cartelle complete
cp -r ../gestore/components ./
cp -r ../gestore/screens ./
cp -r ../gestore/services ./
cp -r ../gestore/hooks ./
cp -r ../gestore/utils ./
cp -r ../gestore/types ./
cp -r ../gestore/public ./
cp -r ../gestore/share-target ./

# Copia file root (App.tsx già copiato via GitHub)
cp ../gestore/AuthGate.tsx ./
cp ../gestore/index.tsx ./
cp ../gestore/types.ts ./
cp ../gestore/tsconfig.json ./
cp ../gestore/.gitignore ./
cp ../gestore/index.html ./
cp ../gestore/metadata.json ./
```

### 3. Setup Ambiente

```bash
# Crea file .env con la tua Gemini API Key
echo "GEMINI_API_KEY=LA_TUA_API_KEY_QUI" > .env

# Installa dipendenze
npm install
```

### 4. Build e Inizializza Capacitor

```bash
# Build web assets
npm run build

# Aggiungi piattaforma Android
npx cap add android

# Sincronizza
npx cap sync android
```

### 5. Build APK Locale (Opzionale)

Se hai Android Studio installato:

```bash
cd android
./gradlew assembleRelease
cd ..

# APK pronto in:
# android/app/build/outputs/apk/release/app-release-unsigned.apk
```

### 6. Test in Browser (Opzionale)

```bash
npm run dev
# Apri http://localhost:3000
```

### 7. Push su GitHub

```bash
git add .
git commit -m "Copy all PWA files to Capacitor project"
git push origin main
```

## 🎯 Setup GitHub Actions (Build Automatica APK)

1. Vai su https://github.com/jerbamichol-del/gestore-capacitor/settings/secrets/actions
2. Clicca "New repository secret"
3. Name: `GEMINI_API_KEY`
4. Value: La tua Gemini API Key
5. Clicca "Add secret"

Ora ogni push su `main` farà una build automatica gratuita dell'APK!

## ✅ Verifica Setup

Dopo aver eseguito tutto, verifica:

```bash
# Controlla che ci siano tutte le cartelle
ls -la
# Dovresti vedere: components, screens, services, hooks, utils, types, public, android

# Controlla build
ls -la dist/
# Dovresti vedere i file compilati

# Controlla Android
ls -la android/
# Dovresti vedere il progetto Android nativo
```

## 🐛 Problemi Comuni

**Errore "npm install" fallisce:**
```bash
rm -rf node_modules package-lock.json
npm install
```

**Errore "cap add android" fallisce:**
```bash
# Assicurati di aver fatto npm run build prima
npm run build
npx cap add android --force
```

**Gradlew non eseguibile:**
```bash
chmod +x android/gradlew
```

## 📱 Installazione APK su Telefono

1. Copia l'APK sul telefono:
   ```bash
   adb install android/app/build/outputs/apk/release/app-release-unsigned.apk
   ```

2. Oppure scarica da GitHub Actions:
   - Vai su Actions tab della repo
   - Clicca sull'ultima run
   - Scarica "app-release-unsigned" dagli Artifacts
   - Trasferisci su telefono e installa

## ✨ Fatto!

Ora hai:
- ✅ Codice PWA completo copiato
- ✅ Capacitor configurato
- ✅ Progetto Android generato
- ✅ GitHub Actions pronto per build automatiche
- ✅ Wrapper nativi (camera, haptics, backbutton) pronti per l'uso

Puoi iniziare a sviluppare! Modifica i file come nella PWA, poi `npm run build && npx cap sync` per aggiornare l'app nativa.
