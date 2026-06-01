/// <reference types="@capacitor/status-bar" />
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { CapacitorConfig } from '@capacitor/cli';

function readEnvValue(name: string) {
  const directValue = process.env[name];
  if (directValue) return directValue;

  const envFiles = ['.env.capacitor.local', '.env.capacitor'];

  for (const file of envFiles) {
    const filePath = resolve(process.cwd(), file);
    if (!existsSync(filePath)) continue;

    const line = readFileSync(filePath, 'utf8')
      .split(/\r?\n/)
      .find((line) => line.trim().startsWith(`${name}=`));
    if (line) return line.slice(line.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '');
  }

  return '';
}

const nativeApiBaseUrl = readEnvValue('VITE_API_BASE_URL');
const androidScheme = nativeApiBaseUrl.startsWith('http://') ? 'http' : 'https';

const config: CapacitorConfig = {
  appId: 'com.erpm.medical.lms',
  appName: 'xyndrome',
  webDir: 'dist-capacitor',
  bundledWebRuntime: false,
  server: {
    androidScheme,
  },
  ios: {
    contentInset: 'never',
    backgroundColor: '#151c24',
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
  },
};

export default config;
