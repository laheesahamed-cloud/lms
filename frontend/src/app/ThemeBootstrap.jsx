import { useLayoutEffect } from 'react';
import { useThemeStore } from '../shared/stores/themeStore.js';

export function ThemeBootstrap({ children }) {
  const hydrateTheme = useThemeStore((state) => state.hydrateTheme);

  useLayoutEffect(() => {
    hydrateTheme();
  }, [hydrateTheme]);

  return children;
}
