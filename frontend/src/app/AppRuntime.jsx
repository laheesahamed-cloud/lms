import { Suspense, lazy } from 'react';
import { AppProviders } from './providers.jsx';
import { AppErrorBoundary } from './AppErrorBoundary.jsx';
import { PlatformProvider, usePlatform } from '../shared/platform/PlatformProvider.jsx';
import { getPlatformConfig } from '../shared/platform/config.js';
import { AppOnlyBrowserGate } from '../shared/platform/AppOnlyBrowserGate.jsx';
import { BootLoader } from './BootLoader.jsx';

const OfflineExperience = lazy(() => import('../shared/pwa/OfflineExperience.jsx').then((module) => ({ default: module.OfflineExperience })));
const RecoveryRefreshController = lazy(() => import('../shared/pwa/RecoveryRefreshController.jsx').then((module) => ({ default: module.RecoveryRefreshController })));
const MacChromiumScrollFix = lazy(() => import('../shared/pwa/MacChromiumScrollFix.jsx').then((module) => ({ default: module.MacChromiumScrollFix })));
const AppRouter = lazy(() => import('./router.jsx').then((module) => ({ default: module.AppRouter })));

export function AppRuntime() {
  if (getPlatformConfig().blockDirectAppHost) {
    return <AppOnlyBrowserGate />;
  }

  return (
    <>
      <BootLoader />
      <PlatformProvider>
        <AppProviders>
          <AppErrorBoundary>
            <Suspense fallback={null}>
              <AppRouter />
            </Suspense>
          </AppErrorBoundary>
          <PwaRuntimeEffects />
        </AppProviders>
      </PlatformProvider>
    </>
  );
}

function PwaRuntimeEffects() {
  const { mountPwaExperiences } = usePlatform();

  if (!mountPwaExperiences) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <RecoveryRefreshController />
      <MacChromiumScrollFix />
      <OfflineExperience />
    </Suspense>
  );
}
