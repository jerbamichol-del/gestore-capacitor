import { WebPlugin } from '@capacitor/core';
import type { AppUpdatePlugin } from './app-update';

export class AppUpdateWeb extends WebPlugin implements AppUpdatePlugin {
  async downloadAndInstall(): Promise<{ downloadId: number; status: string }> {
    throw this.unimplemented('Not implemented on web.');
  }

  async getDownloadProgress(): Promise<{
    progress: number;
    bytesDownloaded: number;
    bytesTotal: number;
    status: string;
  }> {
    throw this.unimplemented('Not implemented on web.');
  }
}
