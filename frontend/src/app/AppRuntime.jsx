import { Suspense, lazy, useEffect, useState } from 'react';
import { AppProviders } from './providers.jsx';
import { AppErrorBoundary } from './AppErrorBoundary.jsx';
import { PlatformProvider } from '../shared/platform/PlatformProvider.jsx';
import { usePlatform } from '../shared/platform/PlatformContext.js';
import { getPlatformConfig } from '../shared/platform/config.js';
import { AppOnlyBrowserGate } from '../shared/platform/AppOnlyBrowserGate.jsx';
import { AppRouter } from './router.jsx';
import { isPublicWebsiteRoute } from '../shared/routing/publicRoutes.js';

const OfflineExperience = lazy(() => import('../shared/pwa/OfflineExperience.jsx').then((module) => ({ default: module.OfflineExperience })));
const RecoveryRefreshController = lazy(() => import('../shared/pwa/RecoveryRefreshController.jsx').then((module) => ({ default: module.RecoveryRefreshController })));
const ServerNotRespondingExperience = lazy(() => import('../shared/pwa/ServerNotRespondingExperience.jsx').then((module) => ({ default: module.ServerNotRespondingExperience })));

function isCurrentPublicWebsiteRoute() {
  if (typeof window === 'undefined') return false;
  return isPublicWebsiteRoute(window.location.pathname || '/');
}

function useShouldMountPwaRouteEffects() {
  const [shouldMount, setShouldMount] = useState(() => !isCurrentPublicWebsiteRoute());

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const syncRouteEffects = () => {
      setShouldMount(!isCurrentPublicWebsiteRoute());
    };

    syncRouteEffects();
    window.addEventListener('popstate', syncRouteEffects);
    window.addEventListener('lms:route-location-change', syncRouteEffects);
    return () => {
      window.removeEventListener('popstate', syncRouteEffects);
      window.removeEventListener('lms:route-location-change', syncRouteEffects);
    };
  }, []);

  return shouldMount;
}

export function AppRuntime() {
  const shouldMountPwaRouteEffects = useShouldMountPwaRouteEffects();

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
          {shouldMountPwaRouteEffects ? (
            <Suspense fallback={null}>
              <RecoveryRefreshController />
              <ServerNotRespondingExperience />
            </Suspense>
          ) : null}
          <PwaRuntimeEffects enabled={shouldMountPwaRouteEffects} />
        </AppProviders>
      </PlatformProvider>
    </>
  );
}

function PwaRuntimeEffects({ enabled }) {
  const { mountPwaExperiences } = usePlatform();

  if (!enabled || !mountPwaExperiences) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <OfflineExperience />
    </Suspense>
  );
}
