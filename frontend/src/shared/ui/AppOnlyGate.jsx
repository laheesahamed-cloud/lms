import { APP_STORE_URL, PLAY_STORE_URL } from '../config/appLinks.js';
import './app-only-gate.css';

// Shown instead of premium lesson / quiz / flashcard content on the website.
// Premium study happens in the Xyndrome app; the website keeps free samples,
// payments and the account (OPTIMIZE 10.21). Decided in the browser from the
// free list it already holds — no request is made for premium content.
export function AppOnlyGate({ title = 'Continue in the app', message, contentLabel = 'content' }) {
  const body = message || `This ${contentLabel} works in the Xyndrome app. Open it there to keep going, with everything in one place.`;

  return (
    <div className="app-gate">
      <div className="app-gate-phone" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <rect x="7" y="2.5" width="10" height="19" rx="2.4" stroke="currentColor" strokeWidth="1.6" />
          <path d="M10.5 18.5h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </div>
      <h2 className="app-gate-title">{title}</h2>
      <p className="app-gate-body">{body}</p>
      <div className="app-gate-badges">
        <StoreBadge href={APP_STORE_URL} kind="apple" small="Download on the" big="App Store" />
        <StoreBadge href={PLAY_STORE_URL} kind="android" small="Get it on" big="Google Play" />
      </div>
      {!APP_STORE_URL && !PLAY_STORE_URL ? <p className="app-gate-soon">Coming soon to iPhone and Android</p> : null}
    </div>
  );
}

function StoreBadge({ href, kind, small, big }) {
  const content = (
    <>
      {kind === 'apple' ? <AppleLogo /> : <PlayLogo />}
      <span className="app-gate-badge-text">
        <span className="app-gate-badge-small">{href ? small : 'Coming soon on'}</span>
        <span className="app-gate-badge-big">{big}</span>
      </span>
    </>
  );
  return href ? (
    <a className="app-gate-badge" href={href} target="_blank" rel="noopener noreferrer">{content}</a>
  ) : (
    <span className="app-gate-badge is-soon" aria-disabled="true">{content}</span>
  );
}

function AppleLogo() {
  return (
    <svg className="app-gate-logo" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M16.37 12.6c-.02-2.17 1.77-3.22 1.85-3.27-1.01-1.48-2.58-1.68-3.14-1.7-1.33-.14-2.6.79-3.28.79-.68 0-1.72-.77-2.83-.75-1.45.02-2.8.85-3.55 2.15-1.52 2.63-.39 6.52 1.09 8.66.72 1.04 1.58 2.22 2.71 2.17 1.09-.04 1.5-.7 2.82-.7 1.31 0 1.69.7 2.84.68 1.17-.02 1.91-1.06 2.63-2.11.83-1.21 1.17-2.38 1.19-2.44-.03-.01-2.28-.87-2.33-3.48zM14.21 6.22c.6-.73 1.01-1.74.9-2.75-.87.04-1.92.58-2.54 1.31-.56.65-1.05 1.68-.92 2.67.97.08 1.96-.49 2.56-1.23z" />
    </svg>
  );
}

function PlayLogo() {
  return (
    <svg className="app-gate-logo" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#34A853" d="M3.6 2.3c-.26.27-.41.69-.41 1.24v16.92c0 .55.15.97.41 1.24l.07.06 9.48-9.48v-.22L3.67 2.24l-.07.06z" />
      <path fill="#FBBC04" d="M16.31 15.44l-3.16-3.16v-.22l3.16-3.16.07.04 3.74 2.13c1.07.61 1.07 1.6 0 2.21l-3.74 2.13-.07.03z" />
      <path fill="#EA4335" d="M16.38 15.41l-3.23-3.23-9.55 9.54c.35.37.93.42 1.59.05l11.19-6.36" />
      <path fill="#4285F4" d="M16.38 8.95L5.19 2.59c-.66-.37-1.24-.32-1.59.05l9.55 9.54 3.23-3.23z" />
    </svg>
  );
}
