import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';

const isCapacitorBuild = Boolean(process.env.CAPACITOR_BUILD || process.env.VITE_LMS_BUILD_TARGET === 'native');
const isDesktopBuild = process.env.VITE_LMS_BUILD_TARGET === 'desktop';
const shouldEmitSourceMaps = process.env.VITE_SOURCEMAP === 'true';
const hasAndroidFcmConfig = existsSync(new URL('./android/app/google-services.json', import.meta.url));
const appEntryFileName = 'assets/app-[hash].js';
const appChunkFileName = 'assets/chunks/[name]-[hash].js';
const appCssFileName = 'assets/css/[name]-[hash].css';

// OPTIMIZE 10.53 (white flash): boot.js blocks the first paint, and with
// "no-cache" every visit waited a round trip on a blank white page. A content
// version in its address lets .htaccess cache it for a year; any edit to
// boot.js changes the address.
function versionBootScript() {
  return {
    name: 'lms-version-boot-script',
    transformIndexHtml(html) {
      const source = readFileSync(new URL('./public/boot.js', import.meta.url));
      const version = createHash('sha256').update(source).digest('hex').slice(0, 10);
      return html.replace(/(<script src="[^"]*boot\.js)(")/, `$1?v=${version}$2`);
    },
  };
}

export default defineConfig(({ command }) => ({
  base: command === 'serve' ? '/' : isCapacitorBuild ? '/' : isDesktopBuild ? './' : '/',
  plugins: [react(), tailwindcss(), versionBootScript()],
  define: {
    'import.meta.env.VITE_ANDROID_FCM_CONFIGURED': JSON.stringify(hasAndroidFcmConfig ? 'true' : 'false'),
  },
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
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            // Heavy libraries stay isolated so only the routes that import them pay for them.
            if (id.includes('html2canvas')) return 'html2canvas';
            if (id.includes('gsap')) return 'gsap';
            if (id.includes('framer-motion')) return 'motion';
            if (id.includes('node_modules/react-dom/')) return 'vendor-react-dom';
            return 'vendor';
          }
          // Group only the small always-loaded shared tail; layout/search/popup/
          // launch/account/seo stay route-driven so routes don't pay for them eagerly.
          if (/\/src\/shared\/(api|platform|utils|stores|routing|auth|security|hooks|brand|components|notifications|ui)\//.test(id)) return 'app-shared';
        },
      },
    },
  },
  server: {
    port: 5174,
    proxy: {
      // Local dev: forward API calls to the Nest backend so `npm run dev` works
      // same-origin (prod is served behind Apache, which proxies /api itself).
      '/api': {
        // DEV_API_TARGET points dev at another backend (e.g. the traced :3200
        // the load monitor watches); default unchanged.
        target: process.env.DEV_API_TARGET || 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
}));
