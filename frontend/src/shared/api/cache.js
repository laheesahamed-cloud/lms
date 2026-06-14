import { detectPlatform } from '../platform/detect.js';

const IS_NATIVE = detectPlatform().isNative;
const STORAGE_PREFIX = 'lms.swr.';

// On native every read is a real network round-trip, so a cache that expires in
// 15-30s means most navigations refetch and flash a spinner. Caches that opt in
// with `persistKey` get a longer fresh window plus a stale-while-revalidate
// window: stale data is served instantly while a refresh runs in the
// background, so navigation never blocks once a slice has loaded once.
const NATIVE_MIN_TTL_MS = 90_000;
const NATIVE_SWR_MS = 5 * 60_000;

const timedApiCacheClearers = new Set();
let timedApiCacheEpoch = 0;

function readStorage(name) {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(name);
  } catch {
    return null;
  }
}

function writeStorage(name, value) {
  try {
    if (typeof localStorage === 'undefined') return;
    if (value === null) localStorage.removeItem(name);
    else localStorage.setItem(name, value);
  } catch {
    // Storage can be full or disabled (private mode); the in-memory cache still works.
  }
}

export function clearAllTimedApiCaches() {
  timedApiCacheEpoch += 1;
  timedApiCacheClearers.forEach((clear) => clear());
}

// Lets the boot batcher (boot.api.js) drop seed data that raced a logout:
// it captures the epoch before the request and compares before seeding.
export function getTimedApiCacheEpoch() {
  return timedApiCacheEpoch;
}

export function createTimedApiCache({ ttlMs = 15000, key = () => 'default', load, persistKey = null }) {
  const entries = new Map();
  // Stale-while-revalidate only kicks in for persisted (opt-in) caches on
  // native; everywhere else behavior is unchanged (blocking refetch when stale).
  const effectiveTtl = persistKey && IS_NATIVE ? Math.max(ttlMs, NATIVE_MIN_TTL_MS) : ttlMs;
  const swrMs = persistKey && IS_NATIVE ? NATIVE_SWR_MS : 0;
  const storageName = persistKey ? `${STORAGE_PREFIX}${persistKey}` : null;

  function persist() {
    if (!storageName) return;
    const snapshot = {};
    entries.forEach((value, cacheKey) => {
      if (value?.data !== undefined) snapshot[cacheKey] = { data: value.data, timestamp: value.timestamp };
    });
    const keys = Object.keys(snapshot);
    writeStorage(storageName, keys.length ? JSON.stringify(snapshot) : null);
  }

  function hydrate() {
    if (!storageName) return;
    const raw = readStorage(storageName);
    if (!raw) return;
    try {
      const snapshot = JSON.parse(raw);
      Object.entries(snapshot || {}).forEach(([cacheKey, value]) => {
        if (value?.data !== undefined) {
          // `hydrated` makes the first read of a restored value serve instantly
          // (stale-while-revalidate) regardless of how old it is, so a cold app
          // launch paints last session's data, then refreshes in the background.
          entries.set(cacheKey, { data: value.data, timestamp: value.timestamp || 0, promise: null, hydrated: true });
        }
      });
    } catch {
      writeStorage(storageName, null);
    }
  }

  function clear(matchKey) {
    if (matchKey === undefined) {
      entries.clear();
    } else {
      entries.delete(String(matchKey));
    }
    persist();
  }

  function revalidate(cacheKey, current, args) {
    const requestEpoch = timedApiCacheEpoch;
    const promise = Promise.resolve(load(...args))
      .then((data) => {
        if (requestEpoch === timedApiCacheEpoch) {
          entries.set(cacheKey, { data, timestamp: Date.now(), promise: null });
          persist();
        }
        return data;
      })
      .catch((error) => {
        if (current?.data !== undefined && requestEpoch === timedApiCacheEpoch) {
          entries.set(cacheKey, { data: current.data, timestamp: current.timestamp || 0, promise: null });
        } else {
          entries.delete(cacheKey);
        }
        throw error;
      });

    entries.set(cacheKey, { data: current?.data, timestamp: current?.timestamp || 0, promise });
    return promise;
  }

  async function get(...args) {
    const cacheKey = String(key(...args));
    const now = Date.now();
    const current = entries.get(cacheKey);
    const age = current ? now - current.timestamp : Infinity;

    // Fresh within the TTL — serve from memory, no network.
    if (current?.data !== undefined && !current.hydrated && age < effectiveTtl) {
      return current.data;
    }

    // Stale-while-revalidate: serve the last value instantly and refresh in the
    // background. Covers in-session staleness (within the SWR window) and the
    // first read of a value restored from storage on cold start.
    if (current?.data !== undefined && !current.promise && (current.hydrated || age < effectiveTtl + swrMs)) {
      current.hydrated = false;
      revalidate(cacheKey, current, args).catch(() => {});
      return current.data;
    }

    if (current?.promise) {
      return current.promise;
    }

    return revalidate(cacheKey, current, args);
  }

  function peek(...args) {
    const cacheKey = String(key(...args));
    const current = entries.get(cacheKey);
    return current?.data;
  }

  // Boot batching (R3 Task 26): store server data fetched by another request
  // (the /student/boot batch) as if this cache had loaded it itself. Never
  // clobbers a fresher direct fetch. Persisted so the batch's slices survive a
  // cold app launch.
  function seed(data, ...args) {
    if (data === undefined || data === null) return;
    const cacheKey = String(key(...args));
    const current = entries.get(cacheKey);
    if (current?.data !== undefined && !current.hydrated && Date.now() - current.timestamp < effectiveTtl) return;
    entries.set(cacheKey, { data, timestamp: Date.now(), promise: null });
    persist();
  }

  hydrate();
  timedApiCacheClearers.add(clear);

  return { clear, get, peek, seed };
}
