# ==============================================
# Setup Android Plugins - SMS Reader + Notification Listener
# PowerShell Version for Windows
# ==============================================

Write-Host "🚀 Android Plugin Setup - Gestore Finanze" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""

# Check if android folder exists
if (-not (Test-Path "android")) {
    Write-Host "❌ Cartella android/ non trovata" -ForegroundColor Red
    Write-Host "Esegui prima: npx cap sync android"
    exit 1
}

Write-Host "✅ Cartella android/ trovata" -ForegroundColor Green
Write-Host ""

# ==============================================
# 1. COPY JAVA PLUGINS
# ==============================================

Write-Host "📦 Step 1: Copiando plugin Java..." -ForegroundColor Cyan

$javaDir = "android\app\src\main\java\com\gestorefinanze\app"

if (-not (Test-Path $javaDir)) {
    Write-Host "❌ Directory Java non trovata: $javaDir" -ForegroundColor Red
    exit 1
}

# Copy plugins
Copy-Item "android-config\SMSReaderPlugin.java" "$javaDir\" -Force
Copy-Item "android-config\NotificationListenerPlugin.java" "$javaDir\" -Force
Copy-Item "android-config\NotificationListenerService.java" "$javaDir\" -Force

Write-Host "✅ Plugin copiati:" -ForegroundColor Green
Write-Host "   - SMSReaderPlugin.java"
Write-Host "   - NotificationListenerPlugin.java"
Write-Host "   - NotificationListenerService.java"
Write-Host ""

# ==============================================
# 2. UPDATE MainActivity.java
# ==============================================

Write-Host "⚙️ Step 2: Aggiornando MainActivity.java..." -ForegroundColor Cyan

$mainActivity = "$javaDir\MainActivity.java"

if (-not (Test-Path $mainActivity)) {
    Write-Host "❌ MainActivity.java non trovato" -ForegroundColor Red
    exit 1
}

# Backup
Copy-Item $mainActivity "$mainActivity.backup" -Force
Write-Host "💾 Backup creato: MainActivity.java.backup" -ForegroundColor Yellow

# Check if already registered
$content = Get-Content $mainActivity -Raw
if ($content -match "SMSReaderPlugin") {
    Write-Host "⚠️  Plugin già registrati in MainActivity" -ForegroundColor Yellow
} else {
    # Create new MainActivity with plugin registration
    $newContent = @"
package com.gestorefinanze.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.gestorefinanze.app.SMSReaderPlugin;
import com.gestorefinanze.app.NotificationListenerPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Register custom plugins
        registerPlugin(SMSReaderPlugin.class);
        registerPlugin(NotificationListenerPlugin.class);
    }
}
"@

    Set-Content -Path $mainActivity -Value $newContent
    Write-Host "✅ MainActivity.java aggiornato" -ForegroundColor Green
}

Write-Host ""

# ==============================================
# 3. UPDATE AndroidManifest.xml
# ==============================================

Write-Host "📝 Step 3: Verificando AndroidManifest.xml..." -ForegroundColor Cyan

$manifest = "android\app\src\main\AndroidManifest.xml"

if (-not (Test-Path $manifest)) {
    Write-Host "❌ AndroidManifest.xml non trovato" -ForegroundColor Red
    exit 1
}

# Backup
Copy-Item $manifest "$manifest.backup" -Force
Write-Host "💾 Backup creato: AndroidManifest.xml.backup" -ForegroundColor Yellow

# Check if permissions already added
$manifestContent = Get-Content $manifest -Raw
if ($manifestContent -match "READ_SMS") {
    Write-Host "✅ Permessi già presenti in AndroidManifest" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "⚠️  ATTENZIONE: Aggiungi manualmente questi elementi ad AndroidManifest.xml:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "<!-- Aggiungi dopo <uses-permission> esistenti -->" -ForegroundColor White
    Write-Host '<uses-permission android:name="android.permission.READ_SMS" />' -ForegroundColor White
    Write-Host '<uses-permission android:name="android.permission.RECEIVE_SMS" />' -ForegroundColor White
    Write-Host '<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />' -ForegroundColor White
    Write-Host '<uses-permission android:name="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE" />' -ForegroundColor White
    Write-Host ""
    Write-Host "<!-- Aggiungi dentro <application> prima di </application> -->" -ForegroundColor White
    Write-Host '<service' -ForegroundColor White
    Write-Host '    android:name=".NotificationListenerService"' -ForegroundColor White
    Write-Host '    android:exported="true"' -ForegroundColor White
    Write-Host '    android:permission="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE">' -ForegroundColor White
    Write-Host '    <intent-filter>' -ForegroundColor White
    Write-Host '        <action android:name="android.service.notification.NotificationListenerService" />' -ForegroundColor White
    Write-Host '    </intent-filter>' -ForegroundColor White
    Write-Host '</service>' -ForegroundColor White
    Write-Host ""
}

Write-Host ""

# ==============================================
# 4. SUMMARY
# ==============================================

Write-Host "============================================" -ForegroundColor Green
Write-Host "✅ SETUP COMPLETATO!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "📦 Plugin installati:"
Write-Host "   - SMSReader (lettura SMS)"
Write-Host "   - NotificationListener (notifiche app)"
Write-Host ""
Write-Host "🔧 Prossimi passi:"
Write-Host "   1. Controlla AndroidManifest.xml e aggiungi permessi/service se necessario"
Write-Host "   2. Build Android: npm run build:android"
Write-Host "   3. Oppure apri Android Studio: npx cap open android"
Write-Host ""
Write-Host "📖 Documentazione:"
Write-Host "   - android-config\README_SMS_PLUGIN.md"
Write-Host "   - docs\SETUP_AUTO_TRANSACTIONS.md"
Write-Host ""
Write-Host "Backups creati:" -ForegroundColor Yellow
Write-Host "   - MainActivity.java.backup"
Write-Host "   - AndroidManifest.xml.backup"
Write-Host ""
