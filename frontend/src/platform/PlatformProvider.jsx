import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { applyPlatformAttributes, detectPlatform, installPlatformAttributeSync } from './detect.js';
import { getPlatformConfig } from './config.js';
import { selectPlatformComponent, selectPlatformValue } from './select.js';

const PlatformContext = createContext(getPlatformConfig(applyPlatformAttributes()));

export function PlatformProvider({ children }) {
  const [platform, setPlatform] = useState(() => applyPlatformAttributes(detectPlatform()));

  useEffect(() => installPlatformAttributeSync(setPlatform), []);

  const value = useMemo(() => getPlatformConfig(platform), [platform]);

  return (
    <PlatformContext.Provider value={value}>
      {children}
    </PlatformContext.Provider>
  );
}

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

export function PlatformSlot({ components, fallback: FallbackComponent, componentProps = {} }) {
  const Component = usePlatformComponent(components, FallbackComponent);
  return Component ? <Component {...componentProps} /> : null;
}
