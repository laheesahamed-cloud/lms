import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore.js';

export function AuthBootstrap({ children }) {
  useEffect(() => {
    useAuthStore.getState().hydrate();
  }, []);

  return children;
}
