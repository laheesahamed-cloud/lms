import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './app/App.jsx';
import { useAuthStore } from './stores/authStore.js';
import { applyPerformanceProfile } from './utils/performanceProfile.js';
import './styles/index.css';

if ('serviceWorker' in navigator && typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.getRegistrations()
      .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
      .catch(() => {});

    if ('caches' in window) {
      window.caches.keys().then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('erpm-lms-shell-'))
          .map((key) => window.caches.delete(key))
      )).catch(() => {});
    }
  });
}

// Start user/session hydration while the boot loader is still covering the app.
applyPerformanceProfile();
useAuthStore.getState().hydrate();

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
);
