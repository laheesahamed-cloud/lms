import { APP_STORE_URL, PLAY_STORE_URL } from '../config/appLinks.js';
import { cx, ui } from '../styles/tailwindClasses.js';

// Shown instead of premium quiz/lesson/flashcard content on the website —
// that content is only ever served to the mobile app (backend-enforced, see
// backend/src/common/exceptions/app-only-content.exception.ts). The website
// stays for browsing and subscribing; studying happens in the app.
export function AppOnlyGate({ title = 'Continue in the app', message, contentLabel = 'content' }) {
  const body = message || `This ${contentLabel} is premium content — it's only available in the Xyndrome mobile app. Subscribing still works here on the website.`;

  return (
    <div className={ui.emptyBox}>
      <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-[var(--color-primary-light)] text-brand-primary">
        <svg viewBox="0 0 24 24" className="size-6" fill="none" aria-hidden="true">
          <rect x="7" y="2.5" width="10" height="19" rx="2.2" stroke="currentColor" strokeWidth="1.7" />
          <path d="M10.5 18.5h3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      </div>
      <strong className="block text-[15px] font-extrabold text-ink-strong">{title}</strong>
      <p className="mx-auto mt-1.5 max-w-[420px]">{body}</p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <StoreLink href={APP_STORE_URL} label="Download on the App Store" />
        <StoreLink href={PLAY_STORE_URL} label="Get it on Google Play" />
      </div>
    </div>
  );
}

function StoreLink({ href, label }) {
  if (!href) {
    return (
      <span className={cx(ui.secondaryAction, 'pointer-events-none opacity-60')} aria-disabled="true">
        {label} · Coming soon
      </span>
    );
  }

  return (
    <a className={ui.primaryAction} href={href} target="_blank" rel="noopener noreferrer">
      {label}
    </a>
  );
}
