import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const buildVersion = '20260526-safe-area-blend-v3';
const isCapacitorBuild = Boolean(process.env.CAPACITOR_BUILD || process.env.VITE_LMS_BUILD_TARGET === 'native');
const isDesktopBuild = process.env.VITE_LMS_BUILD_TARGET === 'desktop';
const shouldEmitSourceMaps = process.env.VITE_SOURCEMAP === 'true';
const appEntryFileName = isCapacitorBuild ? 'assets/app-[hash].js' : `assets/app-${buildVersion}.js`;
const appChunkFileName = isCapacitorBuild ? 'assets/chunks/[name]-[hash].js' : `assets/chunks/[name]-${buildVersion}.js`;
const appCssFileName = isCapacitorBuild ? 'assets/app-[hash].css' : `assets/app-${buildVersion}.css`;

export default defineConfig(({ command }) => ({
  base: command === 'serve' ? '/lms/' : isCapacitorBuild ? '/' : isDesktopBuild ? './' : '/lms/frontend/dist/',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: isCapacitorBuild ? 'dist-capacitor' : 'dist',
    minify: 'oxc',
    // Keep responsive media queries compatible with older iOS WebViews.
    // Without this, Lightning CSS can rewrite max-width to range syntax
    // that older iPhone SE-era Safari/WebView builds do not understand.
    cssTarget: 'safari15',
    sourcemap: shouldEmitSourceMaps,
    rollupOptions: {
      output: {
        entryFileNames: appEntryFileName,
        chunkFileNames: appChunkFileName,
        assetFileNames: (assetInfo) => {
          if (assetInfo.names && assetInfo.names.some((name) => name.endsWith('.css'))) {
            return appCssFileName;
          }

          return 'assets/[name][extname]';
        },
      },
    },
  },
  server: {
    port: 5174,
  },
}));
