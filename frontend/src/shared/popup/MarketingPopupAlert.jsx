import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { fetchPublicSettings } from '../api/settings.api.js';
import { ui } from '../styles/tailwindClasses.js';
import { resolvePublicAssetUrl } from '../utils/publicAssetUrl.js';

const POPUP_DISMISS_PREFIX = 'lms_popup_alert_dismissed';
const POPUP_CACHE_KEY = 'lms_popup_alert_public_cache';
const POPUP_API_MANIFEST_URL = '/api/uploads/marketing-popups/popup-alert.json';
const POPUP_MANIFEST_TIMEOUT_MS = 1200;
const websiteProtectedPathPattern =
  /^\/(?:dashboard|pending|profile|courses|structure|users|questions|question-reports|quizzes|exams|subscriptions|finance|billing|bookmarks|notifications|planner|flashcards|notes|study|ai-notes|results|review|announcements|reports|setup|settings)(?:\/|$)/;

function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

function normalizePlacement(value) {
  const placement = String(value || '').trim().toLowerCase();
  return ['landing', 'login', 'app', 'all'].includes(placement) ? placement : 'landing';
}

function getContentKey(alert) {
  return [
    alert?.version,
    alert?.placement,
    alert?.title,
    alert?.body,
    alert?.imageUrl,
  ].filter(Boolean).join('|') || 'current';
}

function getDismissKey(alert) {
  return `${POPUP_DISMISS_PREFIX}:${normalizePlacement(alert?.placement)}:${getContentKey(alert)}`;
}

function isLandingPath(pathname) {
  return pathname === '/' || pathname === '';
}

function isLoginPath(pathname) {
  return pathname === '/login' || pathname === '/auth/login';
}

function isAppPath(pathname) {
  if (/^\/(?:admin|app|student)(?:\/|$)/.test(pathname)) return true;
  return websiteProtectedPathPattern.test(pathname);
}

function shouldShowForPath(alert, pathname) {
  const placement = normalizePlacement(alert?.placement);
  if (placement === 'all') return true;
  if (placement === 'landing') return isLandingPath(pathname);
  if (placement === 'login') return isLoginPath(pathname);
  return isAppPath(pathname);
}

function hasPopupContent(alert) {
  return Boolean(alert?.imageUrl);
}

function getSiteBasePath() {
  const base = String(import.meta.env.BASE_URL || '/').replace(/\/?$/, '/');
  return base.endsWith('/frontend/dist/')
    ? base.slice(0, -'frontend/dist/'.length)
    : base;
}

function getStaticPopupManifestUrl() {
  return `${getSiteBasePath()}uploads/marketing-popups/popup-alert.json`;
}

function readDismissed(key) {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeDismissed(key) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(key, '1');
  } catch {
    // The popup can still close even when browser storage is unavailable.
  }
}

function readCachedPopupAlert() {
  if (typeof window === 'undefined') return null;
  try {
    const cached = JSON.parse(window.localStorage.getItem(POPUP_CACHE_KEY) || 'null');
    return cached && typeof cached === 'object' ? cached : null;
  } catch {
    return null;
  }
}

function writeCachedPopupAlert(alert) {
  if (typeof window === 'undefined') return;
  try {
    if (!alert || typeof alert !== 'object') {
      window.localStorage.removeItem(POPUP_CACHE_KEY);
      return;
    }
    window.localStorage.setItem(POPUP_CACHE_KEY, JSON.stringify(alert));
  } catch {
    // The live settings fetch remains the source of truth if local storage is unavailable.
  }
}

async function fetchJsonWithTimeout(url, timeoutMs) {
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timerId = controller
    ? window.setTimeout(() => controller.abort(), timeoutMs)
    : 0;

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: controller?.signal,
    });
    if (!response.ok) return null;
    return response.json();
  } finally {
    if (timerId) {
      window.clearTimeout(timerId);
    }
  }
}

