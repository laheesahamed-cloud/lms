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
  offline: {
    accent: '#2563eb',
    icon: 'wifi',
    label: 'Offline mode',
    title: 'Connection needed.',
    message: 'Check internet connection.',
  },
  session: {
    accent: '#d97706',
    icon: 'lock',
    label: 'Session expired',
    title: 'Session expired.',
    message: 'Sign in again to continue.',
  },
};

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

function LockIcon() {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path d="M20 28v-7a12 12 0 0 1 24 0v7" strokeWidth="4" strokeLinecap="round" />
      <rect x="14" y="27" width="36" height="26" rx="8" strokeWidth="4" />
      <path d="M32 38v6" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

const icons = {
  lock: LockIcon,
  wifi: WifiIcon,
};

export function SystemStatusOverlay({
  variant = 'offline',
  quoteRotationMs = QUOTE_ROTATE_MS,
  showQuote = true,
  zIndex = 12000,
}) {
  const config = statusCopy[variant] || statusCopy.offline;
  const [quoteIndex, setQuoteIndex] = useState(0);
  const ActiveIcon = icons[config.icon] || WifiIcon;

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
