/**
 * Runs an API call and, if the server answers 429 (rate limited), waits for the
 * time it asks for (Retry-After) and tries again — instead of failing a whole
 * batch because it saved faster than the per-minute allowance.
 *
 * Only 429 is retried; every other error is thrown straight away.
 */
const DEFAULT_WAIT_MS = 15_000;
const MAX_WAIT_MS = 65_000;

export function rateLimitWaitMs(error) {
  const header = error?.response?.headers?.['retry-after'];
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds > 0) return Math.min(MAX_WAIT_MS, Math.ceil(seconds * 1000) + 250);
  return DEFAULT_WAIT_MS;
}

export async function retryOnRateLimit(call, { retries = 6, onWait, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) } = {}) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await call();
    } catch (error) {
      if (error?.response?.status !== 429 || attempt >= retries) throw error;
      const waitMs = rateLimitWaitMs(error);
      onWait?.(Math.ceil(waitMs / 1000), attempt + 1);
      await sleep(waitMs);
    }
  }
}
