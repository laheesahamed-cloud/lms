// Boot batching channel (R3 Task 26). The per-module api caches use
// claimBootSlice() inside their load() so a fetch that races the
// /student/boot batch waits for the batch instead of issuing a duplicate
// request. Each slice is claimable ONCE — TTL-expired refetches always go
// to the network, so freshness semantics are unchanged.
//
// This module must stay dependency-light (cache.js only) so the api modules
// can import it without cycles: boot.api -> api modules -> bootChannel.
import { getTimedApiCacheEpoch } from './cache.js';

let bootPromise = null;
let bootEpoch = -1;
const claimedSlices = new Set();

export function setBootPromise(promise) {
  bootPromise = promise;
  bootEpoch = getTimedApiCacheEpoch();
  claimedSlices.clear();
}

export function resetBootChannel() {
  bootPromise = null;
  claimedSlices.clear();
}

export async function claimBootSlice(slice) {
  if (!bootPromise || claimedSlices.has(slice)) return undefined;
  claimedSlices.add(slice);
  try {
    const data = await bootPromise;
    // a logout (cache epoch bump) while the batch was in flight voids it
    if (bootEpoch !== getTimedApiCacheEpoch()) return undefined;
    const value = data?.[slice];
    return value === null || value === undefined ? undefined : value;
  } catch {
    return undefined;
  }
}
