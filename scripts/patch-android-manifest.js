import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const manifestPath = path.join(__dirname, '../android/app/src/main/AndroidManifest.xml');

console.log('\n🔍 Cerco AndroidManifest.xml in:', manifestPath);

if (!fs.existsSync(manifestPath)) {
  console.log('❌ AndroidManifest.xml non trovato!');
  console.log('📁 Contenuto directory android/app/src/main/:');
  const mainDir = path.join(__dirname, '../android/app/src/main');
  if (fs.existsSync(mainDir)) {
    console.log(fs.readdirSync(mainDir));
  }
  process.exit(1);
}

console.log('✅ AndroidManifest.xml trovato!');

let manifest = fs.readFileSync(manifestPath, 'utf8');

console.log('\n📖 Dimensione originale:', manifest.length, 'caratteri');

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

console.log('\n🔑 Permessi da aggiungere:');
console.log(permissions);

// Verifica se i permessi sono già presenti
if (manifest.includes('USE_BIOMETRIC')) {
  console.log('\n✅ Permessi biometrici già presenti');
} else {
  console.log('\n❌ Permessi biometrici NON presenti, li aggiungo...');
}

if (manifest.includes('RECORD_AUDIO')) {
  console.log('✅ Permesso microfono già presente');
} else {
  console.log('❌ Permesso microfono NON presente, lo aggiungo...');
}

// Rimuovi permessi duplicati se già presenti
const permissionLines = permissions.split('\n');
permissionLines.forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('<!--') && !trimmed.startsWith('<uses-permission')) {
    return; // Skip empty lines
  }
  if (trimmed.startsWith('<uses-permission')) {
    const regex = new RegExp(trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    const matches = manifest.match(regex);
    if (matches && matches.length > 1) {
      console.log(`⚠️  Rimuovo duplicato: ${trimmed.substring(0, 50)}...`);
      manifest = manifest.replace(regex, '');
    }
  }
});

// Aggiungi i permessi dopo il tag <manifest> ma prima di <application>
if (!manifest.includes('USE_BIOMETRIC') || !manifest.includes('RECORD_AUDIO')) {
  // Trova il punto di inserimento
  const manifestTagMatch = manifest.match(/<manifest[^>]*>/i);
  if (manifestTagMatch) {
    const insertPoint = manifestTagMatch.index + manifestTagMatch[0].length;
    manifest = manifest.slice(0, insertPoint) + '\n\n    ' + permissions + '\n' + manifest.slice(insertPoint);
    console.log('\n✅ Permessi aggiunti con successo!');
  } else {
    console.log('\n❌ Impossibile trovare il tag <manifest>');
    process.exit(1);
  }
} else {
  console.log('\n✅ Tutti i permessi sono già presenti');
}

console.log('\n📖 Dimensione finale:', manifest.length, 'caratteri');

fs.writeFileSync(manifestPath, manifest, 'utf8');

console.log('✅ File salvato!\n');
