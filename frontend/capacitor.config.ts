import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.erpm.medical.lms',
  appName: 'ERPM Medical LMS',
  webDir: 'dist-capacitor',
  bundledWebRuntime: false,
  ios: {
    contentInset: 'never',
    backgroundColor: '#05070d',
  },
  android: {
    backgroundColor: '#05070d',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 0,
      backgroundColor: '#05070d',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
