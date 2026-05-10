import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom';
import { ui } from '../styles/tailwindClasses.js';

export function AppRouteError() {
  const error = useRouteError();

  const title = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText || 'Route error'}`
    : 'Application error';

  const message = isRouteErrorResponse(error)
    ? error.data?.message || 'The requested screen could not be loaded.'
    : error instanceof Error
      ? error.message
      : 'Something unexpected happened while loading the app.';

  return (
    <main className={ui.screenShell}>
      <section className="mx-auto grid w-[min(720px,100%)] gap-4 rounded-xl border border-line-soft bg-surface-glass-strong p-9 text-center shadow-xl backdrop-blur-[18px]">
        <span className={ui.eyebrow}>LMS Rebuild</span>
        <h1 className="m-0 font-display text-[clamp(28px,4vw,44px)] font-extrabold leading-tight text-ink-strong">{title}</h1>
        <p className="m-0 text-[15px] leading-relaxed text-ink-soft">{message}</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button className={ui.primaryAction} type="button" onClick={() => window.location.reload()}>
            Reload page
          </button>
          <Link className={ui.secondaryAction} to="/auth/login">
            Back to login
          </Link>
        </div>
      </section>
    </main>
  );
}
