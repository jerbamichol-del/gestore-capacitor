import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';

export interface UpdateInfo {
  available: boolean;
  currentVersion: string;
  currentBuild?: string;
  latestVersion?: string;
  latestBuild?: string;
  latestTagName?: string;
  downloadUrl?: string;
  releaseNotes?: string;
}

const GITHUB_REPO_OWNER = 'jerbamichol-del';
const GITHUB_REPO_NAME = 'gestore-capacitor';

// Re-check often enough to catch new releases quickly, but not on every foreground event.
const CHECK_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

const STORAGE_KEY_LAST_CHECK = 'last_update_check';
const STORAGE_KEY_CACHED_UPDATE = 'cached_update_info';

// New (tag-based) skip key
const STORAGE_KEY_SKIPPED_TAG = 'skipped_version';
// Legacy (build-number) skip key used by old code
const STORAGE_KEY_SKIPPED_BUILD = 'skipped_update_version';

function safeParseInt(value: string | null | undefined, fallback: number = 0) {
  const n = typeof value === 'string' ? parseInt(value, 10) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function readCachedUpdateRaw(): any | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CACHED_UPDATE);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeCachedUpdateInfo(info: UpdateInfo) {
  try {
    localStorage.setItem(STORAGE_KEY_CACHED_UPDATE, JSON.stringify(info));
  } catch {
    // ignore
  }
}

function clearCachedUpdateInfo() {
  try {
    localStorage.removeItem(STORAGE_KEY_CACHED_UPDATE);
  } catch {
    // ignore
  }
}

