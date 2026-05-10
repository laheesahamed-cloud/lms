import { memo, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { getErrorMessage } from '../../api/client.js';
import { useAuthStore } from '../../stores/authStore.js';
import { ui } from '../../styles/tailwindClasses.js';

const auth = {
  shell: 'grid min-h-dvh place-items-center bg-page px-6 py-6',
  scene: 'mx-auto grid w-[min(1100px,100%)] items-center gap-12 lg:grid-cols-[minmax(0,1fr)_480px]',
  visual:
    'relative flex min-h-[540px] flex-col justify-center gap-5 overflow-hidden rounded-2xl bg-[var(--brand-gradient-hero)] px-[clamp(24px,4vw,52px)] py-[clamp(32px,5vw,64px)] text-white shadow-xl before:absolute before:inset-0 before:pointer-events-none before:bg-[radial-gradient(ellipse_at_70%_20%,rgba(255,255,255,0.12),transparent_55%),radial-gradient(ellipse_at_20%_80%,rgba(13,148,136,0.2),transparent_50%)] max-lg:hidden',
  visualEyebrow: 'relative z-[1] inline-block text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-white/70',
  visualTitle: 'relative z-[1] m-0 max-w-[400px] font-display text-[clamp(24px,3.5vw,36px)] font-extrabold leading-tight text-white',
  visualText: 'relative z-[1] m-0 max-w-[380px] text-[15px] leading-[1.7] text-white/80',
  signalList: 'relative z-[1] flex flex-col gap-2',
  signal: 'flex items-center gap-2.5 text-[13px] font-semibold text-white/85 before:size-1.5 before:shrink-0 before:rounded-full before:bg-white/70 before:content-[""]',
  visualCard: 'relative z-[1] flex flex-col gap-3 rounded-lg border border-white/20 bg-white/[0.08] p-5 backdrop-blur-xl',
  visualRow: 'relative z-[1] flex flex-col gap-1',
  visualRowTitle: 'text-[13.5px] font-bold text-white',
  visualRowText: 'text-[11.5px] text-white/70',
  stepRow: 'relative z-[1] flex flex-wrap items-center gap-2',
  step: 'rounded-full border border-white/20 bg-white/15 px-3 py-1.5 text-[11.5px] font-semibold text-white/90',
  card: 'flex flex-col gap-4.5 rounded-2xl border border-line-soft bg-surface-glass-strong p-8 shadow-2xl backdrop-blur-2xl max-[640px]:p-5',
  switcher: 'grid grid-cols-2 gap-1 rounded-md border border-line-soft bg-surface-2 p-1',
  switchLink: 'flex items-center justify-center rounded-[11px] px-3.5 py-2.5 text-[13.5px] font-bold text-ink-soft no-underline transition hover:bg-surface-glass hover:text-ink-medium',
  switchActive: 'bg-surface-1 text-ink-strong shadow-sm',
  formHeadTitle: 'm-0 mb-1 text-[22px] font-extrabold text-ink-strong',
  formHeadText: 'm-0 text-[13.5px] text-ink-soft',
  linkRow: 'text-center text-[13px] text-ink-soft',
  inlineLink: 'font-bold text-brand-primary no-underline hover:underline',
};

const RegisterVisual = memo(function RegisterVisual() {
  return (
    <div className={auth.visual}>
      <span className={auth.visualEyebrow}>Future Doctor Onboarding</span>
      <h1 className={auth.visualTitle}>Create a premium medical learning account in minutes.</h1>
      <p className={auth.visualText}>
        Begin with a beautifully designed signup flow that lands you directly in the real student dashboard
        with a free subscription and visible upgrade paths.
      </p>
      <div className={auth.signalList}>
        {['Student-friendly mobile flow', 'Free plan on signup', 'Smooth access into the LMS'].map((s) => (
          <span className={auth.signal} key={s}>{s}</span>
        ))}
      </div>
      <div className={auth.visualCard}>
        <div className={auth.visualRow}>
          <strong className={auth.visualRowTitle}>Subscription ready</strong>
          <small className={auth.visualRowText}>New students start on the Free plan and can explore the real dashboard immediately</small>
        </div>
        <div className={auth.stepRow}>
          <span className={auth.step}>Create profile</span>
          <span className={auth.step}>Start on Free</span>
          <span className={auth.step}>Start learning</span>
        </div>
      </div>
    </div>
  );
});

export function RegisterPage() {
  const navigate = useNavigate();
  const signUp = useAuthStore((state) => state.signUp);
  const [status, setStatus] = useState({ loading: false, error: '', success: '' });

  async function handleSubmit(e) {
    e.preventDefault();
    const formElement = e.currentTarget;
    const formData = new FormData(formElement);
    const registration = {
      fullName: String(formData.get('fullName') || '').trim(),
      email: String(formData.get('email') || '').trim().toLowerCase(),
      password: String(formData.get('password') || ''),
      confirmPassword: String(formData.get('confirmPassword') || ''),
      acceptedTerms: formData.get('acceptedTerms') === 'on',
    };

    setStatus({ loading: true, error: '', success: '' });
    try {
      const data = await signUp(registration);
      setStatus({ loading: false, error: '', success: `Account created for ${data.user.fullName}` });
      navigate(data.redirectPath);
    } catch (error) {
      setStatus({ loading: false, error: getErrorMessage(error, 'Unable to create your account'), success: '' });
    }
  }

  return (
    <main className={auth.shell}>
      <section className={auth.scene}>
        <RegisterVisual />

        <form className={auth.card} onSubmit={handleSubmit}>
          <div className={auth.switcher} aria-label="Authentication pages">
            <NavLink to="/auth/login"    className={({ isActive }) => `${auth.switchLink} ${isActive ? auth.switchActive : ''}`}>Sign in</NavLink>
            <NavLink to="/auth/register" className={({ isActive }) => `${auth.switchLink} ${isActive ? auth.switchActive : ''}`}>Create account</NavLink>
          </div>

          <div>
            <h2 className={auth.formHeadTitle}>Create profile</h2>
            <p className={auth.formHeadText}>New student accounts open the real dashboard immediately with the default Free plan.</p>
          </div>

          {status.error   ? <div className={ui.feedbackError}>{status.error}</div>   : null}
          {status.success ? <div className={ui.feedbackSuccess}>{status.success}</div> : null}

          <label className={ui.formLabel}>
            Full name
            <input className={ui.input} name="fullName" placeholder="Your full name" required autoComplete="name" />
          </label>
          <label className={ui.formLabel}>
            Email address
            <input className={ui.input} name="email" type="email" placeholder="you@example.com" required autoComplete="email" />
          </label>
          <label className={ui.formLabel}>
            Password
            <input
              className={ui.input}
              name="password"
              type="password"
              placeholder="10+ chars with uppercase, lowercase, and number"
              minLength={10}
              required
              autoComplete="new-password"
            />
          </label>
          <label className={ui.formLabel}>
            Confirm password
            <input
              className={ui.input}
              name="confirmPassword"
              type="password"
              placeholder="Repeat your password"
              minLength={10}
              required
              autoComplete="new-password"
            />
          </label>
          <label className={ui.checkboxRow}>
            <input className="shrink-0" name="acceptedTerms" type="checkbox" defaultChecked />
            <span>
              I agree to the <Link to="/terms" className={auth.inlineLink}>terms and conditions</Link> and <Link to="/privacy-policy" className={auth.inlineLink}>privacy policy</Link>, and understand some features may be locked until I upgrade.
            </span>
          </label>

          <button type="submit" className={ui.primaryAction} disabled={status.loading}>
            {status.loading ? 'Creating profile...' : 'Create Profile'}
          </button>

          <div className={auth.linkRow}>
            Already registered?{' '}
            <NavLink to="/auth/login" className={auth.inlineLink}>Sign in</NavLink>
          </div>
        </form>
      </section>
    </main>
  );
}
