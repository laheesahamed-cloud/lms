import { useEffect, useMemo, useState } from 'react';
import { getServerNotRespondingState, subscribeToServerStatus } from '../../stores/serverStatusStore.js';
import { cx } from '../../styles/tailwindClasses.js';

const STORAGE_KEY = 'erpm-lms-server-stop-quotes';

const defaultQuotes = [
  {
    quote: 'The server seems to be in a prolonged ward round. Clinical patience is advised.',
    author: 'ERPM LMS',
  },
  {
    quote: 'The backend is not answering right now, but your future consultant energy remains intact.',
    author: 'ERPM LMS',
  },
  {
    quote: 'This feels like asking for CT results at 4:59 PM. We are still waiting professionally.',
    author: 'ERPM LMS',
  },
  {
    quote: 'Server response currently absent. Please continue supportive care and calm revision.',
    author: 'ERPM LMS',
  },
  {
    quote: 'The internet is here. The server is emotionally unavailable.',
    author: 'ERPM LMS',
  },
];

const serverUi = {
  rootBase: 'pointer-events-none isolate',
  rootLive: 'fixed inset-0 z-[9999] grid place-items-center p-5',
  rootPreview: 'absolute inset-0 z-[2] grid place-items-center p-5',
  scrim: 'absolute inset-0 bg-red-950/25 backdrop-blur-[4px]',
  dialog:
    'pointer-events-auto relative z-[1] grid w-[min(430px,100%)] justify-items-center gap-3 rounded-2xl border border-red-300/15 bg-[linear-gradient(135deg,rgba(30,10,18,0.94),rgba(15,23,42,0.9))] p-6 text-center text-white shadow-2xl',
  badge: 'rounded-full border border-red-300/20 bg-red-400/10 px-3 py-1 text-[10.5px] font-black uppercase tracking-[0.14em] text-red-100',
  loader: 'flex items-center gap-2 py-1',
  dot: 'size-2.5 rounded-full bg-red-200 shadow-[0_0_14px_rgba(254,202,202,0.58)] animate-bounce',
};

function loadCachedQuotes() {
  if (typeof window === 'undefined') {
    return defaultQuotes;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultQuotes));
      return defaultQuotes;
    }

    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch {
    return defaultQuotes;
  }

  return defaultQuotes;
}

export function ServerNotRespondingExperience({ forceVisible = false, previewClassName = '' }) {
  const [visible, setVisible] = useState(() => getServerNotRespondingState());
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [quotes] = useState(() => loadCachedQuotes());

  useEffect(() => subscribeToServerStatus(setVisible), []);

  useEffect(() => {
    if (!visible || quotes.length < 2) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setQuoteIndex((current) => (current + 1) % quotes.length);
    }, 3800);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [quotes.length, visible]);

  const activeQuote = useMemo(() => quotes[quoteIndex % quotes.length] || defaultQuotes[0], [quoteIndex, quotes]);

  if (!forceVisible && !visible) {
    return null;
  }

  return (
    <section
      className={cx(serverUi.rootBase, previewClassName ? serverUi.rootPreview : serverUi.rootLive, previewClassName)}
      aria-live="polite"
      aria-atomic="true"
    >
      <div className={serverUi.scrim} />
      <div className={serverUi.dialog}>
        <div className={serverUi.badge}>Server Pause</div>
        <div className={serverUi.loader} aria-hidden="true">
          <span className={serverUi.dot} />
          <span className={cx(serverUi.dot, '[animation-delay:120ms]')} />
          <span className={cx(serverUi.dot, '[animation-delay:240ms]')} />
        </div>
        <h2 className="m-0 text-[clamp(21px,4vw,30px)] font-black leading-tight">The LMS server stopped responding.</h2>
        <p className="m-0 text-sm leading-relaxed text-white/70">{activeQuote.quote}</p>
        <small className="text-xs font-bold text-white/45">{activeQuote.author}</small>
      </div>
    </section>
  );
}
