import { Link } from 'react-router-dom';
import { ui } from '../styles/tailwindClasses.js';

export function NotFoundPage() {
  return (
    <main className={ui.screenShell}>
      <section className="mx-auto grid w-[min(720px,100%)] gap-4 rounded-xl border border-line-soft bg-surface-glass-strong p-9 text-center shadow-xl backdrop-blur-[18px]">
        <span className={ui.eyebrow}>LMS Rebuild</span>
        <h1 className="m-0 font-display text-[36px] max-[640px]:text-[28px] font-extrabold leading-tight text-ink-strong">Page not found</h1>
        <p className="m-0 text-[15px] leading-relaxed text-ink-soft">The screen you requested is not available in the migrated app yet, or the link is invalid.</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link className={ui.secondaryAction} to="/">
            Go home
          </Link>
          <Link className={ui.secondaryAction} to="/auth/login">
            Open login
          </Link>
        </div>
      </section>
    </main>
  );
}
