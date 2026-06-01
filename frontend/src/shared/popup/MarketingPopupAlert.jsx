import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { fetchPublicSettings } from '../api/settings.api.js';
import { ui } from '../styles/tailwindClasses.js';
import { getSafeExternalUrl, getSafeInternalPath } from '../utils/linkSafety.js';
import { resolvePublicAssetUrl } from '../utils/publicAssetUrl.js';

const POPUP_DISMISS_PREFIX = 'lms_popup_alert_dismissed';
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
    alert?.buttonUrl,
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
  return Boolean(alert?.title || alert?.body || alert?.imageUrl);
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

export function MarketingPopupAlert({ suppressed = false }) {
  const location = useLocation();
  const navigate = useNavigate();
  const closeButtonRef = useRef(null);
  const [alert, setAlert] = useState(null);
  const [dismissedKey, setDismissedKey] = useState('');
  const [loaded, setLoaded] = useState(false);

  const imageUrl = useMemo(() => resolvePublicAssetUrl(alert?.imageUrl), [alert?.imageUrl]);
  const internalButtonPath = useMemo(() => getSafeInternalPath(alert?.buttonUrl), [alert?.buttonUrl]);
  const externalButtonUrl = useMemo(
    () => internalButtonPath ? '' : getSafeExternalUrl(alert?.buttonUrl),
    [alert?.buttonUrl, internalButtonPath]
  );
  const ctaLabel = String(alert?.buttonLabel || '').trim();
  const dismissKey = useMemo(() => getDismissKey(alert), [alert]);
  const shouldOpen =
    !suppressed &&
    loaded &&
    alert?.enabled &&
    hasPopupContent(alert) &&
    shouldShowForPath(alert, location.pathname) &&
    dismissedKey !== dismissKey &&
    !readDismissed(dismissKey);

  useEffect(() => {
    let cancelled = false;

    async function loadPopupAlert({ force = false } = {}) {
      try {
        const settings = await fetchPublicSettings({ force });
        if (cancelled) return;
        setAlert(settings?.popupAlert || { enabled: false });
      } catch {
        if (!cancelled) {
          setAlert({ enabled: false });
        }
      } finally {
        if (!cancelled) {
          setLoaded(true);
        }
      }
    }

    loadPopupAlert();
    const refreshPopupAlert = () => loadPopupAlert({ force: true });
    window.addEventListener?.('lms:popup-alert-refresh', refreshPopupAlert);
    return () => {
      cancelled = true;
      window.removeEventListener?.('lms:popup-alert-refresh', refreshPopupAlert);
    };
  }, []);

  useEffect(() => {
    if (!shouldOpen) return;
    const frame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [shouldOpen, dismissKey]);

  function closePopup() {
    writeDismissed(dismissKey);
    setDismissedKey(dismissKey);
  }

  function handleCtaClick(event) {
    closePopup();
    if (internalButtonPath) {
      event.preventDefault();
      navigate(internalButtonPath);
    }
  }

  if (!shouldOpen || typeof document === 'undefined') {
    return null;
  }

  const modal = (
    <div className={cx(ui.modalBackdrop, 'z-[220] px-4')} role="presentation">
      <section
        className="lms-modal-panel grid w-[min(560px,100%)] max-h-[min(88vh,760px)] overflow-hidden rounded-xl border border-line-soft bg-surface-card-elevated shadow-[var(--ds-floating-shadow)] animate-scaleIn"
        role="dialog"
        aria-modal="true"
        aria-labelledby={alert.title ? 'marketing-popup-title' : undefined}
        aria-label={alert.title ? undefined : 'Popup alert'}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line-soft px-5 py-4">
          <div className="min-w-0">
            <span className="text-[10.5px] font-extrabold uppercase tracking-[0.1em] text-brand-primary">Announcement</span>
            {alert.title ? (
              <h2 id="marketing-popup-title" className="m-0 mt-1 text-[22px] font-black leading-tight text-ink-strong">
                {alert.title}
              </h2>
            ) : null}
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="grid size-10 shrink-0 place-items-center rounded-md border border-line-soft bg-surface-1 text-ink-soft transition hover:bg-surface-2 hover:text-ink-strong focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-primary/18"
            aria-label="Close popup"
            onClick={closePopup}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="grid gap-4 overflow-y-auto px-5 py-5">
          {imageUrl ? (
            <img
              className="block aspect-video w-full rounded-lg border border-line-soft bg-surface-1 object-cover"
              src={imageUrl}
              alt={alert.imageAlt || alert.title || 'Popup alert image'}
            />
          ) : null}
          {alert.body ? (
            <p className="m-0 whitespace-pre-wrap text-[14px] font-medium leading-relaxed text-ink-medium">
              {alert.body}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-line-soft px-5 py-4">
          <button type="button" className={ui.secondaryAction} onClick={closePopup}>
            Close
          </button>
          {ctaLabel && (internalButtonPath || externalButtonUrl) ? (
            <a
              className={ui.primaryAction}
              href={internalButtonPath || externalButtonUrl}
              target={externalButtonUrl ? '_blank' : undefined}
              rel={externalButtonUrl ? 'noreferrer' : undefined}
              onClick={handleCtaClick}
            >
              {ctaLabel}
            </a>
          ) : null}
        </div>
      </section>
    </div>
  );

  return createPortal(modal, document.body);
}
