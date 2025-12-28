import { registerPlugin } from '@capacitor/core';

export interface AppUpdatePlugin {
  /**
   * Download and install APK update using Android DownloadManager
   * Shows notification with progress and auto-installs when complete
   */
  downloadAndInstall(options: {
    url: string;
    fileName?: string;
    title?: string;
    description?: string;
  }): Promise<{ downloadId: number; status: string }>;

  /**
   * Get download progress for a specific download ID
   */
  getDownloadProgress(options: {
    downloadId: number;
  }): Promise<{
    progress: number;
    bytesDownloaded: number;
    bytesTotal: number;
    status: string;
  }>;
}

const AppUpdate = registerPlugin<AppUpdatePlugin>('AppUpdate', {
  web: () => import('./app-update-web').then(m => new m.AppUpdateWeb()),
});

export default AppUpdate;
