import { useEffect, useMemo, useState } from 'react';
import { getNetworkActivityCount, subscribeToNetworkActivity } from '../stores/networkActivityStore.js';
import { cx } from '../styles/tailwindClasses.js';

const SLOW_LOADING_DELAY_MS = 1400;
const QUOTE_ROTATE_MS = 3600;

const defaultQuotes = [
  {
    quote: 'The Wi-Fi is taking a long differential history, but your revision still counts.',
    author: 'xyndrome',
  },
  {
    quote: 'Even slow loading has a pulse. Hold steady, future doctor.',
    author: 'xyndrome',
  },
  {
    quote: 'This page is doing rounds through the network. Kindly maintain calm professionalism.',
    author: 'xyndrome',
  },
  {
    quote: 'If the internet needs CPR, your focus still does not.',
    author: 'xyndrome',
  },
  {
    quote: 'The server is revising at its own pace. You are still ahead by staying patient.',
    author: 'xyndrome',
  },
  {
    quote: 'Slow internet is temporary. Clinical confidence built by repetition lasts longer.',
    author: 'xyndrome',
  },
];

const slowUi = {
  rootBase: 'pointer-events-none isolate',
  rootLive: 'fixed inset-0 z-[9998] grid place-items-center p-5 max-[520px]:p-3 max-[520px]:pb-[calc(12px+env(safe-area-inset-bottom,0px))] max-[520px]:pt-[calc(12px+env(safe-area-inset-top,0px))]',
  scrim: 'absolute inset-0 bg-slate-950/35 backdrop-blur-[3px]',
  dialog: 'pointer-events-auto relative z-[1] grid w-[min(430px,100%)] gap-4 rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.92),rgba(30,41,59,0.86))] p-5 text-white shadow-2xl max-[520px]:gap-3 max-[520px]:rounded-[20px] max-[520px]:p-4',
  signal: 'flex items-end justify-center gap-1.5',
  signalBar: 'w-2 rounded-full bg-cyan-300 shadow-[0_0_16px_rgba(103,232,249,0.55)] animate-pulse',
  copy: 'grid gap-2 text-center',
  eyebrow: 'text-[11px] font-black uppercase tracking-[0.14em] text-cyan-200',
};

export function SlowNetworkExperience() {
  const [isNetworkBusy, setIsNetworkBusy] = useState(() => getNetworkActivityCount() > 0);
  const [showOverlay, setShowOverlay] = useState(false);
  const [quoteIndex, setQuoteIndex] = useState(0);
  const quotes = defaultQuotes;

  useEffect(() => subscribeToNetworkActivity((count) => setIsNetworkBusy(count > 0)), []);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setShowOverlay(false);
      return undefined;
    }

    if (!isNetworkBusy) {
      setShowOverlay(false);
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      if (getNetworkActivityCount() > 0) {
        setShowOverlay(true);
      }
    }, SLOW_LOADING_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isNetworkBusy]);

  useEffect(() => {
    if (!showOverlay || quotes.length < 2) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setQuoteIndex((current) => (current + 1) % quotes.length);
    }, QUOTE_ROTATE_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [quotes.length, showOverlay]);

  const activeQuote = useMemo(() => quotes[quoteIndex % quotes.length] || defaultQuotes[0], [quoteIndex, quotes]);

  if (!showOverlay) {
    return null;
  }

  return (
    <aside
      className={cx(slowUi.rootBase, slowUi.rootLive)}
      aria-live="polite"
      aria-atomic="true"
    >
      <div className={slowUi.scrim} />
      <div className={slowUi.dialog}>
        <div className={slowUi.signal} aria-hidden="true">
          <span className={cx(slowUi.signalBar, 'h-5')} />
          <span className={cx(slowUi.signalBar, 'h-8 [animation-delay:120ms]')} />
          <span className={cx(slowUi.signalBar, 'h-12 [animation-delay:240ms]')} />
        </div>

        <div className={slowUi.copy}>
          <span className={slowUi.eyebrow}>Slow Internet Mode</span>
          <strong className="text-lg font-black leading-tight">Still loading, but still alive.</strong>
          <p className="m-0 text-sm leading-relaxed text-white/70">{activeQuote.quote}</p>
          <small className="text-xs font-bold text-white/45">{activeQuote.author}</small>
        </div>
      </div>
    </aside>
  );
}
