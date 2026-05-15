const RETRYABLE_MESSAGES = [
  'socket connection was closed',
  'socket connection was closed unexpectedly',
  'fetch failed',
  'econnreset',
  'connectionclosed',
  'network error',
  'econnrefused',
  'etimedout',
  'terminated',
  'und_err_socket',
];

function isRetryableNetworkError(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return RETRYABLE_MESSAGES.some((m) => msg.includes(m));
  }
  return false;
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && (err.name === 'AbortError' || err.message.toLowerCase().includes('abort'));
}

export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  maxRetries = 3,
  retryDelayMs = 1500,
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fetch(url, init);
    } catch (err) {
      lastError = err;
      if (isAbortError(err) || !isRetryableNetworkError(err) || attempt === maxRetries) {
        throw err;
      }
      const backoffMs = retryDelayMs * 2 ** attempt;
      const jitterMs = Math.floor(Math.random() * 300);
      await new Promise((resolve) => setTimeout(resolve, backoffMs + jitterMs));
    }
  }

  throw lastError;
}
