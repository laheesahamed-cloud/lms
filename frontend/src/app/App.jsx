import { Suspense, lazy, useEffect } from 'react';
import { BootLoader } from './BootLoader.jsx';

const AppRuntime = lazy(() => import('./AppRuntime.jsx').then((module) => ({ default: module.AppRuntime })));
const MascotAnimationLabPage = lazy(() => import('../surfaces/website/pages/MascotAnimationLabPage.jsx').then((module) => ({ default: module.MascotAnimationLabPage })));

function isMascotAnimationLabRoute() {
  if (typeof window === 'undefined') {
    return false;
  }

  const routeText = `${window.location.pathname || ''}${window.location.hash || ''}`;
  return /\/mascot-animation-lab(?:\/|$)/.test(routeText);
}

function PreviewRuntimeReady() {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    window.__lmsReactReady = true;
    window.__lmsRouteReady = true;
    document.dispatchEvent(new Event('lms:react-ready'));
    document.dispatchEvent(new CustomEvent('lms:route-ready', {
      detail: { pathname: window.location.pathname || '/mascot-animation-lab' },
    }));
  }, []);

  return null;
}

export function App() {
  if (isMascotAnimationLabRoute()) {
    return (
      <>
        <BootLoader />
        <PreviewRuntimeReady />
        <Suspense fallback={null}>
          <MascotAnimationLabPage />
        </Suspense>
      </>
    );
  }

  return (
    <Suspense fallback={null}>
      <AppRuntime />
    </Suspense>
  );
}
