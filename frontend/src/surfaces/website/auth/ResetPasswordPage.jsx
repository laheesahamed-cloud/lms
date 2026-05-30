import { useMemo, useState } from 'react';
import { NavLink, useSearchParams } from 'react-router-dom';
import { getErrorMessage } from '../../../shared/api/client.js';
import { resetPassword } from '../../../shared/api/auth.api.js';
import { ThemeToggle } from '../../../shared/layout/ThemeToggle.jsx';
import { cx, ui } from '../../../shared/styles/tailwindClasses.js';
import { PasswordField } from '../../../shared/ui/PasswordField.jsx';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get('token') || '', [searchParams]);
  const [status, setStatus] = useState({ loading: false, error: '', success: '' });

  async function handleSubmit(event) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    setStatus({ loading: true, error: '', success: '' });

    try {
      const data = await resetPassword({
        token,
        newPassword: String(fd.get('newPassword') || ''),
        confirmPassword: String(fd.get('confirmPassword') || ''),
      });
      event.currentTarget.reset();
      setStatus({ loading: false, error: '', success: data.message || 'Password updated.' });
    } catch (error) {
      setStatus({ loading: false, error: getErrorMessage(error, 'Unable to reset password'), success: '' });
    }
  }

  return (
    <main className={ui.authRouteScene} style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 'clamp(18px,4vw,44px)', background: 'var(--page-background)' }}>
      <div className="absolute right-5 top-5"><ThemeToggle /></div>
      <section className="lms-form-card" style={{ width: 'min(100%, 430px)', borderRadius: 22, border: '1px solid var(--line-soft)', background: 'var(--surface-card)', padding: 'clamp(24px,4vw,34px)', boxShadow: '0 18px 46px rgba(15,23,42,.10)' }}>
        <form onSubmit={handleSubmit} className="grid gap-5">
          <div>
            <p style={{ margin: '0 0 9px', fontSize: 11, fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '.13em' }}>New password</p>
            <h1 style={{ margin: '0 0 8px', fontSize: 'clamp(24px,3vw,32px)', fontWeight: 900, lineHeight: 1.1, color: 'var(--ink-strong)' }}>Choose a new password</h1>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.62 }}>Use at least 10 characters with uppercase, lowercase, and a number.</p>
          </div>

          {!token && <div className={ui.feedbackError}>Reset token is missing. Create a fresh reset link.</div>}
          {status.error && <div className={ui.feedbackError}>{status.error}</div>}
          {status.success && <div className={ui.feedbackSuccess}>{status.success}</div>}

          <PasswordField
            label="New password"
            name="newPassword"
            autoComplete="new-password"
            minLength={10}
            required
            disabled={!token || Boolean(status.success)}
            labelClassName="grid gap-1.5"
          />

          <PasswordField
            label="Confirm new password"
            name="confirmPassword"
            autoComplete="new-password"
            minLength={10}
            required
            disabled={!token || Boolean(status.success)}
            labelClassName="grid gap-1.5"
          />

          <button type="submit" disabled={!token || status.loading || Boolean(status.success)} className={cx(ui.primaryAction, 'min-h-12 w-full rounded-[var(--radius-md)] disabled:cursor-not-allowed')}>
            {status.loading ? 'Updating...' : 'Update password'}
          </button>

          <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--ink-soft)', margin: 0 }}>
            <NavLink to="/login" className="font-bold text-brand-primary no-underline hover:underline">Back to sign in</NavLink>
          </p>
        </form>
      </section>
    </main>
  );
}
