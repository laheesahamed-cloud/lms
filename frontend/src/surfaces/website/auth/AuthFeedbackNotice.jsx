import { cx, ui } from '../../../shared/styles/tailwindClasses.js';

export function AuthFeedbackNotice({ id, tone = 'error', children, onDismiss }) {
  const baseClass = tone === 'success' ? ui.feedbackSuccess : ui.feedbackError;
  const role = tone === 'success' ? 'status' : 'alert';
  const ariaLive = tone === 'success' ? 'polite' : 'assertive';

  return (
    <div
      id={id}
      className={cx(
        baseClass,
        'grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 pr-2 max-[420px]:top-[calc(env(safe-area-inset-top,0px)+12px)] max-[420px]:w-[calc(100vw-20px)] max-[420px]:max-w-[calc(100vw-20px)] max-[420px]:px-3 max-[420px]:py-2.5 max-[420px]:text-[12.5px]'
      )}
      role={role}
      aria-live={ariaLive}
    >
      <span className="min-w-0 whitespace-normal break-words leading-normal">{children}</span>
      <button
        type="button"
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-current/20 bg-transparent text-[18px] font-black leading-none text-inherit opacity-75 transition-[background,opacity,transform] duration-150 ease-[var(--ease-out)] hover:bg-current/10 hover:opacity-100 active:scale-[0.96] max-[420px]:size-7"
        onClick={onDismiss}
        aria-label="Close notification"
      >
        x
      </button>
    </div>
  );
}
