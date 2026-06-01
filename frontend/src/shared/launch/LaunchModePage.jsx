import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { verifyAvailabilityUnlockCode } from '../api/settings.api.js';
import { XyndromeLogoMark } from '../brand/XyndromeBrand.jsx';
import { safeNavigateBack } from '../routing/safeBack.js';
import { rememberLaunchAdminUnlock } from './launchUnlock.js';

const UNLOCK_BUFFER_LENGTH = 40;
const MIN_UNLOCK_CODE_LENGTH = 4;

const variants = {
  maintenance: {
    eyebrow: 'Maintenance',
    title: 'Maintenance',
    body: 'We are making a few updates to the learning workspace. Please check back soon.',
    footnote: 'Website, student app, and native apps are paused.',
    badgeClass: 'border-brand-warning/28 bg-[var(--color-warning-light)] text-brand-warning',
  },
  'coming-soon': {
    eyebrow: 'Launching soon',
    title: 'Coming Soon',
    body: 'This website is getting ready for launch. The full study platform will open shortly.',
    footnote: 'Public website only.',
    badgeClass: 'border-brand-primary/24 bg-[var(--color-primary-light)] text-brand-primary',
  },
};

function getVariant(mode) {
  return variants[mode] || variants.maintenance;
}

export function LaunchModePage({ mode = 'maintenance', preview = false, adminUnlockHref = '' }) {
  const variant = getVariant(mode);
  const navigate = useNavigate();
  const secretInputRef = useRef(null);
  const unlockBufferRef = useRef('');
  const unlockedRef = useRef(false);
  const unlockAttemptIdRef = useRef(0);
  const canClose = preview && typeof window !== 'undefined' && window.opener;
  const effectiveAdminUnlockHref = preview ? '' : adminUnlockHref;

  const tryUnlock = useCallback((value) => {
    if (!effectiveAdminUnlockHref || unlockedRef.current) return;

    const digits = String(value || '').replace(/\D/g, '');
    if (!digits) return;

    const nextBuffer = `${unlockBufferRef.current}${digits}`.slice(-UNLOCK_BUFFER_LENGTH);
    unlockBufferRef.current = nextBuffer;
    if (nextBuffer.length < MIN_UNLOCK_CODE_LENGTH) return;

    const attemptId = unlockAttemptIdRef.current + 1;
    unlockAttemptIdRef.current = attemptId;

    verifyAvailabilityUnlockCode({ code: nextBuffer })
      .then((result) => {
        if (unlockAttemptIdRef.current !== attemptId || unlockedRef.current || !result?.ok) return;
        unlockedRef.current = true;
        unlockBufferRef.current = '';
        rememberLaunchAdminUnlock();
        navigate(effectiveAdminUnlockHref);
      })
      .catch(() => {});
  }, [effectiveAdminUnlockHref, navigate]);

  useEffect(() => {
    if (!effectiveAdminUnlockHref || typeof window === 'undefined') return undefined;

    const handleKeyDown = (event) => {
      if (event.target === secretInputRef.current) return;
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;

      if (/^\d$/.test(event.key)) {
        tryUnlock(event.key);
        return;
      }

      if (event.key === 'Backspace') {
        unlockBufferRef.current = unlockBufferRef.current.slice(0, -1);
      } else if (event.key === 'Escape') {
        unlockBufferRef.current = '';
      }
    };

    const handlePaste = (event) => {
      tryUnlock(event.clipboardData?.getData('text') || '');
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('paste', handlePaste);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('paste', handlePaste);
    };
  }, [effectiveAdminUnlockHref, tryUnlock]);

  function focusSecretInput() {
    if (!effectiveAdminUnlockHref) return;
    secretInputRef.current?.focus({ preventScroll: true });
  }

  return (
    <main
      className="launch-mode-page relative isolate min-h-dvh overflow-x-hidden px-5 py-[calc(env(safe-area-inset-top,0px)+28px)] text-ink-strong"
      data-mode={mode}
      onPointerDown={focusSecretInput}
      style={{ background: 'var(--app-bg, var(--page-background, #dce6f4))' }}
    >
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.42] [background-image:linear-gradient(color-mix(in_srgb,var(--color-primary)_7%,transparent)_1px,transparent_1px),linear-gradient(90deg,color-mix(in_srgb,var(--color-primary)_7%,transparent)_1px,transparent_1px)] [background-size:32px_32px]"
        aria-hidden="true"
      />
      {effectiveAdminUnlockHref ? (
        <input
          ref={secretInputRef}
          aria-label="Unlock code"
          autoComplete="off"
          className="pointer-events-none fixed left-0 top-0 h-px w-px border-0 bg-transparent p-0 opacity-0 outline-none"
          inputMode="numeric"
          onChange={(event) => {
            tryUnlock(event.target.value);
            event.target.value = '';
          }}
          tabIndex={-1}
          type="text"
        />
      ) : null}

      <section className="mx-auto grid min-h-[calc(var(--lms-app-viewport-height,100dvh)-56px)] w-full max-w-[900px] grid-rows-[1fr_auto] place-items-center text-center">
        <div className="grid max-w-[780px] justify-items-center gap-5">
          <div className="mb-2 inline-flex max-w-full flex-wrap items-center justify-center gap-3 sm:gap-4" role="img" aria-label="xyndrome">
            <XyndromeLogoMark size={76} decorative />
            <span
              className="font-display text-[clamp(3rem,11vw,7rem)] font-black leading-none tracking-normal"
              style={{
                color: 'var(--ink-strong)',
                backgroundImage: 'var(--brand-gradient-primary, linear-gradient(135deg, var(--color-primary), var(--color-accent)))',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              xyndrome
            </span>
          </div>
          <p className={`m-0 inline-flex rounded-full border px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.12em] ${variant.badgeClass}`}>
            {preview ? 'Preview' : variant.eyebrow}
          </p>
          <h1 className="m-0 max-w-full font-display text-[3.2rem] font-black leading-none tracking-normal text-ink-strong sm:text-[5rem] lg:text-[7rem]">
            {variant.title}
          </h1>
          <p className="m-0 max-w-[560px] text-base font-semibold leading-relaxed text-ink-soft sm:text-lg">
            {variant.body}
          </p>

          {preview ? (
            <button
              className="mt-4 inline-flex min-h-11 items-center justify-center rounded-md border border-line-medium bg-surface-card px-4 text-sm font-extrabold text-ink-strong shadow-[var(--ds-card-shadow)] transition-[border-color,background,transform] duration-150 ease-[var(--ease-out)] hover:-translate-y-px hover:border-brand-primary/28 hover:bg-[var(--color-primary-light)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/24 active:scale-[0.98]"
              type="button"
              onClick={() => (canClose ? window.close() : safeNavigateBack(navigate, { fallbackPath: '/' }))}
            >
              {canClose ? 'Close preview' : 'Go back'}
            </button>
          ) : null}
        </div>

        <p className="m-0 pb-1 text-[12px] font-semibold text-ink-muted">
          {variant.footnote}
        </p>
      </section>
    </main>
  );
}
