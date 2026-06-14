import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { getErrorMessage } from '../../../shared/api/client.js';
import { requestPasswordReset } from '../../../shared/api/auth.api.js';
import { XyndromeBrand } from '../../../shared/brand/XyndromeBrand.jsx';
import { ThemeToggle } from '../../../shared/layout/ThemeToggle.jsx';
import { withRouterBasename } from '../../../shared/platform/config.js';
import { PageMeta } from '../../../shared/seo/PageMeta.jsx';
import { cx, ui } from '../../../shared/styles/tailwindClasses.js';
import { AuthFeedbackNotice } from './AuthFeedbackNotice.jsx';

function AuthLogo() {
  return (
    <XyndromeBrand markSize={34} textClassName="!font-extrabold" />
  );
}

export function ForgotPasswordPage() {
  const [status, setStatus] = useState({ loading: false, error: '', success: '', resetPath: '' });

  async function handleSubmit(event) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    setStatus({ loading: true, error: '', success: '', resetPath: '' });

    try {
      const data = await requestPasswordReset({ email: String(fd.get('email') || '') });
      setStatus({
        loading: false,
        error: '',
        success: data.message || 'Password reset link created.',
        resetPath: data.resetPath || '',
      });
    } catch (error) {
      setStatus({
        loading: false,
        error: getErrorMessage(error, 'Unable to create reset link'),
        success: '',
        resetPath: '',
      });
    }
  }

  const resetHref = status.resetPath ? withRouterBasename(status.resetPath) : '';
  const feedbackId = status.error ? 'forgot-password-error' : status.success ? 'forgot-password-success' : undefined;
  const clearFeedback = () => setStatus((current) => ({ ...current, error: '', success: '' }));

  return (
    <main className={ui.authRouteScene} style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 'clamp(18px,4vw,44px)', background: 'var(--page-background)' }}>
      <PageMeta
        title="Reset Password"
        description="Request a secure password reset link for your xyndrome student or admin account."
        path="/auth/forgot-password"
        noindex
      />
      <div className="absolute right-5 top-5"><ThemeToggle /></div>
      <section className="lms-form-card" style={{ width: 'min(100%, 430px)', borderRadius: 22, border: '1px solid var(--line-soft)', background: 'var(--surface-card)', padding: 'clamp(24px,4vw,34px)', boxShadow: '0 18px 46px rgba(15,23,42,.10)' }}>
        <div className="mb-7"><AuthLogo /></div>
        <form onSubmit={handleSubmit} className="grid gap-5" aria-describedby={feedbackId}>
          <div>
            <p style={{ margin: '0 0 9px', fontSize: 11, fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '.13em' }}>Password help</p>
            <h1 style={{ margin: '0 0 8px', fontSize: 'clamp(24px,3vw,32px)', fontWeight: 900, lineHeight: 1.1, color: 'var(--ink-strong)' }}>Reset your password</h1>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.62 }}>Enter your account email and we’ll create a secure reset link.</p>
          </div>

          {status.error ? (
            <AuthFeedbackNotice id="forgot-password-error" tone="error" onDismiss={clearFeedback}>
              {status.error}
            </AuthFeedbackNotice>
          ) : null}
          {status.success ? (
            <AuthFeedbackNotice id="forgot-password-success" tone="success" onDismiss={clearFeedback}>
              {status.success}
            </AuthFeedbackNotice>
          ) : null}

          {resetHref ? (
            <div className="grid gap-2 rounded-xl border border-brand-primary/20 bg-[var(--color-primary-light)] p-3 text-[13px] text-ink-medium">
              <span className="font-bold text-ink-strong">Local reset link</span>
              <NavLink to={status.resetPath} className="break-all font-bold text-brand-primary no-underline hover:underline">
                {resetHref}
              </NavLink>
            </div>
          ) : null}

          <label className={cx(ui.formLabel, 'grid gap-1.5')} htmlFor="forgot-password-email">
            Email address
            <input id="forgot-password-email" className={ui.input} name="email" type="email" placeholder="you@example.com" autoComplete="email" required aria-invalid={status.error ? 'true' : undefined} aria-describedby={feedbackId} />
          </label>

          <button type="submit" disabled={status.loading} className={cx(ui.primaryAction, 'min-h-12 w-full rounded-[var(--radius-md)] disabled:cursor-progress')}>
            {status.loading ? 'Creating link...' : 'Create reset link'}
          </button>

          <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--ink-soft)', margin: 0 }}>
            Remembered it?{' '}
            <NavLink to="/login" className="font-bold text-brand-primary no-underline hover:underline">Sign in</NavLink>
          </p>
        </form>
      </section>
    </main>
  );
}
