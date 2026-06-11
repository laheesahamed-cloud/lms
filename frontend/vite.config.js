import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const isCapacitorBuild = Boolean(process.env.CAPACITOR_BUILD || process.env.VITE_LMS_BUILD_TARGET === 'native');
const isDesktopBuild = process.env.VITE_LMS_BUILD_TARGET === 'desktop';
const shouldEmitSourceMaps = process.env.VITE_SOURCEMAP === 'true';
const appEntryFileName = 'assets/app-[hash].js';
const appChunkFileName = 'assets/chunks/[name]-[hash].js';
const appCssFileName = 'assets/css/[name]-[hash].css';

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
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            // Heavy libraries stay isolated so only the routes that import them pay for them.
            if (id.includes('html2canvas')) return 'html2canvas';
            if (id.includes('gsap')) return 'gsap';
            if (id.includes('framer-motion')) return 'motion';
            if (id.includes('node_modules/react-dom/')) return 'vendor-react-dom';
            return 'vendor';
          }
          // SuccessBurst imports framer-motion; keeping it out of app-shared stops
          // the motion chunk from becoming a dependency of every route.
          if (id.includes('/src/shared/ui/SuccessBurst')) return undefined;
          // Group only the small always-loaded shared tail; layout/search/popup/
          // launch/account/seo stay route-driven so routes don't pay for them eagerly.
          if (/\/src\/shared\/(api|platform|utils|stores|pwa|routing|auth|security|hooks|brand|components|notifications|ui)\//.test(id)) return 'app-shared';
        },
      },
    },
  },
  server: {
    port: 5174,
  },
}));
