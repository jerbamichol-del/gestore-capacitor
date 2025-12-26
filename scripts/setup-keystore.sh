#!/bin/bash

# Script to generate a consistent debug keystore
# This prevents "package conflicts" when installing new builds

KEYSTORE_PATH="android/app/debug.keystore"
KEYSTORE_ALIAS="androiddebugkey"
KEYSTORE_PASSWORD="android"

echo "🔑 Setting up debug keystore..."

# Check if keystore already exists
if [ -f "$KEYSTORE_PATH" ]; then
  echo "✅ Debug keystore already exists: $KEYSTORE_PATH"
  ls -lh "$KEYSTORE_PATH"
  exit 0
fi

# Create keystore directory if not exists
mkdir -p "$(dirname "$KEYSTORE_PATH")"

echo "🔨 Generating new debug keystore..."

# Generate keystore with fixed credentials
keytool -genkey -v \
  -keystore "$KEYSTORE_PATH" \
  -alias "$KEYSTORE_ALIAS" \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass "$KEYSTORE_PASSWORD" \
  -keypass "$KEYSTORE_PASSWORD" \
  -dname "CN=Android Debug,O=Android,C=US"

if [ $? -eq 0 ]; then
  echo "✅ Debug keystore created successfully!"
  ls -lh "$KEYSTORE_PATH"
else
  echo "❌ ERROR: Failed to create debug keystore"
  exit 1
fi
