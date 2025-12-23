import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gestore.spese',
  appName: 'Gestore Spese',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0
    },
    Camera: {
      permissions: ['camera', 'photos']
    },
    NativeBiometric: {
      useFallback: true
    }
  }
};

export default config;
