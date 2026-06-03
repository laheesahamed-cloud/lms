import { createContext, useContext, useMemo } from 'react';
import { applyPlatformAttributes } from './detect.js';
import { getPlatformConfig } from './config.js';
import { selectPlatformValue } from './select.js';

export const PlatformContext = createContext(getPlatformConfig(applyPlatformAttributes()));

export function usePlatform() {
  return useContext(PlatformContext);
}

export function usePlatformValue(overrides, fallback) {
  const { platform } = usePlatform();
  return useMemo(
    () => selectPlatformValue(overrides, fallback, platform),
    [fallback, overrides, platform]
  );
}

export function usePlatformComponent(overrides, fallback) {
  return usePlatformValue(overrides, fallback);
}
