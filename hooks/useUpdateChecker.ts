import { useState, useEffect } from 'react';
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

  const checkForUpdates = async (force = false): Promise<UpdateInfo> => {
    // Only check on Android native
    if (Capacitor.getPlatform() !== 'android') {
      const info: UpdateInfo = { available: false, currentVersion: 'web' };
      setUpdateInfo(info);
      return info;
    }

    // Get current app version early (needed also for cached logic)
    const appInfo = await CapApp.getInfo();
    const currentVersionName = appInfo.version;
    const currentVersionCode = safeParseInt(appInfo.build, 0);

    // Within interval: avoid network, BUT if cached says a newer build exists, show it immediately.
    if (!force) {
      const lastCheck = localStorage.getItem(STORAGE_KEY_LAST_CHECK);
      if (lastCheck) {
        const elapsed = Date.now() - safeParseInt(lastCheck, 0);
        if (elapsed < CHECK_INTERVAL_MS) {
          const cachedRaw = readCachedUpdateRaw();
          const skippedTag = localStorage.getItem(STORAGE_KEY_SKIPPED_TAG);
          const skippedBuild = localStorage.getItem(STORAGE_KEY_SKIPPED_BUILD);

          // Old cache format: UpdateInfo-like
          if (cachedRaw && typeof cachedRaw === 'object' && typeof cachedRaw.available === 'boolean') {
            const cached = cachedRaw as UpdateInfo;
            const cachedLatestBuild = safeParseInt(cached.latestBuild, 0);

            if (
              cachedLatestBuild > currentVersionCode &&
              (!cached.latestTagName || cached.latestTagName !== skippedTag) &&
              (!cached.latestBuild || cached.latestBuild !== skippedBuild)
            ) {
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
              clearCachedUpdateInfo();
            }
          }

          // Return minimal info (no network)
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
      const response = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases/latest`,
        { headers: { Accept: 'application/vnd.github.v3+json' } }
      );

      if (!response.ok) {
        // No releases yet (404) => treat as up-to-date
        if (response.status === 404) {
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

      const buildMatch = tagName.match(/build(\d+)/i);
      if (!buildMatch) {
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

      // Check skip (tag-based, and legacy build-based)
      const skippedTag = localStorage.getItem(STORAGE_KEY_SKIPPED_TAG);
      const skippedBuild = localStorage.getItem(STORAGE_KEY_SKIPPED_BUILD);
      if ((skippedTag && skippedTag === tagName) || (skippedBuild && safeParseInt(skippedBuild, -1) === remoteBuildNumber)) {
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

      setUpdateInfo(info);
      writeCachedUpdateInfo(info);
      localStorage.setItem(STORAGE_KEY_LAST_CHECK, Date.now().toString());

      // If user already updated, clear stale cache
      if (!updateAvailable) {
        clearCachedUpdateInfo();
      }

      return info;
    } catch (err) {
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
  };

  const skipVersion = () => {
    // Prefer skipping by tagName (stable), but also store legacy build key.
    const tagToSkip = updateInfo.latestTagName;
    const buildToSkip = updateInfo.latestBuild;

    if (tagToSkip) {
      localStorage.setItem(STORAGE_KEY_SKIPPED_TAG, tagToSkip);
    }
    if (buildToSkip) {
      localStorage.setItem(STORAGE_KEY_SKIPPED_BUILD, buildToSkip);
    }

    setUpdateInfo(prev => ({ ...prev, available: false }));
  };

  const clearSkipped = () => {
    localStorage.removeItem(STORAGE_KEY_SKIPPED_TAG);
    localStorage.removeItem(STORAGE_KEY_SKIPPED_BUILD);
  };

  useEffect(() => {
    checkForUpdates();

    let listener: any;

    const setupListener = async () => {
      listener = await CapApp.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          checkForUpdates();
        }
      });
    };

    setupListener();

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
    skipVersion,
    clearSkipped,
  };
};
