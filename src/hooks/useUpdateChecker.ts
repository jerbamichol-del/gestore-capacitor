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
  latestTagName?: string; // exact GitHub release tag_name
  downloadUrl: string;
  releaseNotes: string;
}

interface CachedUpdateInfo {
  tagName: string;
  latestVersion: string;
  latestBuild: number;
  downloadUrl: string;
  releaseNotes: string;
  cachedAt: number;
}

const GITHUB_REPO_OWNER = 'jerbamichol-del';
const GITHUB_REPO_NAME = 'gestore-capacitor';

// Re-check often enough to catch new releases quickly, but not on every foreground event.
const CHECK_INTERVAL = 15 * 60 * 1000; // 15 minutes

const STORAGE_KEY_LAST_CHECK = 'last_update_check';
const STORAGE_KEY_SKIPPED_VERSION = 'skipped_version';
const STORAGE_KEY_CACHED_UPDATE = 'cached_update_info';

function safeParseInt(value: string | null, fallback: number = 0) {
  const n = value ? parseInt(value, 10) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function readCachedUpdate(): CachedUpdateInfo | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CACHED_UPDATE);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedUpdateInfo;
    if (!parsed || !parsed.tagName || !parsed.latestBuild || !parsed.downloadUrl) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCachedUpdate(update: CachedUpdateInfo) {
  try {
    localStorage.setItem(STORAGE_KEY_CACHED_UPDATE, JSON.stringify(update));
  } catch {
    // ignore storage errors
  }
}

export function useUpdateChecker() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const checkForUpdates = async (force: boolean = false): Promise<UpdateInfo | null> => {
    // Only check on native platforms
    if (!Capacitor.isNativePlatform()) {
      console.log('⏭️ Not on native platform - skipping update check');
      return null;
    }

    // Get current app version early (needed also for cached logic)
    const appInfo = await CapApp.getInfo();
    const currentVersionName = appInfo.version;
    const currentVersionCode = safeParseInt(appInfo.build, 0);

    console.log(`📱 Current version: ${currentVersionName} (Build ${currentVersionCode})`);

    // If we recently checked, do NOT hit the network again.
    // But if we already know (cached) that a newer build exists, show it immediately.
    if (!force) {
      const lastCheck = localStorage.getItem(STORAGE_KEY_LAST_CHECK);
      if (lastCheck) {
        const timeSinceLastCheck = Date.now() - safeParseInt(lastCheck, 0);
        if (timeSinceLastCheck < CHECK_INTERVAL) {
          const cached = readCachedUpdate();
          const skippedTag = localStorage.getItem(STORAGE_KEY_SKIPPED_VERSION);

          if (cached && cached.latestBuild > currentVersionCode && skippedTag !== cached.tagName) {
            const info: UpdateInfo = {
              available: true,
              currentVersion: currentVersionName,
              currentBuild: currentVersionCode.toString(),
              latestVersion: cached.latestVersion,
              latestBuild: cached.latestBuild.toString(),
              latestTagName: cached.tagName,
              downloadUrl: cached.downloadUrl,
              releaseNotes: cached.releaseNotes || 'Nessuna nota di rilascio disponibile.',
            };

            setUpdateInfo(info);
            console.log('✅ Using cached update info (within interval).');
            return info;
          }

          console.log(`⏭️ Skipping network update check - last checked ${Math.round(timeSinceLastCheck / 1000 / 60)}m ago`);
          return null;
        }
      }
    }

    try {
      setIsChecking(true);
      console.log('🔍 Checking for app updates...');

      // Fetch latest release from GitHub
      const apiUrl = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases/latest`;
      console.log(`🌐 Fetching: ${apiUrl}`);

      const response = await fetch(apiUrl, {
        headers: {
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) {
        console.error(`❌ Failed to fetch release info: ${response.status} ${response.statusText}`);
        return null;
      }

      const release = await response.json();
      const tagName: string = release.tag_name; // expected: v<versionName>-build<code>
      console.log(`🏷️ Release tag: ${tagName}`);
      console.log(`📝 Release name: ${release.name}`);

      const buildMatch = typeof tagName === 'string' ? tagName.match(/build(\d+)/i) : null;
      if (!buildMatch) {
        console.warn(`⚠️ Could not extract build number from tag: ${tagName}`);
        return null;
      }

      const remoteVersionCode = safeParseInt(buildMatch[1], 0);
      console.log(`🌐 Remote build: ${remoteVersionCode}`);

      // Update last check time (network check completed successfully)
      localStorage.setItem(STORAGE_KEY_LAST_CHECK, Date.now().toString());

      // Check if skipped
      const skippedVersion = localStorage.getItem(STORAGE_KEY_SKIPPED_VERSION);
      if (skippedVersion === tagName && !force) {
        console.log(`⏭️ User previously skipped version: ${tagName}`);
        return null;
      }

      // Compare build numbers
      console.log(`🔢 Comparing: Current build ${currentVersionCode} vs Remote build ${remoteVersionCode}`);

      if (remoteVersionCode > currentVersionCode) {
        console.log(`✅ UPDATE AVAILABLE! ${currentVersionCode} → ${remoteVersionCode}`);

        const apkAsset = release.assets?.find((asset: any) => typeof asset?.name === 'string' && asset.name.endsWith('.apk'));
        if (!apkAsset) {
          console.error('❌ No APK found in release assets');
          console.log('Available assets:', (release.assets || []).map((a: any) => a?.name));
          return null;
        }

        const info: UpdateInfo = {
          available: true,
          currentVersion: currentVersionName,
          currentBuild: currentVersionCode.toString(),
          latestVersion: release.name,
          latestBuild: remoteVersionCode.toString(),
          latestTagName: tagName,
          downloadUrl: apkAsset.browser_download_url,
          releaseNotes: release.body || 'Nessuna nota di rilascio disponibile.',
        };

        // Cache it so the modal can appear immediately even if the user reopens the app within the interval.
        writeCachedUpdate({
          tagName,
          latestVersion: release.name,
          latestBuild: remoteVersionCode,
          downloadUrl: apkAsset.browser_download_url,
          releaseNotes: release.body || '',
          cachedAt: Date.now(),
        });

        setUpdateInfo(info);
        return info;
      }

      // If no update, clear stale cached update (optional but prevents old cached popups)
      const cached = readCachedUpdate();
      if (cached && cached.latestBuild <= currentVersionCode) {
        try {
          localStorage.removeItem(STORAGE_KEY_CACHED_UPDATE);
        } catch {
          // ignore
        }
      }

      console.log('✅ App is up to date');
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
      const tagToSkip = updateInfo.latestTagName;
      if (tagToSkip) {
        console.log(`⏭️ Skipping version: ${tagToSkip}`);
        localStorage.setItem(STORAGE_KEY_SKIPPED_VERSION, tagToSkip);
      } else {
        console.log('⚠️ skipVersion called but latestTagName is missing');
      }
      setUpdateInfo(null);
    }
  };

  const clearSkipped = () => {
    console.log('🗑️ Clearing skipped version');
    localStorage.removeItem(STORAGE_KEY_SKIPPED_VERSION);
  };

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
      listener.then((l) => l.remove());
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