export function MarketingPopupAlert({ suppressed = false }) {
  const location = useLocation();
  const closeButtonRef = useRef(null);
  const initialAlert = useMemo(() => readCachedPopupAlert(), []);
  const [alert, setAlert] = useState(initialAlert);
  const [dismissedKey, setDismissedKey] = useState('');
  const [loaded, setLoaded] = useState(() => Boolean(initialAlert));
  const [landingReadStarted, setLandingReadStarted] = useState(false);

  const imageUrl = useMemo(() => resolvePublicAssetUrl(alert?.imageUrl), [alert?.imageUrl]);
  const dismissKey = useMemo(() => getDismissKey(alert), [alert]);
  const shouldOpen =
    !suppressed &&
    (normalizePlacement(alert?.placement) !== 'landing' || landingReadStarted) &&
    loaded &&
    alert?.enabled &&
    hasPopupContent(alert) &&
    shouldShowForPath(alert, location.pathname) &&
    dismissedKey !== dismissKey &&
    !readDismissed(dismissKey);

  const closePopup = useCallback(() => {
    writeDismissed(dismissKey);
    setDismissedKey(dismissKey);
  }, [dismissKey]);

  useEffect(() => {
    let cancelled = false;

    function applyPopupAlert(nextAlert) {
      setAlert(nextAlert);
      writeCachedPopupAlert(nextAlert);
      setLoaded(true);
    }

    async function loadPopupAlertManifest() {
      const manifestUrls = [getStaticPopupManifestUrl(), resolvePublicAssetUrl(POPUP_API_MANIFEST_URL)]
        .filter(Boolean);

      try {
        for (const manifestUrl of manifestUrls) {
          const nextAlert = await fetchJsonWithTimeout(manifestUrl, POPUP_MANIFEST_TIMEOUT_MS);
          if (!nextAlert) continue;
          if (cancelled || !nextAlert || typeof nextAlert !== 'object') return;
          applyPopupAlert(nextAlert);
          return;
        }
      } catch {
        // The settings API below remains the fallback when the static manifest is unavailable.
      }
    }

    async function loadPopupAlertSettings({ force = false } = {}) {
      try {
        const settings = await fetchPublicSettings({ force });
        if (cancelled) return;
        const nextAlert = settings?.popupAlert || { enabled: false };
        applyPopupAlert(nextAlert);
      } catch {
        if (!cancelled) {
          setAlert((current) => current || { enabled: false });
        }
      } finally {
        if (!cancelled) {
          setLoaded(true);
        }
      }
    }

    const startupDelay = isLoginPath(window.location.pathname || '') ? 300 : 0;
    const startupTimer = window.setTimeout(() => {
      loadPopupAlertManifest();
      loadPopupAlertSettings();
    }, startupDelay);
    const refreshPopupAlert = () => {
      loadPopupAlertManifest();
      loadPopupAlertSettings({ force: true });
    };
    window.addEventListener?.('lms:popup-alert-refresh', refreshPopupAlert);
    return () => {
      cancelled = true;
      window.clearTimeout(startupTimer);
      window.removeEventListener?.('lms:popup-alert-refresh', refreshPopupAlert);
    };
  }, []);

  useEffect(() => {
    if (!shouldShowForPath(alert, location.pathname) || normalizePlacement(alert?.placement) !== 'landing') {
      setLandingReadStarted(true);
      return undefined;
    }
    if (typeof window === 'undefined') return undefined;
    const markReadStarted = () => setLandingReadStarted(true);
    const timer = window.setTimeout(markReadStarted, 9000);
    window.addEventListener('scroll', markReadStarted, { passive: true, once: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('scroll', markReadStarted);
    };
  }, [alert, location.pathname]);

  useEffect(() => {
    if (!shouldOpen) return;
    const frame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus({ preventScroll: true });
    });
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        closePopup();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [shouldOpen, closePopup]);

  if (!shouldOpen || typeof document === 'undefined') {
    return null;
  }

  const modal = (
    <div className={cx(ui.modalBackdrop, 'z-[220] px-4')} role="presentation">
      <section
        className="lms-modal-panel relative grid w-[min(560px,100%)] max-h-[min(88vh,760px)] overflow-hidden rounded-xl border border-line-soft bg-surface-card-elevated shadow-[var(--ds-floating-shadow)] animate-scaleIn"
        role="dialog"
        aria-modal="true"
        aria-labelledby={alert.title ? 'marketing-popup-title' : undefined}
        aria-label={alert.title ? undefined : alert.imageAlt || 'Popup alert'}
      >
        <button
          ref={closeButtonRef}
          type="button"
          className="absolute right-3 top-3 z-10 grid size-10 shrink-0 place-items-center rounded-md border border-line-soft bg-surface-card/95 text-ink-soft shadow-sm transition-[background,color,transform] duration-150 ease-[var(--ease-out)] hover:bg-surface-1 hover:text-ink-strong active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-primary/18"
          aria-label="Close popup"
          onClick={closePopup}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>

        <div className="grid gap-4 overflow-y-auto p-5">
          {imageUrl ? (
            <img
              className="block aspect-video w-full rounded-lg border border-line-soft bg-surface-1 object-cover"
              src={imageUrl}
              alt={alert.imageAlt || alert.title || 'Popup alert image'}
            />
          ) : null}
          {alert.title ? (
            <h2 id="marketing-popup-title" className="m-0 text-[22px] font-black leading-tight text-ink-strong">
              {alert.title}
            </h2>
          ) : null}
          {alert.body ? (
            <p className="m-0 whitespace-pre-wrap text-[14px] font-medium leading-relaxed text-ink-medium">
              {alert.body}
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );

  return createPortal(modal, document.body);
}
