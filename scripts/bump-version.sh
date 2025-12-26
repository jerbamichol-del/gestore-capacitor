#!/bin/bash

# Script to automatically increment Android versionCode
# Used by GitHub Actions workflow before building APK

GRADLE_FILE="android/app/build.gradle"

if [ ! -f "$GRADLE_FILE" ]; then
  echo "❌ ERROR: $GRADLE_FILE not found!"
  exit 1
fi

# Extract current versionCode
CURRENT_VERSION=$(grep -oP 'versionCode \K\d+' "$GRADLE_FILE")

if [ -z "$CURRENT_VERSION" ]; then
  echo "❌ ERROR: Could not find versionCode in $GRADLE_FILE"
  exit 1
fi

echo "📊 Current versionCode: $CURRENT_VERSION"

# Increment versionCode
NEW_VERSION=$((CURRENT_VERSION + 1))

echo "⬆️  Bumping to versionCode: $NEW_VERSION"

# Update versionCode in build.gradle
sed -i "s/versionCode $CURRENT_VERSION/versionCode $NEW_VERSION/g" "$GRADLE_FILE"

# Verify update
UPDATED_VERSION=$(grep -oP 'versionCode \K\d+' "$GRADLE_FILE")

if [ "$UPDATED_VERSION" = "$NEW_VERSION" ]; then
  echo "✅ versionCode successfully bumped to $NEW_VERSION"
  
  # Extract versionName for display
  VERSION_NAME=$(grep -oP 'versionName "\K[^"]+' "$GRADLE_FILE")
  echo "📱 Current versionName: $VERSION_NAME"
  
  exit 0
else
  echo "❌ ERROR: Failed to update versionCode"
  exit 1
fi
