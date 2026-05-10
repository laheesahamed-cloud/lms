let serverNotResponding = false;
const listeners = new Set();

function emit() {
  for (const listener of listeners) {
    listener(serverNotResponding);
  }
}

export function markServerNotResponding() {
  if (serverNotResponding) {
    return;
  }

  serverNotResponding = true;
  emit();
}

export function clearServerNotResponding() {
  if (!serverNotResponding) {
    return;
  }

  serverNotResponding = false;
  emit();
}

export function subscribeToServerStatus(listener) {
  listeners.add(listener);
  listener(serverNotResponding);

  return () => {
    listeners.delete(listener);
  };
}

export function getServerNotRespondingState() {
  return serverNotResponding;
}
