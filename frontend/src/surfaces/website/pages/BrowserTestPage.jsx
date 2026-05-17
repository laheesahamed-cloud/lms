import { useMemo, useState } from 'react';
import { ui } from '../../../shared/styles/tailwindClasses.js';

const DEFAULT_URL = 'https://openrouter.ai';

const browserUi = {
  page: 'mx-auto grid min-h-dvh w-full max-w-[1180px] gap-6 px-page-x py-page-y',
  hero: 'grid max-w-[760px] gap-3',
  title: 'm-0 font-display text-[clamp(30px,5vw,54px)] font-extrabold leading-tight text-ink-strong',
  text: 'm-0 text-[15px] leading-relaxed text-ink-soft',
  shell: 'overflow-hidden rounded-2xl border border-line-soft bg-surface-1 shadow-xl',
  topbar: 'flex flex-wrap items-center gap-3 border-b border-line-soft bg-surface-2 px-4 py-3',
  dots: 'flex items-center gap-1.5 [&_span]:size-3 [&_span]:rounded-full [&_span:nth-child(1)]:bg-red-400 [&_span:nth-child(2)]:bg-amber-400 [&_span:nth-child(3)]:bg-emerald-400',
  address: 'grid min-w-[240px] flex-1 grid-cols-[minmax(0,1fr)_auto] gap-2 max-[560px]:grid-cols-1',
  reload: 'min-h-control rounded-md border border-line-medium bg-surface-1 px-4 text-sm font-bold text-ink-medium shadow-xs',
  meta: 'flex flex-wrap items-center gap-2 border-b border-line-soft bg-surface-glass-subtle px-4 py-3 text-sm text-ink-soft [&_strong]:text-ink-strong',
  frameWrap: 'relative min-h-[620px] bg-surface-0 max-[760px]:min-h-[520px]',
  frame: 'absolute inset-0 z-[1] size-full border-0 bg-white',
  fallback:
    'absolute inset-x-4 bottom-4 z-[2] max-w-[680px] rounded-xl border border-line-soft bg-surface-glass-strong p-4 text-sm leading-relaxed text-ink-soft shadow-xl backdrop-blur-[14px] [&_strong]:block [&_strong]:text-ink-strong [&_p]:mb-3 [&_p]:mt-2 [&_a]:font-bold [&_a]:text-brand-primary',
};

function normalizeUrl(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    return DEFAULT_URL;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

export function BrowserTestPage() {
  const [addressInput, setAddressInput] = useState(DEFAULT_URL);
  const [currentUrl, setCurrentUrl] = useState(DEFAULT_URL);
  const [frameKey, setFrameKey] = useState(0);

  const browserHost = useMemo(() => {
    try {
      return new URL(currentUrl).host;
    } catch {
      return currentUrl;
    }
  }, [currentUrl]);

  function handleSubmit(event) {
    event.preventDefault();
    const nextUrl = normalizeUrl(addressInput);
    setAddressInput(nextUrl);
    setCurrentUrl(nextUrl);
    setFrameKey((current) => current + 1);
  }

  function handleReload() {
    setFrameKey((current) => current + 1);
  }

  return (
    <main className={browserUi.page}>
      <section className={browserUi.hero}>
        <span className={ui.eyebrow}>Browser Test</span>
        <h1 className={browserUi.title}>Embedded browser-style test page</h1>
        <p className={browserUi.text}>
          This is a sandbox page for loading external sites inside a browser-like frame. Some websites may block
          embedding with security headers, including Google properties.
        </p>
      </section>

      <section className={browserUi.shell}>
        <div className={browserUi.topbar}>
          <div className={browserUi.dots} aria-hidden="true">
            <span />
            <span />
            <span />
          </div>

          <form className={browserUi.address} onSubmit={handleSubmit}>
            <input className={ui.input}
              type="text"
              value={addressInput}
              onChange={(event) => setAddressInput(event.target.value)}
              placeholder="https://openrouter.ai"
              aria-label="Browser address"
            />
            <button className={ui.primaryAction} type="submit">Open</button>
          </form>

          <button type="button" className={browserUi.reload} onClick={handleReload}>
            Reload
          </button>
        </div>

        <div className={browserUi.meta}>
          <strong>Now trying to load:</strong> <span>{browserHost}</span>
        </div>

        <div className={browserUi.frameWrap}>
          <iframe
            key={frameKey}
            title="Browser test frame"
            src={currentUrl}
            className={browserUi.frame}
            referrerPolicy="strict-origin-when-cross-origin"
          />

          <div className={browserUi.fallback}>
            <strong>If the site stays blank or shows a browser error, it is probably blocking iframe embedding.</strong>
            <p>
              That is controlled by the external site, not by this LMS page. Google properties often block iframe
              embedding too.
            </p>
            <a href={currentUrl} target="_blank" rel="noreferrer">
              Open in new tab instead
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