export const useUpdateChecker = () => {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo>({
    available: false,
    currentVersion: 'unknown',
    currentBuild: '0',
  });
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkForUpdates = useCallback(async (force = false): Promise<UpdateInfo> => {
    console.log('🚀 useUpdateChecker - checkForUpdates called', { force });

    // Only check on Android native
    if (Capacitor.getPlatform() !== 'android') {
      console.log('⏭️ Not on Android - skipping update check');
      const info: UpdateInfo = { available: false, currentVersion: 'web' };
      setUpdateInfo(info);
      return info;
    }

    // Get current app version early (needed also for cached logic)
    const appInfo = await CapApp.getInfo();
    const currentVersionName = appInfo.version;
    const currentVersionCode = safeParseInt(appInfo.build, 0);

    console.log(`📱 Current version: ${currentVersionName} (Build ${currentVersionCode})`);

    // Within interval: avoid network, BUT if cached says a newer build exists, show it immediately.
    if (!force) {
      const lastCheck = localStorage.getItem(STORAGE_KEY_LAST_CHECK);
      if (lastCheck) {
        const elapsed = Date.now() - safeParseInt(lastCheck, 0);
        if (elapsed < CHECK_INTERVAL_MS) {
          console.log(`⏱️ Within check interval (${Math.round(elapsed / 1000 / 60)}m ago) - checking cache`);
          const cachedRaw = readCachedUpdateRaw();
          const skippedTag = localStorage.getItem(STORAGE_KEY_SKIPPED_TAG);
          const skippedBuild = localStorage.getItem(STORAGE_KEY_SKIPPED_BUILD);

          // Old cache format: UpdateInfo-like
          if (cachedRaw && typeof cachedRaw === 'object' && typeof cachedRaw.available === 'boolean') {
            const cached = cachedRaw as UpdateInfo;
            const cachedLatestBuild = safeParseInt(cached.latestBuild, 0);

            console.log(`💾 Cache: latest build ${cachedLatestBuild}, skipped tag: ${skippedTag}, skipped build: ${skippedBuild}`);

            if (
              cachedLatestBuild > currentVersionCode &&
              (!cached.latestTagName || cached.latestTagName !== skippedTag) &&
              (!cached.latestBuild || cached.latestBuild !== skippedBuild)
            ) {
              console.log(`✅ Cache shows update available: ${currentVersionCode} → ${cachedLatestBuild}`);
              const info: UpdateInfo = {
                ...cached,
                available: true,
                currentVersion: currentVersionName,
                currentBuild: currentVersionCode.toString(),
              };
              setUpdateInfo(info);
              return info;
            }

            // If cached is stale (user updated), clear it.
            if (cachedLatestBuild <= currentVersionCode) {
              console.log(`🗑️ Clearing stale cache (cached ${cachedLatestBuild} <= current ${currentVersionCode})`);
              clearCachedUpdateInfo();
            }
          }

          // Return minimal info (no network)
          console.log('⏭️ No cached update - skipping network check');
          const info: UpdateInfo = {
            available: false,
            currentVersion: currentVersionName,
            currentBuild: currentVersionCode.toString(),
          };
          setUpdateInfo(info);
          return info;
        }
      }
    }

    setIsChecking(true);
    setError(null);

    try {
      console.log('🔍 Checking for app updates from GitHub...');
      const response = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases/latest`,
        { headers: { Accept: 'application/vnd.github.v3+json' } }
      );

      if (!response.ok) {
        // No releases yet (404) => treat as up-to-date
        if (response.status === 404) {
          console.log('⚠️ No releases found (404)');
          const info: UpdateInfo = {
            available: false,
            currentVersion: currentVersionName,
            currentBuild: currentVersionCode.toString(),
          };
          setUpdateInfo(info);
          writeCachedUpdateInfo(info);
          localStorage.setItem(STORAGE_KEY_LAST_CHECK, Date.now().toString());
          return info;
        }
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const release = await response.json();
      const tagName: string = release.tag_name || '';
      console.log(`🏷️ Latest release: ${tagName}`);

      const buildMatch = tagName.match(/build(\d+)/i);
      if (!buildMatch) {
        console.log(`⚠️ Could not extract build number from tag: ${tagName}`);
        const info: UpdateInfo = {
          available: false,
          currentVersion: currentVersionName,
          currentBuild: currentVersionCode.toString(),
          latestVersion: release.name || tagName,
          latestTagName: tagName,
        };
        setUpdateInfo(info);
        writeCachedUpdateInfo(info);
        localStorage.setItem(STORAGE_KEY_LAST_CHECK, Date.now().toString());
        return info;
      }

      const remoteBuildNumber = safeParseInt(buildMatch[1], 0);
      console.log(`🌐 Remote build: ${remoteBuildNumber}`);

      // Check skip (tag-based, and legacy build-based)
      const skippedTag = localStorage.getItem(STORAGE_KEY_SKIPPED_TAG);
      const skippedBuild = localStorage.getItem(STORAGE_KEY_SKIPPED_BUILD);
      if ((skippedTag && skippedTag === tagName) || (skippedBuild && safeParseInt(skippedBuild, -1) === remoteBuildNumber)) {
        console.log(`⏭️ User skipped this version: ${tagName}`);
        const info: UpdateInfo = {
          available: false,
          currentVersion: currentVersionName,
          currentBuild: currentVersionCode.toString(),
          latestVersion: release.name || tagName,
          latestBuild: remoteBuildNumber.toString(),
          latestTagName: tagName,
        };
        setUpdateInfo(info);
        writeCachedUpdateInfo(info);
        localStorage.setItem(STORAGE_KEY_LAST_CHECK, Date.now().toString());
        return info;
      }

      const apkAsset = release.assets?.find((asset: any) => typeof asset?.name === 'string' && asset.name.endsWith('.apk'));

      const updateAvailable = remoteBuildNumber > currentVersionCode;
      console.log(`🔢 Comparing: ${currentVersionCode} vs ${remoteBuildNumber} → Update available: ${updateAvailable}`);

      const info: UpdateInfo = {
        available: updateAvailable,
        currentVersion: currentVersionName,
        currentBuild: currentVersionCode.toString(),
        latestVersion: release.name || tagName,
        latestBuild: remoteBuildNumber.toString(),
        latestTagName: tagName,
        downloadUrl: apkAsset?.browser_download_url,
        releaseNotes: release.body,
      };

      if (updateAvailable) {
        console.log(`✅ UPDATE AVAILABLE! ${currentVersionCode} → ${remoteBuildNumber}`);
      } else {
        console.log(`✅ App is up to date`);
      }

      setUpdateInfo(info);
      writeCachedUpdateInfo(info);
      localStorage.setItem(STORAGE_KEY_LAST_CHECK, Date.now().toString());

      // If user already updated, clear stale cache
      if (!updateAvailable) {
        clearCachedUpdateInfo();
      }

      return info;
    } catch (err) {
      console.error('❌ Error checking for updates:', err);
      const errorMsg = err instanceof Error ? err.message : 'Network error';
      setError(errorMsg);

      const info: UpdateInfo = {
        available: false,
        currentVersion: currentVersionName,
        currentBuild: currentVersionCode.toString(),
      };
      setUpdateInfo(info);
      return info;
    } finally {
      setIsChecking(false);
    }
  }, []); // Empty deps: checkForUpdates is stable

  const skipVersion = useCallback(() => {
    console.log('⏭️ skipVersion called', updateInfo);
    // Prefer skipping by tagName (stable), but also store legacy build key.
    const tagToSkip = updateInfo.latestTagName;
    const buildToSkip = updateInfo.latestBuild;

    if (tagToSkip) {
      console.log(`💾 Skipping tag: ${tagToSkip}`);
      localStorage.setItem(STORAGE_KEY_SKIPPED_TAG, tagToSkip);
    }
    if (buildToSkip) {
      console.log(`💾 Skipping build: ${buildToSkip}`);
      localStorage.setItem(STORAGE_KEY_SKIPPED_BUILD, buildToSkip);
    }

    setUpdateInfo(prev => ({ ...prev, available: false }));
  }, [updateInfo]);

  const clearSkipped = useCallback(() => {
    console.log('🗑️ Clearing skipped versions');
    localStorage.removeItem(STORAGE_KEY_SKIPPED_TAG);
    localStorage.removeItem(STORAGE_KEY_SKIPPED_BUILD);
  }, []);

  useEffect(() => {
    console.log('🚀 useUpdateChecker mounted - starting initial check');
    checkForUpdates();

    let listener: any;

    const setupListener = async () => {
      listener = await CapApp.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          console.log('📱 App became active - checking for updates');
          checkForUpdates();
        }
      });
    };

    setupListener();

    return () => {
      console.log('🧹 useUpdateChecker unmounting');
      if (listener) {
        listener.remove();
      }
    };
  }, [checkForUpdates]);

  return {
    updateInfo,
    isChecking,
    error,
    checkForUpdates,
    skipVersion,
    clearSkipped,
  };
};
