import { useEffect, useMemo, useState } from 'react';

const QUOTE_ROTATE_MS = 3200;

const medicineQuotes = [
  'Tiny study break. Flashcards doing a quick vitals check.',
  'Anatomy notes found the right nerve.',
  'Pharmacology remembered the dose today.',
  'Quiz questions scrubbed in for rounds.',
  'Dashboard ECG looks calm. Rhythm feels hopeful.',
  'Pathology slide labels look tidy.',
  'Study plan found the stethoscope.',
  'Ward round nearly back from tea.',
];

const statusCopy = {
  server: {
    accent: '#1f9d76',
    icon: 'stethoscope',
    label: 'Quick pause',
    title: 'Quick pause.',
    message: 'Please wait.',
  },
  offline: {
    accent: '#2563eb',
    icon: 'wifi',
    label: 'Offline mode',
    title: 'Connection needed.',
    message: 'Check internet connection.',
  },
  auth: {
    accent: '#7c3aed',
    icon: 'shield',
    label: 'Account check',
    title: 'Account check.',
    message: 'Please wait.',
  },
  session: {
    accent: '#d97706',
    icon: 'lock',
    label: 'Session expired',
    title: 'Session expired.',
    message: 'Sign in again to continue.',
  },
  route: {
    accent: '#e11d48',
    icon: 'file',
    label: 'Page pause',
    title: 'Page needs a moment.',
    message: 'Please wait.',
  },
  render: {
    accent: '#e11d48',
    icon: 'screen',
    label: 'Screen pause',
    title: 'Screen needs a moment.',
    message: 'Please wait.',
  },
};

function StethoscopeIcon() {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path d="M18 12v12a12 12 0 0 0 24 0V12" strokeWidth="4" strokeLinecap="round" />
      <path d="M18 12h-4M42 12h4" strokeWidth="4" strokeLinecap="round" />
      <path d="M30 36v7a10 10 0 0 0 20 0v-5" strokeWidth="4" strokeLinecap="round" />
      <circle cx="50" cy="34" r="5" strokeWidth="4" />
    </svg>
  );
}

function WifiIcon() {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path d="M13 25a30 30 0 0 1 38 0" strokeWidth="4" strokeLinecap="round" />
      <path d="M22 34a16 16 0 0 1 20 0" strokeWidth="4" strokeLinecap="round" />
      <path d="M29 43a5 5 0 0 1 6 0" strokeWidth="4" strokeLinecap="round" />
      <path d="M16 50 50 16" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path d="M32 8 50 16v13c0 12-7.2 21.6-18 27-10.8-5.4-18-15-18-27V16l18-8Z" strokeWidth="4" strokeLinejoin="round" />
      <path d="m23 32 6 6 13-14" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path d="M20 28v-7a12 12 0 0 1 24 0v7" strokeWidth="4" strokeLinecap="round" />
      <rect x="14" y="27" width="36" height="26" rx="8" strokeWidth="4" />
      <path d="M32 38v6" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path d="M18 8h21l11 11v37H18V8Z" strokeWidth="4" strokeLinejoin="round" />
      <path d="M38 8v13h12" strokeWidth="4" strokeLinejoin="round" />
      <path d="M25 33h18M25 43h13" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

function ScreenIcon() {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <rect x="10" y="13" width="44" height="31" rx="6" strokeWidth="4" />
      <path d="M26 53h12M32 44v9" strokeWidth="4" strokeLinecap="round" />
      <path d="m24 29 5 5 11-12" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const icons = {
  file: FileIcon,
  lock: LockIcon,
  screen: ScreenIcon,
  shield: ShieldIcon,
  stethoscope: StethoscopeIcon,
  wifi: WifiIcon,
};

export function SystemStatusOverlay({
  variant = 'server',
  quoteRotationMs = QUOTE_ROTATE_MS,
  showQuote = true,
  zIndex = 12000,
}) {
  const config = statusCopy[variant] || statusCopy.server;
  const [quoteIndex, setQuoteIndex] = useState(0);
  const ActiveIcon = icons[config.icon] || StethoscopeIcon;

  useEffect(() => {
    if (!showQuote || medicineQuotes.length < 2) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setQuoteIndex((current) => (current + 1) % medicineQuotes.length);
    }, quoteRotationMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [quoteRotationMs, showQuote]);

  const activeQuote = useMemo(() => medicineQuotes[quoteIndex % medicineQuotes.length], [quoteIndex]);
  const titleId = `lms-system-status-${variant}-title`;
  const messageId = `lms-system-status-${variant}-message`;

  return (
    <section
      className="lms-system-status"
      style={{
        '--lms-system-status-accent': config.accent,
        '--lms-system-status-z': zIndex,
      }}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-labelledby={titleId}
      aria-describedby={messageId}
    >
      <div className="lms-system-status__scrim" />
      <article className="lms-system-status__panel">
        <div className="lms-system-status__body">
          <span className="lms-system-status__badge">
            <span className="lms-system-status__dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <span>{config.label}</span>
          </span>
          <span className="lms-system-status__icon">
            <ActiveIcon />
          </span>
          <h2 id={titleId}>{config.title}</h2>
          <p id={messageId}>{config.message}</p>
        </div>
        {showQuote ? (
          <p className="lms-system-status__quote" aria-hidden="true">
            {activeQuote}
          </p>
        ) : null}
      </article>
    </section>
  );
}
