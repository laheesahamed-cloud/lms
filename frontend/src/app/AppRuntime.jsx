import { Suspense, lazy, useEffect, useState } from 'react';
import { AppProviders } from './providers.jsx';
import { AppErrorBoundary } from './AppErrorBoundary.jsx';
import { PlatformProvider } from '../shared/platform/PlatformProvider.jsx';
import { getPlatformConfig } from '../shared/platform/config.js';
import { AppOnlyBrowserGate } from '../shared/platform/AppOnlyBrowserGate.jsx';
import { AppRouter } from './router.jsx';
import { isPublicWebsiteRoute } from '../shared/routing/publicRoutes.js';

const OfflineExperience = lazy(() => import('../shared/ui/OfflineExperience.jsx').then((module) => ({ default: module.OfflineExperience })));

function isCurrentPublicWebsiteRoute() {
  if (typeof window === 'undefined') return false;
  return isPublicWebsiteRoute(window.location.pathname || '/');
}

function useShouldMountRuntimeEffects() {
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
  const shouldMountRuntimeEffects = useShouldMountRuntimeEffects();

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
          <RuntimeEffects enabled={shouldMountRuntimeEffects} />
        </AppProviders>
      </PlatformProvider>
    </>
  );
}

function RuntimeEffects({ enabled }) {
  if (!enabled) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <OfflineExperience />
    </Suspense>
  );
}
