# Gestore Spese - Capacitor Native App

## 📱 App Nativa Android

Questa è la versione nativa Android dell'app "Gestore Spese" costruita con Capacitor.

## ✨ Features

- 🎨 Icone native generate automaticamente
- 🔒 Biometria nativa (fingerprint/face)
- 📱 Ottimizzata per Android con safe-area support
- 🚀 Build automatica con GitHub Actions
- 📥 Download APK da GitHub Releases

## 🔄 Sincronizzazione con PWA

I file vengono automaticamente sincronizzati dalla repository PWA preservando:
- `PinVerifierModal.tsx` (usa biometrics nativa)
- `vite.config.ts` (configurazione nativa)
- `services/biometrics-native.ts` (plugin Capacitor)

## 📦 Download

Scarica l'ultima versione: [Releases](https://github.com/jerbamichol-del/gestore-capacitor/releases/latest)

## 🛠️ Build Locale

```bash
npm install
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
```

---

**Ultimo aggiornamento**: 2025-12-23
- ✅ Fix overflow calcolatrice con safe-area
- ✅ Generazione automatica icone native
- ✅ QR code per download APK integrato
