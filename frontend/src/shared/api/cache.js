const timedApiCacheClearers = new Set();
let timedApiCacheEpoch = 0;

export function clearAllTimedApiCaches() {
  timedApiCacheEpoch += 1;
  timedApiCacheClearers.forEach((clear) => clear());
}

export function createTimedApiCache({ ttlMs = 15000, key = () => 'default', load }) {
  const entries = new Map();

  function clear(matchKey) {
    if (matchKey === undefined) {
      entries.clear();
      return;
    }
    entries.delete(String(matchKey));
  }

  async function get(...args) {
    const cacheKey = String(key(...args));
    const now = Date.now();
    const current = entries.get(cacheKey);

    if (current?.data !== undefined && now - current.timestamp < ttlMs) {
      return current.data;
    }

    if (current?.promise) {
      return current.promise;
    }

    const requestEpoch = timedApiCacheEpoch;
    const promise = Promise.resolve(load(...args))
      .then((data) => {
        if (requestEpoch === timedApiCacheEpoch) {
          entries.set(cacheKey, {
            data,
            timestamp: Date.now(),
            promise: null,
          });
        }
        return data;
      })
      .catch((error) => {
        if (current?.data !== undefined && requestEpoch === timedApiCacheEpoch) {
          entries.set(cacheKey, {
            data: current.data,
            timestamp: current.timestamp || 0,
            promise: null,
          });
        } else {
          entries.delete(cacheKey);
        }
        throw error;
      });

    entries.set(cacheKey, {
      data: current?.data,
      timestamp: current?.timestamp || 0,
      promise,
    });

    return promise;
  }

  function peek(...args) {
    const cacheKey = String(key(...args));
    const current = entries.get(cacheKey);
    return current?.data;
  }

  timedApiCacheClearers.add(clear);

  return { clear, get, peek };
}
