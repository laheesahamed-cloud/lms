import { Suspense, lazy, useEffect } from 'react';
import { AppProviders } from './providers.jsx';
import { AppErrorBoundary } from './AppErrorBoundary.jsx';
import { PlatformProvider } from '../shared/platform/PlatformProvider.jsx';
import { usePlatform } from '../shared/platform/PlatformContext.js';
import { getPlatformConfig } from '../shared/platform/config.js';
import { AppOnlyBrowserGate } from '../shared/platform/AppOnlyBrowserGate.jsx';
import { AppRouter } from './router.jsx';

const OfflineExperience = lazy(() => import('../shared/pwa/OfflineExperience.jsx').then((module) => ({ default: module.OfflineExperience })));
const RecoveryRefreshController = lazy(() => import('../shared/pwa/RecoveryRefreshController.jsx').then((module) => ({ default: module.RecoveryRefreshController })));
const ServerNotRespondingExperience = lazy(() => import('../shared/pwa/ServerNotRespondingExperience.jsx').then((module) => ({ default: module.ServerNotRespondingExperience })));

export function AppRuntime() {
  useEffect(() => {
    document.body?.classList.remove('app-booting');
    document.body?.classList.add('app-ready');
  }, []);

  if (getPlatformConfig().blockDirectAppHost) {
    return <AppOnlyBrowserGate />;
  }

  return (
    <>
      <PlatformProvider>
        <AppProviders>
          <AppErrorBoundary>
            <Suspense fallback={null}>
              <AppRouter />
            </Suspense>
          </AppErrorBoundary>
          <Suspense fallback={null}>
            <RecoveryRefreshController />
            <ServerNotRespondingExperience />
          </Suspense>
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
      <OfflineExperience />
    </Suspense>
  );
}
