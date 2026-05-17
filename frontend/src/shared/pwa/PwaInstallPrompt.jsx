import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { detectPlatform, isStandalonePwaDisplay } from '../platform/detect.js';
import { shouldShowPwaInstallPrompt } from '../platform/config.js';
import { cx, ui } from '../styles/tailwindClasses.js';

function InstallIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="4.2" y="2" width="9.6" height="14" rx="2.2" stroke="currentColor" strokeWidth="1.45" />
      <path d="M7 11.25 9 13.2l2-1.95M9 5v8" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.6 3.9h2.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity=".55" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4.5 4.5 11.5 11.5M11.5 4.5 4.5 11.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M9 11.5V2.75" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" />
      <path d="M5.75 5.75 9 2.5l3.25 3.25" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.25 8.25H4.5A1.75 1.75 0 0 0 2.75 10v3A1.75 1.75 0 0 0 4.5 14.75h9A1.75 1.75 0 0 0 15.25 13v-3a1.75 1.75 0 0 0-1.75-1.75h-.75" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" />
    </svg>
  );
}

function isStandaloneApp() {
  return isStandalonePwaDisplay();
}

function getInstallSurface() {
  const platform = detectPlatform();
  const isIOS = platform.isIos;
  const isAndroid = platform.isAndroid;
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent || '';
  const isSafari = /Safari/i.test(ua) && !/Chrome|CriOS|FxiOS|Edg/i.test(ua);
  if (isIOS && isSafari) return 'ios';
  if (isAndroid) return 'android';
  return 'browser';
}

const installUi = {
  button:
    'inline-flex h-9 min-h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-brand-primary/18 bg-[var(--color-primary-light)] px-3 text-[12px] font-extrabold text-brand-primary shadow-xs transition-[background,border-color,transform,color,box-shadow] duration-150 ease-[var(--ease-out)] hover:-translate-y-px hover:border-brand-primary/30 hover:bg-[color-mix(in_srgb,var(--color-primary)_14%,transparent)] hover:shadow-[0_8px_18px_color-mix(in_srgb,var(--color-primary)_14%,transparent)] active:translate-y-0 active:scale-[0.98] max-[520px]:size-8 max-[520px]:min-h-8 max-[520px]:min-w-8 max-[520px]:gap-0 max-[520px]:p-0 [&_span]:max-[760px]:hidden',
  backdrop: 'fixed inset-0 z-[1200] grid place-items-center bg-slate-950/45 p-5 backdrop-blur-md animate-overlayIn max-[520px]:items-end max-[520px]:p-0',
  modal:
    'motion-smooth grid w-[min(520px,100%)] max-h-[calc(100dvh-24px)] gap-5 overflow-y-auto rounded-2xl border border-line-soft bg-surface-card-elevated p-5 shadow-2xl animate-dropdownIn [-webkit-overflow-scrolling:touch] max-[520px]:max-h-[calc(100dvh-env(safe-area-inset-top,0px)-8px)] max-[520px]:gap-4 max-[520px]:rounded-b-none max-[520px]:p-4 max-[520px]:pb-[calc(16px+env(safe-area-inset-bottom,0px))]',
  top: 'flex items-start justify-between gap-4',
  mark:
    'grid size-12 shrink-0 place-items-center rounded-xl border border-brand-primary/16 bg-[var(--color-primary-light)] text-brand-primary shadow-xs max-[520px]:size-10',
  title: 'm-0 text-[21px] font-black leading-tight text-ink-strong max-[520px]:text-[18px]',
  text: 'm-0 mt-1 text-[13px] leading-relaxed text-ink-soft',
  close:
    'grid size-9 min-h-9 place-items-center rounded-lg border border-line-soft bg-surface-1 text-ink-soft transition hover:bg-surface-2 hover:text-ink-strong',
  commandGrid: 'grid gap-2',
  command:
    'grid grid-cols-[32px_minmax(0,1fr)] items-start gap-3 rounded-xl border border-line-soft bg-surface-1 px-3.5 py-3 max-[520px]:grid-cols-[28px_minmax(0,1fr)] max-[520px]:gap-2.5 max-[520px]:px-3 max-[520px]:py-2.5',
  commandIndex:
    'grid size-8 place-items-center rounded-lg bg-[var(--color-primary-light)] text-[12px] font-black text-brand-primary max-[520px]:size-7 max-[520px]:text-[10px]',
  commandTitle: 'block text-[13.5px] font-extrabold text-ink-strong',
  commandText: 'mt-0.5 block text-[12px] leading-relaxed text-ink-soft',
  iosGuide:
    'relative overflow-hidden rounded-2xl border border-brand-primary/16 bg-[linear-gradient(145deg,color-mix(in_srgb,var(--color-primary)_7%,var(--surface-card)),var(--surface-card)_58%,color-mix(in_srgb,var(--color-accent)_5%,var(--surface-card)))] p-4 shadow-sm',
  phoneFrame:
    'relative mx-auto grid min-h-[190px] w-[min(300px,100%)] overflow-hidden rounded-[28px] border border-line-medium bg-surface-card shadow-[0_18px_42px_rgba(15,23,42,0.12)] max-[520px]:min-h-[160px] max-[520px]:w-[min(260px,100%)] max-[520px]:rounded-[24px]',
  phoneScreen:
    'grid content-between gap-3 p-4 pb-3',
  phoneTop: 'grid gap-2',
  phoneBar: 'h-3 rounded-full bg-surface-3',
  phoneCard: 'h-16 rounded-xl border border-line-soft bg-surface-1',
  safariBar:
    'relative mt-auto grid grid-cols-5 items-center gap-2 rounded-2xl border border-line-soft bg-surface-1 px-3 py-2 shadow-xs',
  safariIcon:
    'grid size-8 place-items-center rounded-lg border border-line-soft bg-surface-card text-ink-soft',
  safariShare:
    'relative grid size-10 place-items-center rounded-xl border border-brand-primary/28 bg-[var(--color-primary-light)] text-brand-primary shadow-[0_8px_18px_color-mix(in_srgb,var(--color-primary)_16%,transparent)]',
  arrowWrap:
    'pointer-events-none absolute bottom-[64px] left-1/2 grid -translate-x-1/2 justify-items-center gap-1 text-brand-primary',
  arrowLabel:
    'rounded-full border border-brand-primary/20 bg-surface-card px-3 py-1 text-[11px] font-black uppercase tracking-[0.06em] shadow-sm',
  arrowLine:
    'h-8 w-px bg-brand-primary/45',
  arrowHead:
    'size-3 rotate-45 border-b-2 border-r-2 border-brand-primary',
  premiumNote:
    'rounded-xl border border-brand-accent/20 bg-[color-mix(in_srgb,var(--color-accent-light)_62%,var(--surface-card))] px-3.5 py-3 text-[12.5px] font-semibold leading-relaxed text-ink-medium max-[520px]:text-[12px]',
};

