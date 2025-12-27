// src/hooks/useUpdateChecker.ts
import { useState, useEffect } from 'react';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

interface UpdateInfo {
  available: boolean;
  currentVersion: string;
  currentBuild: string;
  latestVersion: string;
  latestBuild: string;
  downloadUrl: string;
  releaseNotes: string;
}

const GITHUB_REPO_OWNER = 'jerbamichol-del';
const GITHUB_REPO_NAME = 'gestore-capacitor';
const CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
const STORAGE_KEY_LAST_CHECK = 'last_update_check';
const STORAGE_KEY_SKIPPED_VERSION = 'skipped_version';

export function useUpdateChecker() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const checkForUpdates = async (force: boolean = false): Promise<UpdateInfo | null> => {
    // Only check on native platforms
    if (!Capacitor.isNativePlatform()) {
      console.log('⏭️ Not on native platform - skipping update check');
      return null;
    }

    try {
      // Check if we should skip this check
      if (!force) {
        const lastCheck = localStorage.getItem(STORAGE_KEY_LAST_CHECK);
        if (lastCheck) {
          const timeSinceLastCheck = Date.now() - parseInt(lastCheck);
          if (timeSinceLastCheck < CHECK_INTERVAL) {
            console.log(`⏭️ Skipping update check - last checked ${Math.round(timeSinceLastCheck / 1000 / 60)}m ago`);
            return null;
          }
        }
      }

      setIsChecking(true);
      console.log('🔍 Checking for app updates...');

      // Get current app version
      const appInfo = await CapApp.getInfo();
      const currentVersionName = appInfo.version;
      const currentVersionCode = parseInt(appInfo.build);

      console.log(`📱 Current version: ${currentVersionName} (Build ${currentVersionCode})`);

      // Fetch latest release from GitHub
      const apiUrl = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases/latest`;
      console.log(`🌐 Fetching: ${apiUrl}`);
      
      const response = await fetch(apiUrl, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) {
        console.error(`❌ Failed to fetch release info: ${response.status} ${response.statusText}`);
        return null;
      }

      const release = await response.json();
      const tagName = release.tag_name; // e.g., "v1.0-build3" or "v1.0.0-build3"
      console.log(`🏷️ Release tag: ${tagName}`);
      console.log(`📝 Release name: ${release.name}`);

      // ✅✅✅ CRITICAL FIX: Parse BOTH formats
      // Format 1: v1.0-build3
      // Format 2: v1.0.0-build3
      const buildMatch = tagName.match(/build(\d+)/i);
      if (!buildMatch) {
        console.warn(`⚠️ Could not extract build number from tag: ${tagName}`);
        return null;
      }

      const remoteVersionCode = parseInt(buildMatch[1]);
      console.log(`🌐 Remote build: ${remoteVersionCode}`);

      // Check if skipped
      const skippedVersion = localStorage.getItem(STORAGE_KEY_SKIPPED_VERSION);
      if (skippedVersion === tagName && !force) {
        console.log(`⏭️ User previously skipped version: ${tagName}`);
        return null;
      }

      // Update last check time
      localStorage.setItem(STORAGE_KEY_LAST_CHECK, Date.now().toString());

      // ✅✅✅ CRITICAL: Compare build numbers
      console.log(`🔢 Comparing: Current build ${currentVersionCode} vs Remote build ${remoteVersionCode}`);
      
      if (remoteVersionCode > currentVersionCode) {
        console.log(`✅ UPDATE AVAILABLE! ${currentVersionCode} → ${remoteVersionCode}`);
        
        // Find APK asset
        const apkAsset = release.assets.find(
          (asset: any) => asset.name.endsWith('.apk')
        );

        if (!apkAsset) {
          console.error('❌ No APK found in release assets');
          console.log('Available assets:', release.assets.map((a: any) => a.name));
          return null;
        }

        console.log(`📦 APK found: ${apkAsset.name} (${Math.round(apkAsset.size / 1024 / 1024)}MB)`);

        const info: UpdateInfo = {
          available: true,
          currentVersion: currentVersionName,
          currentBuild: currentVersionCode.toString(),
          latestVersion: release.name,
          latestBuild: remoteVersionCode.toString(),
          downloadUrl: apkAsset.browser_download_url,
          releaseNotes: release.body || 'Nessuna nota di rilascio disponibile.',
        };

        console.log(`🚀 Update info:`, info);
        setUpdateInfo(info);
        return info;
      } else if (remoteVersionCode === currentVersionCode) {
        console.log('✅ App is up to date (same build)');
      } else {
        console.log(`🧐 Local build ${currentVersionCode} is NEWER than remote ${remoteVersionCode}`);
      }
      
      return null;
    } catch (error) {
      console.error('❌ Error checking for updates:', error);
      if (error instanceof Error) {
        console.error('❌ Error message:', error.message);
        console.error('❌ Error stack:', error.stack);
      }
      return null;
    } finally {
      setIsChecking(false);
    }
  };

  const skipVersion = () => {
    if (updateInfo) {
      const tagName = `v${updateInfo.latestVersion}-build${updateInfo.latestBuild}`;
      console.log(`⏭️ Skipping version: ${tagName}`);
      localStorage.setItem(STORAGE_KEY_SKIPPED_VERSION, tagName);
      setUpdateInfo(null);
    }
  };

  const clearSkipped = () => {
    console.log('🗑️ Clearing skipped version');
    localStorage.removeItem(STORAGE_KEY_SKIPPED_VERSION);
  };

  // Check on mount and when app comes to foreground
  useEffect(() => {
    console.log('🚀 useUpdateChecker mounted');
    
    // Initial check
    checkForUpdates();

    // Check when app comes to foreground
    const listener = CapApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        console.log('📱 App became active - checking for updates');
        checkForUpdates();
      }
    });

    return () => {
      console.log('🧹 useUpdateChecker unmounting');
      listener.then(l => l.remove());
    };
  }, []);

  return {
    updateInfo,
    isChecking,
    checkForUpdates,
    skipVersion,
    clearSkipped,
  };
}
