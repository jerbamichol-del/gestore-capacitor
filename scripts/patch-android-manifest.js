import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const manifestPath = path.join(__dirname, '../android/app/src/main/AndroidManifest.xml');

if (!fs.existsSync(manifestPath)) {
  console.log('❌ AndroidManifest.xml non trovato');
  process.exit(1);
}

let manifest = fs.readFileSync(manifestPath, 'utf8');

// Permessi da aggiungere
const permissions = [
  '<!-- Biometric Authentication -->',
  '<uses-permission android:name="android.permission.USE_BIOMETRIC" />',
  '<uses-permission android:name="android.permission.USE_FINGERPRINT" />',
  '',
  '<!-- Audio Recording -->',
  '<uses-permission android:name="android.permission.RECORD_AUDIO" />',
  '<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />',
  '',
  '<!-- Camera -->',
  '<uses-permission android:name="android.permission.CAMERA" />',
  '',
  '<!-- Storage -->',
  '<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />',
  '<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="32" />',
  '<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />'
].join('\n    ');

// Rimuovi permessi duplicati se già presenti
const permissionLines = permissions.split('\n');
permissionLines.forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('<!--')) {
    // Rimuovi se esiste già
    const regex = new RegExp(trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    manifest = manifest.replace(regex, '');
  }
});

// Aggiungi i permessi dopo il tag <manifest> ma prima di <application>
if (!manifest.includes('USE_BIOMETRIC')) {
  manifest = manifest.replace(
    /(android:versionName="[^"]*">)/,
    `$1\n\n    ${permissions}\n`
  );
  console.log('✅ Permessi aggiunti ad AndroidManifest.xml');
} else {
  console.log('✅ Permessi già presenti');
}

fs.writeFileSync(manifestPath, manifest, 'utf8');
