# Gestore Spese - Native App (Capacitor)

🚀 **Versione nativa Android/iOS** della PWA Gestore Spese, convertita con Capacitor.

## 📦 Repository Originale

Questo progetto è una conversione della PWA [gestore](https://github.com/jerbamichol-del/gestore) in app nativa mantenendo il 99% del codice originale.

## ✨ Caratteristiche

- ✅ **Identica alla PWA** - UI e funzionalità invariate
- 📸 **Camera nativa** - Integrazione Capacitor Camera API
- 📳 **Haptics** - Feedback tattile su Android/iOS
- ⬅️ **Back button** - Gestione nativa del tasto indietro Android
- 🤖 **AI Gemini** - Funzionamento identico alla PWA
- 💾 **IndexedDB** - Persistenza dati locale
- 📊 **Recharts** - Grafici spese
- 📄 **Export XLSX** - Esportazione Excel

## 🛠️ Setup Locale

### Prerequisiti

- Node.js 20+
- npm/yarn
- Android Studio (per build Android)
- Xcode (per build iOS, solo macOS)

### Installazione

```bash
# 1. Clona la repository
git clone https://github.com/jerbamichol-del/gestore-capacitor.git
cd gestore-capacitor

# 2. Copia tutto il codice dalla PWA originale
cp -r ../gestore/src ./
cp -r ../gestore/components ./
cp -r ../gestore/screens ./
cp -r ../gestore/services ./
cp -r ../gestore/hooks ./
cp -r ../gestore/utils ./
cp -r ../gestore/types ./
cp -r ../gestore/public ./
cp ../gestore/App.tsx ./
cp ../gestore/AuthGate.tsx ./
cp ../gestore/index.tsx ./
cp ../gestore/types.ts ./
cp ../gestore/tsconfig.json ./
cp ../gestore/.gitignore ./

# 3. Installa dipendenze
npm install

# 4. Crea file .env con API key Gemini
echo "GEMINI_API_KEY=your_api_key_here" > .env

# 5. Build web assets
npm run build

# 6. Inizializza Capacitor Android
npx cap add android

# 7. Sincronizza file con Android
npx cap sync android
```

## 🏗️ Build Android APK

### Opzione 1: Locale

```bash
# Build web + sync + Gradle build
npm run build
npx cap sync android
cd android
./gradlew assembleRelease

# APK in: android/app/build/outputs/apk/release/app-release-unsigned.apk
```

### Opzione 2: GitHub Actions (GRATUITO)

1. **Aggiungi Secret `GEMINI_API_KEY`**:
   - Vai su Settings → Secrets and variables → Actions
   - New repository secret: `GEMINI_API_KEY` = la tua API key

2. **Push su `main` o trigger manuale**:
   - Il workflow `.github/workflows/build-apk.yml` si avvia automaticamente
   - Build dura ~5-7 minuti (FREE tier GitHub Actions)
   - APK scaricabile dagli Artifacts della run

3. **Release automatiche** (opzionale):
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
   L'APK verrà allegato automaticamente alla release.

## 📱 Integrazione Capacitor

### Hooks Nativi Creati

Il file `src/hooks/useCapacitor.ts` fornisce:

#### `useCamera()`
```typescript
const { takePicture, selectFromGallery, isNative } = useCamera();

// Scatta foto
const dataUrl = await takePicture();

// Seleziona da galleria
const dataUrl = await selectFromGallery();
```

#### `useHaptics()`
```typescript
const { impact, vibrate, notification } = useHaptics();

// Feedback leggero/medio/pesante
await impact('medium');

// Vibrazione personalizzata
await vibrate(200); // ms

// Notifica haptic
await notification();
```

#### `useBackButton()`
```typescript
useBackButton(() => {
  // Gestisci back button
  if (canGoBack) {
    navigate(-1);
    return false; // Non uscire dall'app
  }
  return true; // Esci dall'app
});
```

### Come Integrare nei Componenti Esistenti

**NON modificare i componenti esistenti**. Aggiungi solo dove serve:

```typescript
// Esempio: aggiungere camera in un componente
import { useCamera, useHaptics } from '@/src/hooks/useCapacitor';

function MyComponent() {
  const { takePicture } = useCamera();
  const { impact } = useHaptics();

  const handleTakePicture = async () => {
    await impact('light'); // Feedback tattile
    const photo = await takePicture();
    if (photo) {
      // Usa photo (dataUrl)
    }
  };

  return <button onClick={handleTakePicture}>📸 Foto</button>;
}
```

## 🔧 File Modificati/Creati

### Nuovi File
- `capacitor.config.ts` - Config Capacitor
- `src/hooks/useCapacitor.ts` - Wrapper nativi
- `.github/workflows/build-apk.yml` - CI/CD gratuito

### Modificati
- `package.json` - Aggiunte dipendenze Capacitor
- `vite.config.ts` - Rimosso `base: '/gestore/'` (non serve per app nativa)

### Invariati (99% del codice)
- `App.tsx`, `AuthGate.tsx`, `index.tsx`
- Tutti i componenti in `components/`
- Tutti gli screen in `screens/`
- Tutti i service in `services/`
- Tutte le utility in `utils/`
- Gemini AI, IndexedDB, Recharts, XLSX

## 🧪 Test

```bash
# Dev browser
npm run dev

# Test su emulatore Android
npx cap run android

# Apri Android Studio
npx cap open android
```

## 📦 Struttura

```
gestore-capacitor/
├── .github/
│   └── workflows/
│       └── build-apk.yml      # CI/CD gratuito
├── android/                    # Progetto Android nativo (auto-generato)
├── src/
│   └── hooks/
│       └── useCapacitor.ts    # Wrapper nativi
├── components/                 # (copiati da PWA)
├── screens/                    # (copiati da PWA)
├── services/                   # (copiati da PWA)
├── hooks/                      # (copiati da PWA)
├── utils/                      # (copiati da PWA)
├── public/                     # (copiati da PWA)
├── App.tsx                     # (copiato da PWA)
├── capacitor.config.ts         # Config Capacitor
├── package.json                # + dipendenze Capacitor
└── vite.config.ts              # Modificato per Capacitor
```

## 🚀 Prossimi Passi

1. **Copia codice PWA** nella nuova repo
2. **Testa build locale**: `npm install && npm run build && npx cap add android && npx cap sync`
3. **Setup GitHub Actions**: aggiungi secret `GEMINI_API_KEY`
4. **Push** e verifica build automatica
5. **Integra hooks nativi** dove necessario (camera, haptics)
6. **Test su device fisico**

## 📄 Licenza

Stessa licenza della PWA originale.

## 🐛 Issues

Segnala bug o richieste su [GitHub Issues](https://github.com/jerbamichol-del/gestore-capacitor/issues).
