import React from 'react';
import ReactDOM from 'react-dom/client';
import { MascotAnimationLabPage } from './surfaces/website/pages/MascotAnimationLabPage.jsx';
import './shared/styles/index.css';

function markPreviewReady() {
  window.__lmsReactReady = true;
  window.__lmsRouteReady = true;
  document.body.classList.remove('app-booting');
  document.body.classList.add('app-ready', 'mascot-preview-runtime');
  document.getElementById('lms-static-boot')?.remove();
  window.dispatchEvent(new Event('lms:react-ready'));
  window.dispatchEvent(new Event('lms:route-ready'));
}

function clearPreviewServiceWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  navigator.serviceWorker.getRegistrations()
    .then((registrations) => Promise.all(
      registrations.map((registration) => registration.unregister())
    ))
    .catch(() => {});

  if ('caches' in window) {
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.toLowerCase().includes('lms'))
          .map((key) => caches.delete(key))
      ))
      .catch(() => {});
  }
}

clearPreviewServiceWorker();
markPreviewReady();

ReactDOM.createRoot(document.getElementById('root')).render(
  <MascotAnimationLabPage />
);