export function PwaInstallPrompt() {
  const platform = useMemo(() => detectPlatform(), []);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [open, setOpen] = useState(false);
  const [installed, setInstalled] = useState(() => isStandaloneApp());
  const [shareStatus, setShareStatus] = useState('');
  const surface = useMemo(() => getInstallSurface(), []);
  const canOpenShareMenu = surface === 'ios' && typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  useEffect(() => {
    if (!shouldShowPwaInstallPrompt(platform) || typeof window === 'undefined') return undefined;

    function handleBeforeInstallPrompt(event) {
      event.preventDefault();
      setDeferredPrompt(event);
      setInstalled(false);
    }

    function handleInstalled() {
      setInstalled(true);
      setDeferredPrompt(null);
      setOpen(false);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, [platform]);

  if (!shouldShowPwaInstallPrompt(platform)) {
    return null;
  }

  async function handleInstallClick() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice.catch(() => null);
      if (choice?.outcome === 'accepted') {
        setInstalled(true);
      }
      setDeferredPrompt(null);
      return;
    }

    setOpen(true);
  }

  async function handleShareMenuClick() {
    if (!canOpenShareMenu) {
      setShareStatus('Use Safari’s Share button shown above, then choose Add to Home Screen.');
      return;
    }

    try {
      await navigator.share({
        title: 'Install ERPM LMS',
        text: 'Install ERPM LMS as your dedicated study app.',
        url: window.location.href,
      });
      setShareStatus('If the share sheet is still open, choose Add to Home Screen to finish installing ERPM LMS.');
    } catch (error) {
      if (error?.name !== 'AbortError') {
        setShareStatus('Safari blocked the share sheet. Use the Share button shown above, then choose Add to Home Screen.');
      }
    }
  }

  if (installed) {
    return null;
  }

  const commands = surface === 'ios'
    ? [
        ['01', 'Tap the Share button', 'Use the square-with-arrow button in Safari’s bottom toolbar.'],
        ['02', 'Choose Add to Home Screen', 'Safari names the system command this way, but it creates the ERPM LMS app icon.'],
        ['03', 'Launch ERPM LMS from the icon', 'It opens as a clean app window without the normal browser chrome.'],
      ]
    : [
        ['01', 'Run Install ERPM LMS', deferredPrompt ? 'Press the button again and confirm the browser install prompt.' : 'Open the browser menu and choose Install app.'],
        ['02', 'Pin it to your device', 'Keep ERPM LMS next to your study tools for one-tap launch.'],
        ['03', 'Study in app mode', 'The LMS opens like an application, not a saved webpage or bookmark.'],
      ];

  return (
    <>
      <button type="button" className={installUi.button} onClick={handleInstallClick} aria-label="Install ERPM LMS app">
        <InstallIcon />
        <span>Install App</span>
      </button>

      {open ? createPortal(
        <div className={installUi.backdrop} onMouseDown={() => setOpen(false)}>
          <section className={installUi.modal} onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="pwa-install-title">
            <div className={installUi.top}>
              <div className="flex min-w-0 gap-3">
                <span className={installUi.mark}><InstallIcon /></span>
                <div>
                  <h2 id="pwa-install-title" className={installUi.title}>Install ERPM LMS</h2>
                  <p className={installUi.text}>Create a dedicated study app on this device, with faster launch and offline shell support.</p>
                </div>
              </div>
              <button type="button" className={installUi.close} onClick={() => setOpen(false)} aria-label="Close install instructions">
                <CloseIcon />
              </button>
            </div>

            <div className={installUi.commandGrid}>
              {surface === 'ios' ? (
                <div className={installUi.iosGuide} aria-label="Safari share button guide">
                  <div className={installUi.phoneFrame}>
                    <div className={installUi.phoneScreen}>
                      <div className={installUi.phoneTop}>
                        <span className={installUi.phoneBar} />
                        <span className={cx(installUi.phoneBar, 'w-2/3')} />
                        <span className={installUi.phoneCard} />
                      </div>
                      <div className={installUi.safariBar}>
                        <span className={installUi.safariIcon}>Aa</span>
                        <span className={installUi.safariIcon}>‹</span>
                        <span className={installUi.safariShare}>
                          <ShareIcon />
                        </span>
                        <span className={installUi.safariIcon}>□</span>
                        <span className={installUi.safariIcon}>··</span>
                      </div>
                    </div>
                    <div className={installUi.arrowWrap}>
                      <span className={installUi.arrowLabel}>Tap here</span>
                      <span className={installUi.arrowLine} />
                      <span className={installUi.arrowHead} />
                    </div>
                  </div>
                </div>
              ) : null}

              {commands.map(([index, title, body]) => (
                <div className={installUi.command} key={index}>
                  <span className={installUi.commandIndex}>{index}</span>
                  <span>
                    <strong className={installUi.commandTitle}>{title}</strong>
                    <small className={installUi.commandText}>{body}</small>
                  </span>
                </div>
              ))}
            </div>

            <div className={installUi.premiumNote}>
              This is an app install command for ERPM LMS. It is not a bookmark workflow; Safari only controls the final system confirmation.
            </div>

            {shareStatus ? (
              <p className={cx(installUi.text, 'mt-[-8px] rounded-xl border border-line-soft bg-surface-1 px-3.5 py-2 font-semibold')} aria-live="polite">
                {shareStatus}
              </p>
            ) : null}

            <div className={ui.buttonRow}>
              <button
                type="button"
                className={ui.primaryAction}
                onClick={deferredPrompt ? handleInstallClick : canOpenShareMenu ? handleShareMenuClick : () => setOpen(false)}
              >
                {deferredPrompt ? 'Install now' : canOpenShareMenu ? 'Open share menu' : 'Got it'}
              </button>
              <button type="button" className={ui.secondaryAction} onClick={() => setOpen(false)}>
                {canOpenShareMenu ? 'Got it' : 'Later'}
              </button>
            </div>
          </section>
        </div>,
        document.body
      ) : null}
    </>
  );
}
