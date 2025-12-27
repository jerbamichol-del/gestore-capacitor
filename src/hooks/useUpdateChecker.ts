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
      return null;
    }

    try {
      // Check if we should skip this check
      if (!force) {
        const lastCheck = localStorage.getItem(STORAGE_KEY_LAST_CHECK);
        if (lastCheck) {
          const timeSinceLastCheck = Date.now() - parseInt(lastCheck);
          if (timeSinceLastCheck < CHECK_INTERVAL) {
            console.log('Skipping update check - checked recently');
            return null;
          }
        }
      }

      setIsChecking(true);

      // Get current app version
      const appInfo = await CapApp.getInfo();
      const currentVersionName = appInfo.version;
      const currentVersionCode = parseInt(appInfo.build);

      console.log(`Current version: ${currentVersionName} (Build ${currentVersionCode})`);

      // Fetch latest release from GitHub
      const response = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases/latest`,
        {
          headers: {
            'Accept': 'application/vnd.github.v3+json',
          },
        }
      );

      if (!response.ok) {
        console.error('Failed to fetch release info:', response.status);
        return null;
      }

      const release = await response.json();
      const tagName = release.tag_name; // e.g., "v1.0-build3"

      // Extract version code from tag
      const buildMatch = tagName.match(/build(\d+)/i);
      if (!buildMatch) {
        console.log('Could not extract build number from tag:', tagName);
        return null;
      }

      const remoteVersionCode = parseInt(buildMatch[1]);
      console.log(`Remote version: ${release.name} (Build ${remoteVersionCode})`);

      // Check if skipped
      const skippedVersion = localStorage.getItem(STORAGE_KEY_SKIPPED_VERSION);
      if (skippedVersion === tagName && !force) {
        console.log('User skipped this version');
        return null;
      }

      // Update last check time
      localStorage.setItem(STORAGE_KEY_LAST_CHECK, Date.now().toString());

      // Check if update available
      if (remoteVersionCode > currentVersionCode) {
        // Find APK asset
        const apkAsset = release.assets.find(
          (asset: any) => asset.name.endsWith('.apk')
        );

        if (!apkAsset) {
          console.error('No APK found in release');
          return null;
        }

        const info: UpdateInfo = {
          available: true,
          currentVersion: currentVersionName,
          currentBuild: currentVersionCode.toString(),
          latestVersion: release.name,
          latestBuild: remoteVersionCode.toString(),
          downloadUrl: apkAsset.browser_download_url,
          releaseNotes: release.body || 'Nessuna nota di rilascio disponibile.',
        };

        console.log('Update available:', info);
        setUpdateInfo(info);
        return info;
      } else {
        console.log('App is up to date');
        return null;
      }
    } catch (error) {
      console.error('Error checking for updates:', error);
      return null;
    } finally {
      setIsChecking(false);
    }
  };

  const skipVersion = () => {
    if (updateInfo) {
      const tagName = `v${updateInfo.latestVersion}-build${updateInfo.latestBuild}`;
      localStorage.setItem(STORAGE_KEY_SKIPPED_VERSION, tagName);
      setUpdateInfo(null);
    }
  };

  const clearSkipped = () => {
    localStorage.removeItem(STORAGE_KEY_SKIPPED_VERSION);
  };

  // Check on mount and when app comes to foreground
  useEffect(() => {
    // Initial check
    checkForUpdates();

    // Check when app comes to foreground
    const listener = CapApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        checkForUpdates();
      }
    });

    return () => {
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
