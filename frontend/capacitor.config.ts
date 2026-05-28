/// <reference types="@capacitor/status-bar" />
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.erpm.medical.lms',
  appName: 'ERPM Medical LMS',
  webDir: 'dist-capacitor',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'http',
  },
  ios: {
    contentInset: 'never',
    backgroundColor: '#111a23',
  },
  android: {
    backgroundColor: '#0b121b',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 0,
      backgroundColor: '#0b121b',
    },
    StatusBar: {
      overlaysWebView: true,
      style: 'DARK',
      backgroundColor: '#111a23',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
