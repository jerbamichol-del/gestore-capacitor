# Gestore Spese - Capacitor Native App

## 📱 App Nativa Android

Questa è la versione nativa Android dell'app "Gestore Spese" costruita con Capacitor.

## ✨ Features

- 🎨 Icone native generate automaticamente
- 🔒 Biometria nativa (fingerprint/face)
- 📱 Ottimizzata per Android con safe-area support
- 🚀 Build automatica con GitHub Actions
- 📥 Download APK da GitHub Releases
- **🆕 Lettura SMS automatica** - Rileva transazioni da SMS bancari
- **🔔 Notification Listener** - Intercetta notifiche app bancarie

## 🔥 NEW: Auto-Transaction Detection

### 💬 Lettura SMS Bancari

L'app può **rilevare automaticamente** le transazioni dai messaggi SMS delle tue banche!

**Banche Supportate:**
- ✅ Revolut
- ✅ PayPal
- ✅ Postepay
- ✅ BBVA
- ✅ Intesa Sanpaolo

### 🚀 Quick Setup

```bash
# 1. Sync Android
npx cap sync android

# 2. Setup automatico plugin
# Windows:
.\setup-android-plugins.ps1

# Linux/Mac:
chmod +x setup-android-plugins.sh
./setup-android-plugins.sh

# 3. Build
npm run build:android
```

📖 **Guida Completa**: [SETUP_SMS_READER.md](./SETUP_SMS_READER.md)

### Come Funziona

1. **SMS Arriva** → Banca invia "Pagamento 30€ presso Esselunga"
2. **App Scan** → Parser automatico estrae importo/merchant
3. **Badge Appare** → Transazione pending da confermare
4. **Tu Confermi** → Salvata nelle tue transazioni!

---

## 🔄 Sincronizzazione con PWA

I file vengono automaticamente sincronizzati dalla repository PWA preservando:
- `PinVerifierModal.tsx` (usa biometrics nativa)
- `vite.config.ts` (configurazione nativa)
- `services/biometrics-native.ts` (plugin Capacitor)
- `services/auto-transaction-service.ts` (detection SMS/notifiche)

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

## 📚 Documentazione

- **Setup SMS Reader**: [SETUP_SMS_READER.md](./SETUP_SMS_READER.md)
- **Setup Auto-Transactions**: [docs/SETUP_AUTO_TRANSACTIONS.md](./docs/SETUP_AUTO_TRANSACTIONS.md)
- **Plugin SMS**: [android-config/README_SMS_PLUGIN.md](./android-config/README_SMS_PLUGIN.md)
- **Integrazione UI**: [docs/INTEGRATION_GUIDE.md](./docs/INTEGRATION_GUIDE.md)

---

**Ultimo aggiornamento**: 2025-12-24
- ✅ **NEW:** Auto-detection SMS + Notifiche bancarie
- ✅ Script setup automatico (Windows + Linux/Mac)
- ✅ 5 banche italiane supportate
- ✅ Duplicate detection con hash MD5
- ✅ Pending transactions system
- ✅ Fix overflow calcolatrice con safe-area
- ✅ Generazione automatica icone native
- ✅ QR code per download APK integrato
