import { RouterProvider } from 'react-router-dom';
import { router } from './router.jsx';
import { AppProviders } from './providers.jsx';
import { OfflineExperience } from '../components/pwa/OfflineExperience.jsx';
import { RecoveryRefreshController } from '../components/pwa/RecoveryRefreshController.jsx';
import { MacChromiumScrollFix } from '../components/pwa/MacChromiumScrollFix.jsx';
// Example usage:
// import HeartFailureNotes, { heartFailureLesson } from '../components/lessons/HeartFailureNotes.jsx';

export function App() {
  return (
    <AppProviders>
      <RouterProvider router={router} />
      <RecoveryRefreshController />
      <MacChromiumScrollFix />
      <OfflineExperience />
      {/*
        Example lesson-notes usage:
        <HeartFailureNotes lesson={heartFailureLesson} />
      */}
    </AppProviders>
  );
}
