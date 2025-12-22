# 🚀 SETUP COMPLETO - SOLO GITHUB (ZERO LOCALE)

## ✅ GIÀ FATTO (da me):

1. ✅ Repository `gestore-capacitor` creata
2. ✅ `package.json` con Capacitor
3. ✅ `capacitor.config.ts`
4. ✅ `vite.config.ts` 
5. ✅ `src/hooks/useCapacitor.ts` (wrapper nativi)
6. ✅ `.github/workflows/build-apk.yml` (CI/CD gratuito)
7. ✅ File core copiati: `App.tsx`, `AuthGate.tsx`, `index.tsx`, `types.ts`

## ⚠️ MANCA ANCORA (devi fare tu):

### Cartelle da copiare manualmente via GitHub:

Purtroppo l'API GitHub non permette di copiare intere cartelle in un colpo solo.
Devi copiare MANUALMENTE questi file/cartelle dalla repo `gestore` alla repo `gestore-capacitor`:

**OPZIONE 1: Via interfaccia web GitHub** (copia-incolla file per file)
1. Apri https://github.com/jerbamichol-del/gestore
2. Entra in ogni cartella, copia il contenuto di ogni file
3. Crea lo stesso file in https://github.com/jerbamichol-del/gestore-capacitor

**OPZIONE 2: Clone locale (più veloce)** 
Se non vuoi scaricare nulla, usa GitHub Codespaces (gratis, online):

1. Vai su https://github.com/jerbamichol-del/gestore-capacitor
2. Clicca sul pulsante verde "Code" → "Codespaces" → "Create codespace on main"
3. Aspetta che si apra l'editor VS Code nel browser
4. Nel terminale di Codespaces, esegui:

```bash
# Clone repo PWA originale
git clone https://github.com/jerbamichol-del/gestore.git /tmp/gestore

# Copia TUTTE le cartelle
cp -r /tmp/gestore/components ./
cp -r /tmp/gestore/screens ./
cp -r /tmp/gestore/services ./
cp -r /tmp/gestore/hooks ./
cp -r /tmp/gestore/utils ./
cp -r /tmp/gestore/types ./
cp -r /tmp/gestore/public ./
cp -r /tmp/gestore/share-target ./

# Copia file rimanenti
cp /tmp/gestore/tsconfig.json ./
cp /tmp/gestore/.gitignore ./
cp /tmp/gestore/index.html ./
cp /tmp/gestore/metadata.json ./

# Commit e push
git add .
git commit -m "Copy all PWA files"
git push
```

5. Chiudi il Codespace (gratis fino a 60 ore/mese)

### Lista cartelle da copiare:

- `components/` (tutti i componenti React)
- `screens/` (tutte le schermate)
- `services/` (servizi API, auth, etc)
- `hooks/` (custom hooks)
- `utils/` (utility functions)
- `types/` (TypeScript types)
- `public/` (assets statici)
- `share-target/` (share target handler)

### File singoli da copiare:

- `tsconfig.json`
- `.gitignore`
- `index.html`
- `metadata.json`

## 🔐 Setup GitHub Actions:

Dopo aver copiato tutti i file:

1. Vai su https://github.com/jerbamichol-del/gestore-capacitor/settings/secrets/actions
2. Clicca "New repository secret"
3. Nome: `GEMINI_API_KEY`
4. Valore: La tua Gemini API key
5. Clicca "Add secret"

Ogni push su `main` farà partire la build automatica dell'APK (5-7 minuti).

## 📱 Scaricare APK:

Dopo la build:

1. Vai su https://github.com/jerbamichol-del/gestore-capacitor/actions
2. Clicca sull'ultima workflow run
3. Scorri in basso fino a "Artifacts"
4. Scarica `app-release-unsigned.apk`
5. Trasferisci su telefono Android e installa

## ✨ ALTERNATIVA VELOCE:

**Se vuoi ZERO locale**, ti suggerisco:

1. Usa **GitHub Codespaces** (opzione 2 sopra) - è un VS Code nel browser, gratis
2. Esegui i comandi bash per copiare tutto
3. Fai push
4. Chiudi Codespace
5. GitHub Actions builda l'APK automaticamente

**Tempo totale: 5 minuti** 🚀

## 🐛 Problemi?

Se GitHub Actions fallisce:
- Controlla di aver aggiunto il secret `GEMINI_API_KEY`
- Guarda i logs della workflow run per errori
- Verifica che tutti i file siano stati copiati correttamente

## 🎯 Risultato Finale:

Dopo tutto questo, avrai:
- ✅ App nativa Capacitor completa
- ✅ Build APK automatica ad ogni push
- ✅ Zero codice in locale (tutto su GitHub)
- ✅ Camera, Haptics, BackButton nativi
- ✅ Gemini AI funzionante
- ✅ UI identica alla PWA
