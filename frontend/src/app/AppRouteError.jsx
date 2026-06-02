import { isRouteErrorResponse, Link, useLocation, useNavigate, useRouteError } from 'react-router-dom';

const routeErrorUi = {
  screenShell:
    'lms-route-page page page-wrapper page-content app-content w-full max-w-full min-w-0 overflow-x-hidden px-page-x pb-page-y pt-page-y text-ink-strong max-[520px]:px-3.5 max-[520px]:pb-[var(--lms-mobile-content-bottom)] max-[520px]:pt-3.5',
  eyebrow:
    'inline-block text-[11px] font-extrabold uppercase tracking-[0.13em] text-brand-primary opacity-90',
  primaryAction:
    'inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-full border border-brand-primary/18 bg-[var(--color-primary-light)] px-[18px] text-sm font-extrabold text-brand-primary no-underline shadow-none transition-[background,border-color,color,opacity,transform] duration-150 ease-[var(--ease-out)] hover:border-brand-primary/32 hover:bg-[color-mix(in_srgb,var(--color-primary)_14%,transparent)] active:scale-[0.98] active:opacity-85 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-primary/22 disabled:cursor-not-allowed disabled:scale-100 disabled:opacity-50 disabled:shadow-none max-[520px]:w-full',
  secondaryAction:
    'inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-full border border-line-medium bg-[var(--btn-secondary-bg)] px-[18px] text-sm font-extrabold text-ink-medium no-underline shadow-none transition-[background,border-color,color,opacity,transform] duration-150 ease-[var(--ease-out)] hover:border-brand-primary/28 hover:bg-[var(--color-primary-light)] hover:text-brand-primary active:scale-[0.98] active:opacity-85 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-primary/18 disabled:cursor-not-allowed disabled:scale-100 disabled:opacity-50 disabled:shadow-none max-[520px]:w-full',
};

export function AppRouteError() {
  const error = useRouteError();
  const location = useLocation();
  const navigate = useNavigate();

  const title = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText || 'Route error'}`
    : 'Application error';

  const message = isRouteErrorResponse(error)
    ? error.data?.message || 'The requested screen could not be loaded.'
    : error instanceof Error
      ? error.message
      : 'Something unexpected happened while loading the app.';

  return (
    <main className={routeErrorUi.screenShell}>
      <section className="mx-auto grid w-[min(720px,100%)] gap-4 rounded-xl border border-line-soft bg-surface-glass-strong p-9 text-center shadow-xl backdrop-blur-[18px]">
        <span className={routeErrorUi.eyebrow}>LMS Rebuild</span>
        <h1 className="m-0 font-display text-[36px] max-[640px]:text-[28px] font-extrabold leading-tight text-ink-strong">{title}</h1>
        <p className="m-0 text-[15px] leading-relaxed text-ink-soft">{message}</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            className={routeErrorUi.primaryAction}
            type="button"
            onClick={() => navigate(`${location.pathname}${location.search}${location.hash}`, { replace: true })}
          >
            Retry screen
          </button>
          <Link className={routeErrorUi.secondaryAction} to="/auth/login">
            Back to login
          </Link>
        </div>
      </section>
    </main>
  );
}
