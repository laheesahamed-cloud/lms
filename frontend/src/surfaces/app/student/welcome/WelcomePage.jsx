import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { updateProfile } from '../../../../shared/api/auth.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { useAuthStore } from '../../../../shared/stores/authStore.js';
import { ProfileAvatar } from '../../../../shared/ui/ProfileAvatar.jsx';
import { PROFILE_AVATARS, getProfileAvatar } from '../../../../shared/ui/profileAvatarData.js';
import { PageMeta } from '../../../../shared/seo/PageMeta.jsx';
import { COUNTRIES } from '../../../../shared/data/countries.js';
import { cx, ui } from '../../../../shared/styles/tailwindClasses.js';
import '../../../website/auth/auth-native.css';

// Same rounded fields as the sign-in / register pages.
// No dark stroke on hover / the active field: a soft blue ring instead.
const fieldClass = `${ui.input} !h-12 !leading-5 !font-normal !text-[16px] focus:!outline-none focus-visible:!outline-none hover:!border-[var(--input-border)] focus:!border-[color-mix(in_srgb,var(--color-primary,#2563eb)_45%,transparent)] focus:!shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-primary,#2563eb)_14%,transparent)]`;

// Welcome screen for a new email sign-up on the website (2026-11-20). Follows
// the phone app's welcome screen (mobile/lib/features/onboarding/
// profile_setup_page.dart): greeting, "What should we call you?", "Pick your
// avatar", Get started — no Skip. Country and university are pre-filled from
// the register form (passed along in the page state); both are required.
// Opened once, straight after the email code is confirmed (VerifyEmailPage);
// it does not use the server's needs_profile_setup flag, so installed apps
// are unchanged. Saving is one request (PATCH /auth/profile, one UPDATE).
export function WelcomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const nextPath = typeof location.state?.next === 'string' && location.state.next.startsWith('/')
    ? location.state.next
    : '/app/dashboard';

  const [name, setName] = useState(() => String(user?.fullName || '').trim());
  const [country, setCountry] = useState(() => String(location.state?.universityCountry || '').trim());
  const [university, setUniversity] = useState(() => String(location.state?.university || '').trim());
  const [avatarKey, setAvatarKey] = useState(() => user?.avatarKey || getProfileAvatar(user).key);
  const [status, setStatus] = useState({ saving: false, error: '' });
  const canSave = name.trim().length >= 2 && country.length >= 2 && university.trim().length >= 2 && !status.saving;

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canSave) return;
    setStatus({ saving: true, error: '' });
    try {
      const data = await updateProfile({ fullName: name.trim(), avatarKey, universityCountry: country, university: university.trim() });
      // The reply carries only the changed fields: keep the rest of the user.
      setUser({ ...user, ...(data?.user || {}), fullName: name.trim(), avatarKey });
      navigate(nextPath, { replace: true });
    } catch (error) {
      setStatus({ saving: false, error: getErrorMessage(error, 'Could not save that. Try again.') });
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--app-bg)] px-4 py-10">
      <PageMeta title="Welcome" path="/welcome" noindex />
      <form
        className="grid w-full max-w-[460px] gap-6 rounded-[var(--ds-card-radius,22px)] border border-line-soft bg-[var(--surface-card)] p-6 shadow-[var(--ds-card-shadow)] sm:p-8"
        onSubmit={handleSubmit}
        aria-labelledby="welcome-title"
      >
        <div className="grid justify-items-center gap-3 text-center">
          <ProfileAvatar avatarKey={avatarKey} size="lg" className="!h-20 !w-20" />
          <h1 id="welcome-title" className="m-0 text-[28px] font-extrabold tracking-[-0.02em] text-ink-strong">
            Hi, future doctor
          </h1>
          <p className="m-0 max-w-[340px] text-[15px] leading-relaxed text-ink-soft">
            Xyndrome is here for every step from here to your final exam.
          </p>
        </div>

        <label className="grid gap-2 text-[14px] font-bold text-ink-strong">
          What should we call you?
          <input
            className={fieldClass}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nickname"
            maxLength={80}
            autoComplete="nickname"
            autoFocus
          />
        </label>

        <div className="grid gap-2">
          <span id="welcome-university-label" className="text-[14px] font-bold text-ink-strong">University</span>
          <select
            className={fieldClass}
            value={country}
            onChange={(event) => setCountry(event.target.value)}
            aria-labelledby="welcome-university-label"
            autoComplete="country-name"
          >
            <option value="" disabled>Country</option>
            {COUNTRIES.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
          <input
            className={fieldClass}
            value={university}
            onChange={(event) => setUniversity(event.target.value)}
            placeholder="University name"
            maxLength={160}
            autoComplete="organization"
            aria-label="University name"
          />
        </div>

        <div className="grid gap-3">
          <span className="text-[14px] font-bold text-ink-strong">Pick your avatar</span>
          <div className="grid grid-cols-6 gap-2 max-[420px]:grid-cols-3">
            {PROFILE_AVATARS.map((avatar) => (
              <button
                key={avatar.key}
                type="button"
                className={cx(
                  'grid aspect-square cursor-pointer place-items-center rounded-2xl border-2 p-1 shadow-none transition',
                  avatarKey === avatar.key
                    ? 'border-[var(--color-primary,#2563eb)] bg-[color-mix(in_srgb,var(--color-primary,#2563eb)_12%,transparent)]'
                    : 'border-transparent bg-surface-2 hover:border-[color-mix(in_srgb,var(--color-primary,#2563eb)_35%,transparent)]'
                )}
                onClick={() => setAvatarKey(avatar.key)}
                aria-label={`Choose avatar ${avatar.key}`}
                aria-pressed={avatarKey === avatar.key}
              >
                <ProfileAvatar avatarKey={avatar.key} size="lg" />
              </button>
            ))}
          </div>
        </div>

        {status.error ? <p className="m-0 text-[13px] font-semibold text-[var(--color-error,#dc2626)]" role="alert">{status.error}</p> : null}

        <button type="submit" className={cx(ui.primaryAction, 'w-full justify-center disabled:cursor-not-allowed disabled:opacity-60')} disabled={!canSave}>
          {status.saving ? 'Saving…' : 'Get started'}
        </button>
      </form>
    </main>
  );
}
