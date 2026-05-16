import { Suspense, lazy } from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './router.jsx';
import { AppProviders } from './providers.jsx';
import { AppErrorBoundary } from './AppErrorBoundary.jsx';
import { PlatformProvider, usePlatform } from '../platform/PlatformProvider.jsx';
import { getPlatformConfig } from '../platform/config.js';
import { AppOnlyBrowserGate } from '../platform/AppOnlyBrowserGate.jsx';
import { BootLoader } from './BootLoader.jsx';
// Example usage:
// import HeartFailureNotes, { heartFailureLesson } from '../components/lessons/HeartFailureNotes.jsx';

const OfflineExperience = lazy(() => import('../components/pwa/OfflineExperience.jsx').then((module) => ({ default: module.OfflineExperience })));
const RecoveryRefreshController = lazy(() => import('../components/pwa/RecoveryRefreshController.jsx').then((module) => ({ default: module.RecoveryRefreshController })));
const MacChromiumScrollFix = lazy(() => import('../components/pwa/MacChromiumScrollFix.jsx').then((module) => ({ default: module.MacChromiumScrollFix })));

export function App() {
  if (getPlatformConfig().blockDirectAppHost) {
    return <AppOnlyBrowserGate />;
  }

  return (
    <>
      <BootLoader />
      <PlatformProvider>
        <AppProviders>
          <AppErrorBoundary>
            <RouterProvider router={router} />
          </AppErrorBoundary>
          <PwaRuntimeEffects />
          {/*
            Example lesson-notes usage:
            <HeartFailureNotes lesson={heartFailureLesson} />
          */}
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
