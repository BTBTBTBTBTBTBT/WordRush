import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.wordocious.app',
  appName: 'Wordocious',
  webDir: 'public',
  server: {
    url: 'https://wordocious.com',
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#f8f7ff',
    },
    StatusBar: {
      style: 'dark' as any,
    },
    Keyboard: {
      resize: 'body' as any,
    },
  },
  ios: {
    contentInset: 'automatic',
    allowsLinkPreview: false,
    scheme: 'Wordocious',
  },
  android: {
    backgroundColor: '#f8f7ff',
  },
};

export default config;
