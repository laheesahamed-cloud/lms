import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { cx, ui } from '../styles/tailwindClasses.js';

const screenToneClass = {
  error: ui.feedbackError,
  info: ui.feedbackInfo,
  success: ui.feedbackSuccess,
  warning: ui.warningFeedback,
};

const toastToneClass = {
  error: ui.toastError,
  info: ui.toastInfo,
  success: ui.toastSuccess,
  warning: ui.toastWarning,
};

function getRole(tone) {
  return tone === 'error' ? 'alert' : 'status';
}

function getAriaLive(tone) {
  return tone === 'error' ? 'assertive' : 'polite';
}

export function FeedbackNotice({
  id,
  tone = 'info',
  variant = 'screen',
  children,
  className = '',
  onDismiss,
  resetKey,
  role,
  ariaLive,
}) {
  const messageKey = useMemo(() => {
    if (resetKey !== undefined) return resetKey;
    if (typeof children === 'string') return children;
    return id || tone;
  }, [children, id, resetKey, tone]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(false);
  }, [messageKey]);

  if (dismissed || children === null || children === undefined || children === '') {
    return null;
  }

  const normalizedTone = screenToneClass[tone] ? tone : 'info';
  const toneClass = variant === 'toast'
    ? toastToneClass[normalizedTone]
    : screenToneClass[normalizedTone];
  const baseClass = variant === 'toast' ? ui.toast : toneClass;

  function handleDismiss() {
    setDismissed(true);
    onDismiss?.();
  }

  const notice = (
    <div
      id={id}
      className={cx(
        baseClass,
        variant === 'toast' && toneClass,
        'lms-feedback-notice',
        `lms-feedback-notice--${normalizedTone}`,
        className
      )}
      role={role || getRole(normalizedTone)}
      aria-live={ariaLive || getAriaLive(normalizedTone)}
    >
      <span className="lms-feedback-notice__icon" aria-hidden="true">
        <span className="lms-feedback-notice__glyph" />
      </span>
      <span className="lms-feedback-notice__body">{children}</span>
      <button
        type="button"
        className="lms-feedback-notice__close"
        onClick={handleDismiss}
        aria-label="Close notification"
      >
        <span aria-hidden="true" />
      </button>
    </div>
  );

  if (variant === 'screen' && typeof document !== 'undefined') {
    return createPortal(notice, document.body);
  }

  return notice;
}
