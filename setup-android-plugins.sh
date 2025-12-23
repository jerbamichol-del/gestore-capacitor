#!/bin/bash

# ==============================================
# Setup Android Plugins - SMS Reader + Notification Listener
# ==============================================

set -e

echo "🚀 Android Plugin Setup - Gestore Finanze"
echo "============================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if android folder exists
if [ ! -d "android" ]; then
    echo -e "${RED}❌ Cartella android/ non trovata${NC}"
    echo "Esegui prima: npx cap sync android"
    exit 1
fi

echo -e "${GREEN}✅ Cartella android/ trovata${NC}"
echo ""

# ==============================================
# 1. COPY JAVA PLUGINS
# ==============================================

echo "📦 Step 1: Copiando plugin Java..."

JAVA_DIR="android/app/src/main/java/com/gestorefinanze/app"

if [ ! -d "$JAVA_DIR" ]; then
    echo -e "${RED}❌ Directory Java non trovata: $JAVA_DIR${NC}"
    exit 1
fi

# Copy plugins
cp android-config/SMSReaderPlugin.java "$JAVA_DIR/"
cp android-config/NotificationListenerPlugin.java "$JAVA_DIR/"
cp android-config/NotificationListenerService.java "$JAVA_DIR/"

echo -e "${GREEN}✅ Plugin copiati:${NC}"
echo "   - SMSReaderPlugin.java"
echo "   - NotificationListenerPlugin.java"
echo "   - NotificationListenerService.java"
echo ""

# ==============================================
# 2. UPDATE MainActivity.java
# ==============================================

echo "⚙️ Step 2: Aggiornando MainActivity.java..."

MAIN_ACTIVITY="$JAVA_DIR/MainActivity.java"

if [ ! -f "$MAIN_ACTIVITY" ]; then
    echo -e "${RED}❌ MainActivity.java non trovato${NC}"
    exit 1
fi

# Backup
cp "$MAIN_ACTIVITY" "$MAIN_ACTIVITY.backup"
echo -e "${YELLOW}💾 Backup creato: MainActivity.java.backup${NC}"

# Check if already registered
if grep -q "SMSReaderPlugin" "$MAIN_ACTIVITY"; then
    echo -e "${YELLOW}⚠️  Plugin già registrati in MainActivity${NC}"
else
    # Create new MainActivity with plugin registration
    cat > "$MAIN_ACTIVITY" << 'EOF'
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
EOF

    echo -e "${GREEN}✅ MainActivity.java aggiornato${NC}"
fi

echo ""

# ==============================================
# 3. UPDATE AndroidManifest.xml
# ==============================================

echo "📝 Step 3: Aggiornando AndroidManifest.xml..."

MANIFEST="android/app/src/main/AndroidManifest.xml"

if [ ! -f "$MANIFEST" ]; then
    echo -e "${RED}❌ AndroidManifest.xml non trovato${NC}"
    exit 1
fi

# Backup
cp "$MANIFEST" "$MANIFEST.backup"
echo -e "${YELLOW}💾 Backup creato: AndroidManifest.xml.backup${NC}"

# Check if permissions already added
if grep -q "READ_SMS" "$MANIFEST"; then
    echo -e "${YELLOW}⚠️  Permessi già presenti in AndroidManifest${NC}"
else
    # Add permissions and service
    # This is a simplified version - in production, use XML parsing
    echo -e "${YELLOW}⚠️  ATTENZIONE: Aggiungi manualmente questi elementi ad AndroidManifest.xml:${NC}"
    echo ""
    echo "<!-- Aggiungi dopo <uses-permission> esistenti -->"
    echo "<uses-permission android:name=\"android.permission.READ_SMS\" />"
    echo "<uses-permission android:name=\"android.permission.RECEIVE_SMS\" />"
    echo "<uses-permission android:name=\"android.permission.POST_NOTIFICATIONS\" />"
    echo "<uses-permission android:name=\"android.permission.BIND_NOTIFICATION_LISTENER_SERVICE\" />"
    echo ""
    echo "<!-- Aggiungi dentro <application> prima di </application> -->"
    echo "<service"
    echo "    android:name=\".NotificationListenerService\""
    echo "    android:exported=\"true\""
    echo "    android:permission=\"android.permission.BIND_NOTIFICATION_LISTENER_SERVICE\">"
    echo "    <intent-filter>"
    echo "        <action android:name=\"android.service.notification.NotificationListenerService\" />"
    echo "    </intent-filter>"
    echo "</service>"
    echo ""
fi

echo ""

# ==============================================
# 4. SUMMARY
# ==============================================

echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}✅ SETUP COMPLETATO!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "📦 Plugin installati:"
echo "   - SMSReader (lettura SMS)"
echo "   - NotificationListener (notifiche app)"
echo ""
echo "🔧 Prossimi passi:"
echo "   1. Controlla AndroidManifest.xml e aggiungi permessi/service"
echo "   2. Build Android: npm run build:android"
echo "   3. Oppure apri Android Studio: npx cap open android"
echo ""
echo "📖 Documentazione:"
echo "   - android-config/README_SMS_PLUGIN.md"
echo "   - docs/SETUP_AUTO_TRANSACTIONS.md"
echo ""
echo -e "${YELLOW}Backups creati:${NC}"
echo "   - MainActivity.java.backup"
echo "   - AndroidManifest.xml.backup"
echo ""
