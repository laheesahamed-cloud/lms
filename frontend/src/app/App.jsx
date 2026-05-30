import { Suspense, lazy } from 'react';

const AppRuntime = lazy(() => import('./AppRuntime.jsx').then((module) => ({ default: module.AppRuntime })));

export function App() {
  return (
    <Suspense fallback={null}>
      <AppRuntime />
    </Suspense>
  );
}
