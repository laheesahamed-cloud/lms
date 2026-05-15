import { useLayoutEffect } from 'react';
import { getPlatformConfig } from './config.js';

export function AppOnlyBrowserGate() {
  const config = getPlatformConfig();
  const publicHost = import.meta.env.VITE_PUBLIC_WEBSITE_URL || 'the public LMS website';

  useLayoutEffect(() => {
    if (!config.blockDirectAppHost || typeof document === 'undefined') return;
    window.__lmsReactReady = true;
    window.__lmsRouteReady = true;
    document.dispatchEvent(new Event('lms:react-ready'));
    document.dispatchEvent(new Event('lms:route-ready'));
  }, [config.blockDirectAppHost]);

  if (!config.blockDirectAppHost) {
    return null;
  }

  return (
    <main className="platform-gate" role="status">
      <section className="platform-gate__panel">
        <p className="platform-gate__eyebrow">Private app endpoint</p>
        <h1>Open this LMS from the installed app.</h1>
        <p>
          This host is reserved for native app traffic and does not serve the public website.
          Use {publicHost} in a browser.
        </p>
      </section>
    </main>
  );
}
