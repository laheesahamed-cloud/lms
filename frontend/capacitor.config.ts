/// <reference types="@capacitor/status-bar" />
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize } from '@capacitor/keyboard';

function readEnvValue(name: string) {
  const directValue = process.env[name];
  if (directValue) return directValue;

  const envFiles = ['.env.capacitor.local', '.env.capacitor'];
  const envDirs = Array.from(new Set([process.cwd(), resolve(process.cwd(), 'frontend')]));

  for (const dir of envDirs) {
    for (const file of envFiles) {
      const filePath = resolve(dir, file);
      if (!existsSync(filePath)) continue;

      const line = readFileSync(filePath, 'utf8')
        .split(/\r?\n/)
        .find((line) => line.trim().startsWith(`${name}=`));
      if (line) return line.slice(line.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '');
    }
  }

  return '';
}

const nativeApiBaseUrl = readEnvValue('VITE_API_BASE_URL');
const androidScheme = nativeApiBaseUrl.startsWith('http://') ? 'http' : 'https';
const capacitorPlatform = process.env.LMS_CAPACITOR_PLATFORM || '';
const configuredAndroidHostname = readEnvValue('VITE_CAPACITOR_ANDROID_HOSTNAME');
const androidHostname = capacitorPlatform === 'android' ? configuredAndroidHostname || '' : '';

const config: CapacitorConfig = {
  appId: 'com.erpm.medical.lms',
  appName: 'xyndrome',
  webDir: 'dist-capacitor',
  bundledWebRuntime: false,
  server: {
    androidScheme,
    ...(androidHostname ? { hostname: androidHostname } : {}),
  },
  ios: {
    contentInset: 'never',
    backgroundColor: '#0b121b',
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
      backgroundColor: '#0b121b',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    Keyboard: {
      // Overlay the keyboard instead of resizing/pushing the WebView. The web
      // layout adds its own scroll room (--lms-keyboard-height) so content
      // behind the keyboard stays reachable by manual scroll.
      resize: KeyboardResize.None,
    },
  },
};

export default config;
