import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gestore.spese',
  appName: 'Gestore Spese',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    // CRITICAL: Assicurati che il plugin injector funzioni
    cleartext: true
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
    },
    // ✅ AGGIUNTI I NOSTRI PLUGIN CUSTOM
    NotificationListener: {},
    SMSReader: {}
  },
  // ✅ CRITICAL: Includi i plugin esterni (locale)
  includePlugins: ['NotificationListener', 'SMSReader']
};

export default config;
