import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.stylesaathi.app',
  appName: 'StyleSaathi',
  webDir: 'dist',
  backgroundColor: '#F7F2E9',
  android: {
    backgroundColor: '#F7F2E9',
    allowMixedContent: false,
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;
