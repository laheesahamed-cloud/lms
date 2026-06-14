import { detectPlatform } from './detect.js';

export function selectPlatformValue(overrides, fallback, platform = detectPlatform()) {
  if (!overrides || typeof overrides !== 'object') return fallback;

  const candidates = [
    platform.target,
    `${platform.runtime}-${platform.os}-${platform.formFactor}`,
    `${platform.runtime}-${platform.os}`,
    `${platform.runtime}-${platform.formFactor}`,
    platform.runtime,
    platform.formFactor,
    platform.os,
    'default',
  ];

  const key = candidates.find((candidate) => Object.prototype.hasOwnProperty.call(overrides, candidate));
  return key ? overrides[key] : fallback;
}
