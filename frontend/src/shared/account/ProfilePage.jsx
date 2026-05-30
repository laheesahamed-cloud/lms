import { useEffect, useState } from 'react';
import { changePassword, updateProfile } from '../api/auth.api.js';
import { getErrorMessage } from '../api/client.js';
import { AppHeader } from '../layout/AppHeader.jsx';
import { PROFILE_AVATARS, ProfileAvatar } from '../ui/ProfileAvatar.jsx';
import { useAuthStore } from '../stores/authStore.js';
import { getStaffRoleLabel, isStaffUser } from '../auth/roleAccess.js';
import { cx, statusPill, ui } from '../styles/tailwindClasses.js';

export function ProfilePage() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const [profileForm, setProfileForm] = useState({ fullName: '', avatarKey: '' });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [profileStatus, setProfileStatus] = useState({ loading: false, error: '', success: '' });
  const [passwordStatus, setPasswordStatus] = useState({ loading: false, error: '', success: '' });
  const isStaff = isStaffUser(user);

  useEffect(() => {
    setProfileForm({ fullName: user?.fullName || '', avatarKey: user?.avatarKey || '' });
  }, [user?.avatarKey, user?.fullName]);

  async function handleProfileSubmit(event) {
    event.preventDefault();
    setProfileStatus({ loading: true, error: '', success: '' });

    try {
      const data = await updateProfile({ fullName: profileForm.fullName, avatarKey: profileForm.avatarKey });
      setUser(data.user);
      setProfileStatus({ loading: false, error: '', success: 'Profile updated.' });
    } catch (error) {
      setProfileStatus({ loading: false, error: getErrorMessage(error, 'Unable to update profile'), success: '' });
    }
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault();
    setPasswordStatus({ loading: true, error: '', success: '' });

    try {
      await changePassword(passwordForm);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordStatus({ loading: false, error: '', success: 'Password changed.' });
    } catch (error) {
      setPasswordStatus({ loading: false, error: getErrorMessage(error, 'Unable to change password'), success: '' });
    }
  }

  return (
    <main className={ui.screenShell}>
      <section className={cx(ui.managementLayout, 'gap-[18px]')}>
        <AppHeader title="Profile" subtitle="Account Settings" />

        <section className="flex items-center gap-[18px] rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-[22px] shadow-[var(--card-shadow)] max-[900px]:items-start max-[900px]:flex-col">
          <div className="inline-flex rounded-[24px] shadow-[var(--shadow-glow)]">
            <ProfileAvatar user={user} avatarKey={profileForm.avatarKey} size="xl" />
          </div>
          <div>
            <span className={ui.eyebrow}>{isStaff ? getStaffRoleLabel(user?.role) : 'Student Profile'}</span>
            <h2 className="my-1.5 mb-1 text-[26px] text-ink-strong">{user?.fullName || 'Signed in user'}</h2>
            <p className="m-0 text-ink-soft">{user?.email}</p>
          </div>
          <span className={cx('ml-auto max-[900px]:ml-0', statusPill(user?.status || 'active'))}>{user?.status || 'active'}</span>
        </section>

        <div className="grid grid-cols-2 gap-[18px] max-[900px]:grid-cols-1">
          <form className={cx(ui.dashboardCard, 'grid gap-4 p-[22px]')} onSubmit={handleProfileSubmit}>
            <div className="grid gap-1.5">
              <span className={ui.eyebrow}>Account</span>
              <h3 className="m-0 text-xl text-ink-strong">Profile details</h3>
              <p className="m-0 text-[13px] leading-relaxed text-ink-soft">Email is used for sign in and cannot be changed here.</p>
            </div>

            {profileStatus.error ? <div className={ui.feedbackError}>{profileStatus.error}</div> : null}
            {profileStatus.success ? <div className={ui.feedbackSuccess}>{profileStatus.success}</div> : null}

            <label className="grid gap-[7px] text-[13px] font-bold text-ink-medium">
              Full name
              <input className={ui.input}
                value={profileForm.fullName}
                onChange={(event) => setProfileForm({ fullName: event.target.value })}
                minLength={2}
                required
              />
            </label>

            <label className="grid gap-[7px] text-[13px] font-bold text-ink-medium">
              Email address
              <input className="cursor-not-allowed bg-[color-mix(in_srgb,var(--surface-2)_82%,var(--line-soft))] text-ink-soft" value={user?.email || ''} readOnly aria-readonly="true" />
            </label>

            <label className="grid gap-[7px] text-[13px] font-bold text-ink-medium">
              Role
              <input className="cursor-not-allowed bg-[color-mix(in_srgb,var(--surface-2)_82%,var(--line-soft))] text-ink-soft" value={isStaff ? getStaffRoleLabel(user?.role) : 'Medical Student'} readOnly aria-readonly="true" />
            </label>

            <div className="grid gap-3">
              <div>
                <span className={ui.eyebrow}>Avatar</span>
                <p className="m-0 mt-1 text-[13px] leading-normal text-ink-soft">Choose how your profile appears in the header.</p>
              </div>
              <div className="grid grid-cols-6 gap-[9px] max-[900px]:grid-cols-3">
                {PROFILE_AVATARS.map((avatar) => (
                  <button className={cx(
                      'grid min-h-[62px] cursor-pointer place-items-center rounded-lg border border-line-soft bg-surface-2 p-[7px] shadow-none transition hover:border-brand-primary/35 hover:bg-[color-mix(in_srgb,var(--surface-2)_86%,var(--color-primary-light))]',
                      profileForm.avatarKey === avatar.key && 'border-brand-primary/70 bg-[color-mix(in_srgb,var(--surface-2)_76%,var(--color-primary-light))] shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-primary)_16%,transparent)]'
                    )}
                    key={avatar.key}
                    type="button"
                   
                    onClick={() => setProfileForm((current) => ({ ...current, avatarKey: avatar.key }))}
                    aria-label={`Choose avatar ${avatar.key}`}
                    aria-pressed={profileForm.avatarKey === avatar.key}
                  >
                    <ProfileAvatar avatarKey={avatar.key} size="lg" />
                  </button>
                ))}
              </div>
            </div>

            <button type="submit" className={cx(ui.primaryAction, 'justify-self-start disabled:cursor-progress')} disabled={profileStatus.loading}>
              {profileStatus.loading ? 'Saving...' : 'Save Profile'}
            </button>
          </form>

          <form className={cx(ui.dashboardCard, 'grid gap-4 p-[22px]')} onSubmit={handlePasswordSubmit}>
            <div className="grid gap-1.5">
              <span className={ui.eyebrow}>Security</span>
              <h3 className="m-0 text-xl text-ink-strong">Change password</h3>
              <p className="m-0 text-[13px] leading-relaxed text-ink-soft">Use your current password before setting a new one.</p>
            </div>

            {passwordStatus.error ? <div className={ui.feedbackError}>{passwordStatus.error}</div> : null}
            {passwordStatus.success ? <div className={ui.feedbackSuccess}>{passwordStatus.success}</div> : null}

            <label className="grid gap-[7px] text-[13px] font-bold text-ink-medium">
              Current password
              <input className={ui.input}
                type="password"
                value={passwordForm.currentPassword}
                onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))}
                required
                autoComplete="current-password"
              />
            </label>

            <label className="grid gap-[7px] text-[13px] font-bold text-ink-medium">
              New password
              <input className={ui.input}
                type="password"
                value={passwordForm.newPassword}
                onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))}
                minLength={6}
                required
                autoComplete="new-password"
              />
            </label>

            <label className="grid gap-[7px] text-[13px] font-bold text-ink-medium">
              Confirm new password
              <input className={ui.input}
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                minLength={6}
                required
                autoComplete="new-password"
              />
            </label>

            <button type="submit" className={cx(ui.primaryAction, 'justify-self-start disabled:cursor-progress')} disabled={passwordStatus.loading}>
              {passwordStatus.loading ? 'Changing...' : 'Change Password'}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
