"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchWithRetry = fetchWithRetry;
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
function isRetryableNetworkError(err) {
    if (err instanceof Error) {
        const msg = err.message.toLowerCase();
        return RETRYABLE_MESSAGES.some((m) => msg.includes(m));
    }
    return false;
}
function isAbortError(err) {
    return err instanceof Error && (err.name === 'AbortError' || err.message.toLowerCase().includes('abort'));
}
async function fetchWithRetry(url, init, maxRetries = 3, retryDelayMs = 1500) {
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fetch(url, init);
        }
        catch (err) {
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
//# sourceMappingURL=fetch-with-retry.js.map