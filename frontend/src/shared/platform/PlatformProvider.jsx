import { useEffect, useMemo, useState } from 'react';
import { applyPlatformAttributes, detectPlatform, installPlatformAttributeSync } from './detect.js';
import { getPlatformConfig } from './config.js';
import { PlatformContext, usePlatformComponent } from './PlatformContext.js';

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

export function PlatformSlot({ components, fallback: FallbackComponent, componentProps = {} }) {
  const Component = usePlatformComponent(components, FallbackComponent);
  return Component ? <Component {...componentProps} /> : null;
}
