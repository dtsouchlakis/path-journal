import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pathjournal.app',
  appName: 'Path',
  webDir: 'dist',
  server: { androidScheme: 'https' },
};

export default config;
