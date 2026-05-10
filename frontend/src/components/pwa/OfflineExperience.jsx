import { useEffect, useMemo, useState } from 'react';
import { cx } from '../../styles/tailwindClasses.js';

const PUBLIC_BASE_PATH = import.meta.env.VITE_PUBLIC_BASE_PATH || '/';

const fallbackQuotes = [
  {
    quote: 'One page at a time, one patient at a time, one day at a time.',
    author: 'ERPM LMS',
  },
  {
    quote: 'You are not just studying medicine. You are preparing to carry hope into hard rooms.',
    author: 'ERPM LMS',
  },
  {
    quote: 'Every difficult topic you finish today becomes confidence at the bedside tomorrow.',
    author: 'ERPM LMS',
  },
  {
    quote: 'The facts you struggle with now may one day help you save a life.',
    author: 'ERPM LMS',
  },
];

const offlineUi = {
  rootBase: 'isolate overflow-hidden bg-[radial-gradient(circle_at_20%_12%,rgba(59,130,246,0.16),transparent_34%),radial-gradient(circle_at_82%_72%,rgba(16,185,129,0.14),transparent_32%),linear-gradient(135deg,#020617,#07111f_52%,#020617)] text-white',
  rootLive: 'fixed inset-0 z-[10000] grid place-items-center p-5',
  rootPreview: 'absolute inset-0 grid place-items-center p-5',
  glowOne: 'pointer-events-none absolute -left-16 -top-16 size-56 rounded-full bg-blue-500/25 blur-3xl',
  glowTwo: 'pointer-events-none absolute -bottom-20 -right-20 size-64 rounded-full bg-emerald-400/20 blur-3xl',
  shell: 'relative z-[1] grid w-[min(760px,100%)] gap-5 rounded-2xl border border-white/10 bg-white/[0.07] p-6 shadow-2xl backdrop-blur-2xl max-[640px]:p-5',
  loader: 'relative mx-auto grid size-28 place-items-center',
  ringOuter: 'absolute inset-0 rounded-full border border-cyan-300/25 border-t-cyan-300 animate-spin',
  ringMiddle: 'absolute inset-3 rounded-full border border-blue-300/20 border-b-blue-300 animate-[spin_1.8s_linear_infinite_reverse]',
  ringInner: 'absolute inset-6 rounded-full border border-emerald-300/20 border-l-emerald-300 animate-spin',
  pulse: 'size-5 rounded-full bg-cyan-300 shadow-[0_0_28px_rgba(103,232,249,0.75)] animate-pulse',
  copy: 'mx-auto grid max-w-[560px] gap-2 text-center',
  eyebrow: 'text-[11px] font-black uppercase tracking-[0.14em] text-cyan-200',
  quoteCard: 'rounded-2xl border border-white/10 bg-black/20 p-4 shadow-xl',
  quoteTag: 'mb-2 block text-[10.5px] font-black uppercase tracking-[0.12em] text-emerald-200',
  quote: 'm-0 grid gap-2 [&_footer]:text-xs [&_footer]:font-bold [&_footer]:text-white/45 [&_p]:m-0 [&_p]:text-[15px] [&_p]:leading-relaxed [&_p]:text-white/80',
  status: 'flex items-center justify-center gap-2 text-center text-xs font-bold text-white/55',
  dot: 'size-2 rounded-full bg-emerald-300 shadow-[0_0_0_6px_rgba(16,185,129,0.12)]',
};

function getBasePath() {
  if (PUBLIC_BASE_PATH === '/') {
    return '';
  }

  return PUBLIC_BASE_PATH.replace(/\/$/, '');
}

export function OfflineExperience({ forceVisible = false, previewClassName = '' }) {
  const [quotes, setQuotes] = useState(fallbackQuotes);
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [isOnline, setIsOnline] = useState(() => {
    if (typeof navigator === 'undefined') {
      return true;
    }

    return navigator.onLine;
  });

  useEffect(() => {
    function handleOnlineStatus() {
      setIsOnline(navigator.onLine);
    }

    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);

    return () => {
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOnlineStatus);
    };
  }, []);

  useEffect(() => {
    if (!forceVisible && isOnline) {
      return undefined;
    }

    let cancelled = false;
    const basePath = getBasePath();
    fetch(`${basePath}/offline/medical-quotes.json`)
      .then((response) => {
        if (!response.ok) {
          throw new Error('Quote cache unavailable');
        }
        return response.json();
      })
      .then((data) => {
        if (!cancelled && Array.isArray(data) && data.length > 0) {
          setQuotes(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQuotes(fallbackQuotes);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [forceVisible, isOnline]);

  useEffect(() => {
    if (isOnline || quotes.length < 2) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setQuoteIndex((current) => (current + 1) % quotes.length);
    }, 4200);

    return () => window.clearInterval(intervalId);
  }, [isOnline, quotes]);

  const activeQuote = useMemo(() => {
    if (!quotes.length) {
      return fallbackQuotes[0];
    }

    return quotes[quoteIndex % quotes.length];
  }, [quoteIndex, quotes]);

  if (!forceVisible && isOnline) {
    return null;
  }

  return (
    <section
      className={cx(
        offlineUi.rootBase,
        previewClassName ? offlineUi.rootPreview : offlineUi.rootLive,
        previewClassName
      )}
      aria-live="polite"
    >
      <div className={offlineUi.glowOne} />
      <div className={offlineUi.glowTwo} />

      <div className={offlineUi.shell}>
        <div className={offlineUi.loader} aria-hidden="true">
          <span className={offlineUi.ringOuter} />
          <span className={offlineUi.ringMiddle} />
          <span className={offlineUi.ringInner} />
          <span className={offlineUi.pulse} />
        </div>

        <div className={offlineUi.copy}>
          <span className={offlineUi.eyebrow}>Offline Study Mode</span>
          <h2 className="m-0 text-[clamp(22px,4vw,34px)] font-black leading-tight">Cached and ready while you are offline.</h2>
          <p>
            ERPM LMS is holding your installed shell in cache memory. Stay steady, breathe, and keep your momentum.
          </p>
        </div>

        <article className={offlineUi.quoteCard}>
          <span className={offlineUi.quoteTag}>Medical Motivation</span>
          <blockquote key={`${quoteIndex}-${activeQuote.quote}`} className={offlineUi.quote}>
            <p>“{activeQuote.quote}”</p>
            <footer>{activeQuote.author}</footer>
          </blockquote>
        </article>

        <div className={offlineUi.status}>
          <span className={offlineUi.dot} aria-hidden="true" />
          <span>Looping cached encouragement until your connection returns.</span>
        </div>
      </div>
    </section>
  );
}
