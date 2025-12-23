# Come Generare Nuovo Keystore per Android

Il keystore attuale è corrotto. Segui questi passaggi per generarne uno nuovo:

## 1. Genera il Keystore

```bash
keytool -genkeypair -v \
  -storetype PKCS12 \
  -keystore release.keystore \
  -alias gestore \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

**Quando richiesto, inserisci:**
- Password keystore: scegli una password sicura (es: `Gestore2024!`)
- Nome e cognome: `Gestore Spese`
- Unità organizzativa: `Development`
- Organizzazione: `Tuo Nome`
- Città: `Rome`
- Provincia: `RM`
- Codice paese: `IT`
- Conferma con `sì`
- Password chiave: usa la stessa del keystore

## 2. Converti in Base64

```bash
base64 -i release.keystore | tr -d '\n' > keystore.base64.txt
```

Oppure su Windows:
```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("release.keystore")) | Out-File -Encoding ASCII keystore.base64.txt
```

## 3. Aggiorna i GitHub Secrets

Vai su: https://github.com/jerbamichol-del/gestore-capacitor/settings/secrets/actions

Aggiorna questi secrets:

1. **KEYSTORE_BASE64**: incolla il contenuto di `keystore.base64.txt`
2. **KEY_ALIAS**: `gestore`
3. **KEYSTORE_PASSWORD**: la password che hai scelto
4. **KEY_PASSWORD**: la stessa password del keystore

## 4. Testa la Build

Una volta aggiornati i secrets, fai un push qualsiasi per triggerare la build:

```bash
git commit --allow-empty -m "Test build con nuovo keystore"
git push
```

## Note Importanti

⚠️ **CONSERVA IL KEYSTORE!** 
- Fai un backup di `release.keystore` in un posto sicuro
- NON committarlo nel repository
- Se lo perdi, non potrai più aggiornare l'app su Google Play

✅ **Dopo la prima build riuscita:**
- Scarica l'APK firmato
- Testalo sul dispositivo
- Conserva una copia del keystore
