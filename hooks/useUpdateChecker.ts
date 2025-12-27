import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';

export interface UpdateInfo {
  available: boolean;
  currentVersion: string;
  currentBuild?: string;
  latestVersion?: string;
  latestBuild?: string;
  downloadUrl?: string;
  releaseNotes?: string;
}

const GITHUB_REPO_OWNER = 'jerbamichol-del';
const GITHUB_REPO_NAME = 'gestore-capacitor';
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Hook to check for app updates from GitHub Releases
 * Only works on native Android platform
 * 
 * ✅ FIXED: Now correctly parses tags like "v1.0-build2" and "v1.0-build3"
 * ✅ FIXED: Added skipVersion() function to skip specific build versions
 */
export const useUpdateChecker = () => {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo>({
    available: false,
    currentVersion: '1.0',
    currentBuild: '3',
  });
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkForUpdates = async (force = false): Promise<UpdateInfo> => {
    // Only check on Android native
    if (Capacitor.getPlatform() !== 'android') {
      console.log('Update check skipped: not on Android');
      return { available: false, currentVersion: 'web' };
    }

    // Check cache unless forced
    if (!force) {
      const lastCheck = localStorage.getItem('last_update_check');
      if (lastCheck) {
        const elapsed = Date.now() - parseInt(lastCheck, 10);
        if (elapsed < CHECK_INTERVAL_MS) {
          console.log('Update check skipped: checked recently');
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
      const currentVersionCode = parseInt(appInfo.build, 10); // e.g., 3
      const currentVersionName = appInfo.version; // e.g., "1.0"

      console.log(`Current app: v${currentVersionName} (Build ${currentVersionCode})`);

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
          console.log('No releases found on GitHub');
          // No releases yet
          const info: UpdateInfo = {
            available: false,
            currentVersion: currentVersionName,
            currentBuild: currentVersionCode.toString(),
          };
          setUpdateInfo(info);
          return info;
        }
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const release = await response.json();
      const tagName = release.tag_name || ''; // e.g., "v1.0-build3"
      console.log(`Latest release tag: ${tagName}`);

      // ✅ CRITICAL FIX: Extract build number from tags like "v1.0-build2" or "v1.0-build3"
      const buildMatch = tagName.match(/build(\d+)/i);
      
      if (!buildMatch) {
        console.log(`Could not extract build number from tag: ${tagName}`);
        // Can't parse, assume no update
        const info: UpdateInfo = {
          available: false,
          currentVersion: currentVersionName,
          currentBuild: currentVersionCode.toString(),
        };
        setUpdateInfo(info);
        return info;
      }

      const remoteBuildNumber = parseInt(buildMatch[1], 10);
      console.log(`Remote build number: ${remoteBuildNumber}`);

      // ✅ CHECK IF USER SKIPPED THIS VERSION
      const skippedVersion = localStorage.getItem('skipped_update_version');
      if (skippedVersion && parseInt(skippedVersion, 10) === remoteBuildNumber) {
        console.log(`User previously skipped build ${remoteBuildNumber}`);
        const info: UpdateInfo = {
          available: false,
          currentVersion: currentVersionName,
          currentBuild: currentVersionCode.toString(),
          latestVersion: release.name || tagName,
          latestBuild: remoteBuildNumber.toString(),
        };
        setUpdateInfo(info);
        return info;
      }

      // Find APK asset
      const apkAsset = release.assets?.find(
        (asset: any) => asset.name.endsWith('.apk')
      );

      if (!apkAsset) {
        console.log('No APK found in release');
      }

      // ✅ Compare build numbers directly
      const updateAvailable = remoteBuildNumber > currentVersionCode;
      console.log(`Update available: ${updateAvailable} (${remoteBuildNumber} > ${currentVersionCode})`);

      const info: UpdateInfo = {
        available: updateAvailable,
        currentVersion: currentVersionName,
        currentBuild: currentVersionCode.toString(),
        latestVersion: release.name || tagName,
        latestBuild: remoteBuildNumber.toString(),
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
        currentBuild: updateInfo.currentBuild,
      };
      return info;
    } finally {
      setIsChecking(false);
    }
  };

  // ✅ NEW: Function to skip a specific version
  const skipVersion = () => {
    if (updateInfo.latestBuild) {
      console.log(`⏭️ Skipping update to build ${updateInfo.latestBuild}`);
      localStorage.setItem('skipped_update_version', updateInfo.latestBuild);
      // Mark as not available
      setUpdateInfo(prev => ({ ...prev, available: false }));
    }
  };

  // Check on mount and when app comes to foreground
  useEffect(() => {
    // Initial check on mount
    checkForUpdates();

    // Listen for app state changes
    let listener: any;
    
    const setupListener = async () => {
      listener = await CapApp.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          console.log('App became active, checking for updates...');
          checkForUpdates();
        }
      });
    };

    setupListener();

    // Cleanup
    return () => {
      if (listener) {
        listener.remove();
      }
    };
  }, []);

  return {
    updateInfo,
    isChecking,
    error,
    checkForUpdates,
    skipVersion, // ✅ NOW EXPORTED!
  };
};
