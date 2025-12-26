import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';

export interface UpdateInfo {
  available: boolean;
  currentVersion: string;
  latestVersion?: string;
  downloadUrl?: string;
  releaseNotes?: string;
}

const GITHUB_REPO_OWNER = 'jerbamichol-del';
const GITHUB_REPO_NAME = 'gestore-capacitor';
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Hook to check for app updates from GitHub Releases
 * Only works on native Android platform
 */
export const useUpdateChecker = () => {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo>({
    available: false,
    currentVersion: '1.0.1', // Fallback if native info fails
  });
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkForUpdates = async (force = false): Promise<UpdateInfo> => {
    // Only check on Android native
    if (Capacitor.getPlatform() !== 'android') {
      return { available: false, currentVersion: 'web' };
    }

    // Check cache unless forced
    if (!force) {
      const lastCheck = localStorage.getItem('last_update_check');
      if (lastCheck) {
        const elapsed = Date.now() - parseInt(lastCheck, 10);
        if (elapsed < CHECK_INTERVAL_MS) {
          // Return cached result
          const cached = localStorage.getItem('cached_update_info');
          if (cached) {
            try {
              const info = JSON.parse(cached) as UpdateInfo;
              setUpdateInfo(info);
              return info;
            } catch (e) {
              // Invalid cache, continue to check
            }
          }
        }
      }
    }

    setIsChecking(true);
    setError(null);

    try {
      // Get current app version from native
      const appInfo = await CapApp.getInfo();
      const currentVersionCode = parseInt(appInfo.build, 10) || 2; // versionCode
      const currentVersionName = appInfo.version || '1.0.1'; // versionName

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
        if (response.status === 404) {
          // No releases yet
          const info: UpdateInfo = {
            available: false,
            currentVersion: currentVersionName,
          };
          setUpdateInfo(info);
          return info;
        }
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const release = await response.json();

      // Extract version code from tag (e.g., v1.0.2 or v2)
      const tagName = release.tag_name || '';
      const versionMatch = tagName.match(/v?(\d+)\.(\d+)\.(\d+)/);
      
      let remoteVersionCode = currentVersionCode;
      if (versionMatch) {
        // Convert semantic version to code (major * 1000 + minor * 100 + patch)
        const [, major, minor, patch] = versionMatch;
        remoteVersionCode = parseInt(major) * 1000 + parseInt(minor) * 100 + parseInt(patch);
      } else {
        // Try to extract simple number
        const simpleMatch = tagName.match(/v?(\d+)/);
        if (simpleMatch) {
          remoteVersionCode = parseInt(simpleMatch[1], 10);
        }
      }

      // Find APK asset
      const apkAsset = release.assets?.find(
        (asset: any) => asset.name.endsWith('.apk')
      );

      const updateAvailable = remoteVersionCode > currentVersionCode;

      const info: UpdateInfo = {
        available: updateAvailable,
        currentVersion: currentVersionName,
        latestVersion: release.name || tagName,
        downloadUrl: apkAsset?.browser_download_url,
        releaseNotes: release.body,
      };

      setUpdateInfo(info);

      // Cache result
      localStorage.setItem('last_update_check', Date.now().toString());
      localStorage.setItem('cached_update_info', JSON.stringify(info));

      return info;
    } catch (err) {
      console.error('Update check failed:', err);
      const errorMsg = err instanceof Error ? err.message : 'Network error';
      setError(errorMsg);

      // Return current state on error
      const info: UpdateInfo = {
        available: false,
        currentVersion: updateInfo.currentVersion,
      };
      return info;
    } finally {
      setIsChecking(false);
    }
  };

  // Check on mount
  useEffect(() => {
    checkForUpdates();
  }, []);

  return {
    updateInfo,
    isChecking,
    error,
    checkForUpdates,
  };
};
