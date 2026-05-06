import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'com.iturut.voicenoteapp',
  appName: 'iTurut',
  webDir: 'build',
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
    hostname: 'localhost'
  }
};
export default config;