let activeRequestCount = 0;
let lastBusyState = false;
const listeners = new Set();

function emit() {
  for (const listener of listeners) {
    listener(activeRequestCount);
  }
}

function emitIfBusyStateChanged() {
  const nextBusyState = activeRequestCount > 0;
  if (nextBusyState === lastBusyState) {
    return;
  }

  lastBusyState = nextBusyState;
  emit();
}

export function beginNetworkActivity() {
  activeRequestCount += 1;
  emitIfBusyStateChanged();
}

export function endNetworkActivity() {
  activeRequestCount = Math.max(0, activeRequestCount - 1);
  emitIfBusyStateChanged();
}
