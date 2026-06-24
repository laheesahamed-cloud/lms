import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { getErrorMessage } from '../../../shared/api/client.js';
import { resendEmailOtp } from '../../../shared/api/auth.api.js';
import { useAuthStore } from '../../../shared/stores/authStore.js';
import { canonicalizeForwardPathForUser, getSafeForwardPath } from '../../../shared/utils/routeForwarding.js';
import { ThemeToggle } from '../../../shared/layout/ThemeToggle.jsx';
import { PageMeta } from '../../../shared/seo/PageMeta.jsx';
import { cx, ui } from '../../../shared/styles/tailwindClasses.js';
import { AuthFeedbackNotice } from './AuthFeedbackNotice.jsx';

const CODE_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;

export function VerifyEmailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const verifyEmail = useAuthStore((s) => s.verifyEmail);

  const email = useMemo(() => (searchParams.get('email') || '').trim().toLowerCase(), [searchParams]);
  const fromParam = useMemo(() => searchParams.get('from') || '', [searchParams]);
  const requestedPath = getSafeForwardPath(fromParam);

  // In non-production with no SMTP configured, the backend hands the code back via
  // navigation state so it can be tested locally. Harmless in prod (never sent there).
  const devCode = String(location.state?.devCode || '');
  const [digits, setDigits] = useState(() => {
    const seed = /^\d{6}$/.test(devCode) ? devCode.split('') : [];
    return Array.from({ length: CODE_LENGTH }, (_, i) => seed[i] || '');
  });
  const [status, setStatus] = useState({ loading: false, error: '', success: '' });
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const inputsRef = useRef([]);

  const code = digits.join('');
  const codeComplete = code.length === CODE_LENGTH && digits.every((d) => d !== '');

  // No email in the URL means the user landed here directly — send them back to sign in.
  useEffect(() => {
    if (!email) navigate('/auth/login', { replace: true });
  }, [email, navigate]);

  // Resend cooldown ticker (a code was just sent when this page opened).
  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  function focusInput(index) {
    const clamped = Math.max(0, Math.min(CODE_LENGTH - 1, index));
    inputsRef.current[clamped]?.focus();
    inputsRef.current[clamped]?.select?.();
  }

  function setDigitsFromString(raw, startIndex = 0) {
    const clean = String(raw || '').replace(/\D/g, '').slice(0, CODE_LENGTH - startIndex);
    if (!clean) return;
    setDigits((current) => {
      const next = [...current];
      for (let i = 0; i < clean.length; i += 1) next[startIndex + i] = clean[i];
      return next;
    });
    focusInput(startIndex + clean.length);
  }

  function handleChange(index, value) {
    setStatus((s) => (s.error ? { ...s, error: '' } : s));
    const clean = value.replace(/\D/g, '');
    if (clean.length > 1) {
      setDigitsFromString(clean, index);
      return;
    }
    setDigits((current) => {
      const next = [...current];
      next[index] = clean;
      return next;
    });
    if (clean) focusInput(index + 1);
  }

  function handleKeyDown(index, event) {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      event.preventDefault();
      setDigits((current) => {
        const next = [...current];
        next[index - 1] = '';
        return next;
      });
      focusInput(index - 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      focusInput(index - 1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      focusInput(index + 1);
    }
  }

  function handlePaste(event) {
    event.preventDefault();
    setDigitsFromString(event.clipboardData.getData('text'), 0);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!codeComplete || status.loading) return;
    setStatus({ loading: true, error: '', success: '' });
    try {
      const data = await verifyEmail({ email, code });
      const nextPath = canonicalizeForwardPathForUser(requestedPath, data?.user) || data?.redirectPath || '/dashboard';
      navigate(nextPath, { replace: true });
    } catch (error) {
      setDigits(Array(CODE_LENGTH).fill(''));
      focusInput(0);
      setStatus({ loading: false, error: getErrorMessage(error, 'Unable to verify that code'), success: '' });
    }
  }

  async function handleResend() {
    if (cooldown > 0) return;
    setStatus({ loading: false, error: '', success: '' });
    try {
      const data = await resendEmailOtp({ email });
      setCooldown(data?.retryAfterSeconds || RESEND_COOLDOWN_SECONDS);
      setStatus({ loading: false, error: '', success: `A new code is on its way to ${email}.` });
    } catch (error) {
      setStatus({ loading: false, error: getErrorMessage(error, 'Unable to resend the code'), success: '' });
    }
  }

  const feedbackId = status.error ? 'verify-email-error' : status.success ? 'verify-email-success' : undefined;
  const clearFeedback = () => setStatus((current) => ({ ...current, error: '', success: '' }));

  return (
    <main className={ui.authRouteScene} style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 'clamp(18px,4vw,44px)', background: 'var(--page-background)' }}>
      <PageMeta
        title="Verify Your Email"
        description="Enter the 6-digit code we emailed you to verify your xyndrome account."
        path="/auth/verify-email"
        noindex
      />
      <div className="absolute right-5 top-5"><ThemeToggle /></div>
      <section className="lms-form-card" style={{ width: 'min(100%, 430px)', borderRadius: 22, border: '1px solid var(--line-soft)', background: 'var(--surface-card)', padding: 'clamp(24px,4vw,34px)', boxShadow: '0 18px 46px rgba(15,23,42,.10)' }}>
        <form onSubmit={handleSubmit} className="grid gap-5" aria-describedby={feedbackId}>
          <div>
            <p style={{ margin: '0 0 9px', fontSize: 11, fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '.13em' }}>Verify email</p>
            <h1 style={{ margin: '0 0 8px', fontSize: 'clamp(24px,3vw,32px)', fontWeight: 900, lineHeight: 1.1, color: 'var(--ink-strong)' }}>Enter your code</h1>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.62 }}>
              We sent a 6-digit code to <strong style={{ color: 'var(--ink-strong)' }}>{email}</strong>. It expires in 10 minutes.
            </p>
          </div>

          {status.error ? (
            <AuthFeedbackNotice id="verify-email-error" tone="error" onDismiss={clearFeedback}>
              {status.error}
            </AuthFeedbackNotice>
          ) : null}
          {status.success ? (
            <AuthFeedbackNotice id="verify-email-success" tone="success" onDismiss={clearFeedback}>
              {status.success}
            </AuthFeedbackNotice>
          ) : null}

          <div className="grid gap-2" onPaste={handlePaste}>
            <span className={ui.formLabel}>6-digit code</span>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${CODE_LENGTH}, 1fr)`, gap: 'clamp(6px,2vw,10px)' }}>
              {digits.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => { inputsRef.current[index] = el; }}
                  type="text"
                  inputMode="numeric"
                  autoComplete={index === 0 ? 'one-time-code' : 'off'}
                  maxLength={1}
                  value={digit}
                  aria-label={`Digit ${index + 1}`}
                  aria-invalid={status.error ? 'true' : undefined}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onFocus={(e) => e.target.select()}
                  style={{
                    width: '100%',
                    aspectRatio: '1 / 1',
                    textAlign: 'center',
                    fontSize: 'clamp(20px,5vw,26px)',
                    fontWeight: 800,
                    color: 'var(--ink-strong)',
                    borderRadius: 14,
                    border: '1px solid var(--line-soft)',
                    background: 'var(--surface-input, var(--surface-card))',
                    outline: 'none',
                  }}
                />
              ))}
            </div>
          </div>

          <button type="submit" disabled={!codeComplete || status.loading} className={cx(ui.primaryAction, 'min-h-12 w-full rounded-[var(--radius-md)] disabled:cursor-not-allowed disabled:opacity-60')}>
            {status.loading ? 'Verifying...' : 'Verify and continue'}
          </button>

          <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--ink-soft)', margin: 0 }}>
            Didn&apos;t get it?{' '}
            <button
              type="button"
              onClick={handleResend}
              disabled={cooldown > 0}
              className="font-bold text-brand-primary no-underline hover:underline disabled:cursor-not-allowed disabled:opacity-60 disabled:no-underline"
              style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer' }}
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
            </button>
          </p>

          <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--ink-soft)', margin: 0 }}>
            <NavLink to="/login" className="font-bold text-brand-primary no-underline hover:underline">Back to sign in</NavLink>
          </p>
        </form>
      </section>
    </main>
  );
}
