#!/bin/bash

# Script to generate a DEBUG keystore for development/sideload builds
# This keystore will be COMMITTED to the repository to ensure:
# 1. Same signature across all builds
# 2. Users can update the app without uninstalling
# 3. No package conflicts during manual installation

set -e

echo "🔑 Generating DEBUG keystore for Gestore Spese..."
echo ""

KEYSTORE_PATH="android/app/debug.keystore"
ALIAS="androiddebugkey"
STORE_PASS="android"
KEY_PASS="android"

# Remove existing keystore if present
if [ -f "$KEYSTORE_PATH" ]; then
    echo "⚠️ Keystore already exists at $KEYSTORE_PATH"
    read -p "Do you want to OVERWRITE it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Aborted. Keeping existing keystore."
        exit 0
    fi
    rm "$KEYSTORE_PATH"
    echo "🗑️ Removed existing keystore"
fi

# Create android/app directory if it doesn't exist
mkdir -p android/app

# Generate keystore with FIXED parameters
keytool -genkeypair -v \
  -storetype PKCS12 \
  -keystore "$KEYSTORE_PATH" \
  -alias "$ALIAS" \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass "$STORE_PASS" \
  -keypass "$KEY_PASS" \
  -dname "CN=Gestore Spese Debug, OU=Development, O=Gestore Spese, L=Rome, ST=Lazio, C=IT"

echo ""
echo "✅ Keystore generated successfully!"
echo ""
echo "📍 Location: $KEYSTORE_PATH"
echo "🔑 Alias: $ALIAS"
echo "🔒 Store Password: $STORE_PASS"
echo "🔒 Key Password: $KEY_PASS"
echo ""
echo "📋 Keystore Info:"
keytool -list -v -keystore "$KEYSTORE_PATH" -storepass "$STORE_PASS" | head -n 25
echo ""
echo "⚠️ IMPORTANT: This keystore MUST be committed to the repository!"
echo ""
echo "Run the following commands:"
echo ""
echo "  git add $KEYSTORE_PATH"
echo "  git add android-config/signing.gradle"
echo "  git commit -m 'chore: add persistent debug keystore for consistent signing'"
echo "  git push"
echo ""
echo "✅ After committing, all builds will use this EXACT keystore!"
echo "🚀 Users can update the app without package conflicts!"
echo ""
