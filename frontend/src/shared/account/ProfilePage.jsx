import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { changePassword, deleteAccount, updateProfile } from '../api/auth.api.js';
import { getErrorMessage } from '../api/client.js';
import { AppHeader } from '../layout/AppHeader.jsx';
import { ThemeToggle } from '../layout/ThemeToggle.jsx';
import { ProfileAvatar } from '../ui/ProfileAvatar.jsx';
import { PROFILE_AVATARS } from '../ui/profileAvatarData.js';
import { useAuthStore } from '../stores/authStore.js';
import { getStaffRoleLabel, isStaffUser } from '../auth/roleAccess.js';
import { cx, statusPill, ui } from '../styles/tailwindClasses.js';
import { FeedbackNotice } from '../ui/FeedbackNotice.jsx';
import { PasswordField } from '../ui/PasswordField.jsx';

export function ProfilePage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const signOut = useAuthStore((state) => state.signOut);
  const [profileForm, setProfileForm] = useState({ fullName: '', avatarKey: '' });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [profileStatus, setProfileStatus] = useState({ loading: false, error: '', success: '' });
  const [passwordStatus, setPasswordStatus] = useState({ loading: false, error: '', success: '' });
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteStatus, setDeleteStatus] = useState({ loading: false, error: '' });
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

  async function handleDeleteAccount() {
    setDeleteStatus({ loading: true, error: '' });

    try {
      await deleteAccount();
      // signOut clears local session + caches; its logout call no-ops since the
      // session is already gone server-side.
      await signOut();
      navigate('/auth/login');
    } catch (error) {
      setDeleteStatus({ loading: false, error: getErrorMessage(error, 'Unable to delete account') });
    }
  }

  return (
    <main className={ui.screenShell}>
      <section className={cx(ui.managementLayout, 'gap-section')}>
        <AppHeader title="Profile" subtitle="Account Settings" back />

        <section className="flex items-center gap-section rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-card shadow-[var(--card-shadow)] max-[900px]:items-start max-[900px]:flex-col">
          <div className="inline-flex rounded-[24px] shadow-[var(--shadow-glow)]">
            <ProfileAvatar user={user} avatarKey={profileForm.avatarKey} size="xl" />
          </div>
          <div>
            <span className={ui.eyebrow}>{isStaff ? getStaffRoleLabel(user?.role) : 'Student Profile'}</span>
            <h2 className="my-1.5 mb-1 text-[26px] text-ink-strong">{user?.fullName || 'Signed in user'}</h2>
            <p className="m-0 text-ink-soft">{user?.email}</p>
          </div>
          <span className={cx('ml-auto max-[900px]:ml-0', statusPill(user?.status || 'active'))}>
            {user?.status || 'active'}
          </span>
        </section>

        <section className={cx(ui.dashboardCard, 'flex items-center justify-between gap-4 p-card max-[640px]:flex-col max-[640px]:items-start')}>
          <div className="grid gap-2">
            <span className={ui.eyebrow}>Appearance</span>
            <h3 className="m-0 text-xl text-ink-strong">Theme</h3>
            <p className="m-0 text-[13px] leading-relaxed text-ink-soft">
              Switch between dark and light mode for your study workspace.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-line-soft bg-surface-2 px-3 py-2">
            <span className="text-[12px] font-extrabold text-ink-soft">Dark / Light</span>
            <ThemeToggle />
          </div>
        </section>

        <div className="grid grid-cols-2 gap-section max-[900px]:grid-cols-1">
          <form className={cx(ui.dashboardCard, 'grid gap-4 p-card')} onSubmit={handleProfileSubmit}>
            <div className="grid gap-2">
              <span className={ui.eyebrow}>Account</span>
              <h3 className="m-0 text-xl text-ink-strong">Profile details</h3>
              <p className="m-0 text-[13px] leading-relaxed text-ink-soft">Email is used for sign in and cannot be changed here.</p>
            </div>

            {profileStatus.error ? <FeedbackNotice tone="error">{profileStatus.error}</FeedbackNotice> : null}
            {profileStatus.success ? <FeedbackNotice tone="success">{profileStatus.success}</FeedbackNotice> : null}

            <label className="grid gap-2 text-[13px] font-bold text-ink-medium">
              Full name
              <input className={ui.input}
                value={profileForm.fullName}
                onChange={(event) => setProfileForm({ fullName: event.target.value })}
                minLength={2}
                required
              />
            </label>

            <label className="grid gap-2 text-[13px] font-bold text-ink-medium">
              Email address
              <input className="cursor-not-allowed bg-[color-mix(in_srgb,var(--surface-2)_82%,var(--line-soft))] text-ink-soft" value={user?.email || ''} readOnly aria-readonly="true" />
            </label>

            <label className="grid gap-2 text-[13px] font-bold text-ink-medium">
              Role
              <input className="cursor-not-allowed bg-[color-mix(in_srgb,var(--surface-2)_82%,var(--line-soft))] text-ink-soft" value={isStaff ? getStaffRoleLabel(user?.role) : 'Medical Student'} readOnly aria-readonly="true" />
            </label>

            <div className="grid gap-3">
              <div>
                <span className={ui.eyebrow}>Avatar</span>
                <p className="m-0 mt-1 text-[13px] leading-normal text-ink-soft">Choose how your profile appears in the header.</p>
              </div>
              <div className="grid grid-cols-6 gap-2 max-[900px]:grid-cols-3">
                {PROFILE_AVATARS.map((avatar) => (
                  <button className={cx(
                      'grid min-h-16 cursor-pointer place-items-center rounded-lg border border-line-soft bg-surface-2 p-2 shadow-none transition hover:border-brand-primary/35 hover:bg-[color-mix(in_srgb,var(--surface-2)_86%,var(--color-primary-light))]',
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

          <form className={cx(ui.dashboardCard, 'grid gap-4 p-card')} onSubmit={handlePasswordSubmit}>
            <div className="grid gap-2">
              <span className={ui.eyebrow}>Security</span>
              <h3 className="m-0 text-xl text-ink-strong">Change password</h3>
              <p className="m-0 text-[13px] leading-relaxed text-ink-soft">Use your current password before setting a new one.</p>
            </div>

            {passwordStatus.error ? <FeedbackNotice tone="error">{passwordStatus.error}</FeedbackNotice> : null}
            {passwordStatus.success ? <FeedbackNotice tone="success">{passwordStatus.success}</FeedbackNotice> : null}

            <PasswordField
              label="Current password"
              value={passwordForm.currentPassword}
              onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))}
              required
              autoComplete="current-password"
              labelClassName="grid gap-2 text-[13px] font-bold text-ink-medium"
            />

            <PasswordField
              label="New password"
              value={passwordForm.newPassword}
              onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))}
              minLength={10}
              required
              autoComplete="new-password"
              labelClassName="grid gap-2 text-[13px] font-bold text-ink-medium"
            />

            <PasswordField
              label="Confirm new password"
              value={passwordForm.confirmPassword}
              onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))}
              minLength={10}
              required
              autoComplete="new-password"
              labelClassName="grid gap-2 text-[13px] font-bold text-ink-medium"
            />

            <button type="submit" className={cx(ui.primaryAction, 'justify-self-start disabled:cursor-progress')} disabled={passwordStatus.loading}>
              {passwordStatus.loading ? 'Changing...' : 'Change Password'}
            </button>
          </form>
        </div>

        {!isStaff ? (
          <section className="grid gap-4 rounded-xl border border-[var(--color-error)]/35 bg-[color-mix(in_srgb,var(--card-bg)_92%,var(--color-error))] p-card shadow-[var(--card-shadow)]">
            <div className="grid gap-2">
              <span className={cx(ui.eyebrow, 'text-[var(--color-error)]')}>Danger zone</span>
              <h3 className="m-0 text-xl text-ink-strong">Delete account</h3>
              <p className="m-0 max-w-prose text-[13px] leading-relaxed text-ink-soft">
                This permanently deletes your account. Your name and email are removed and you will be
                signed out. This cannot be undone.
              </p>
            </div>

            {deleteStatus.error ? <FeedbackNotice tone="error">{deleteStatus.error}</FeedbackNotice> : null}

            {!deleteOpen ? (
              <button
                type="button"
                className={cx(ui.dangerAction ?? ui.primaryAction, 'justify-self-start')}
                onClick={() => { setDeleteOpen(true); setDeleteConfirm(''); setDeleteStatus({ loading: false, error: '' }); }}
              >
                Delete my account
              </button>
            ) : (
              <div className="grid gap-3">
                <label className="grid gap-2 text-[13px] font-bold text-ink-medium">
                  Type <span className="font-mono text-[var(--color-error)]">DELETE</span> to confirm
                  <input
                    className={ui.input}
                    value={deleteConfirm}
                    onChange={(event) => setDeleteConfirm(event.target.value)}
                    autoComplete="off"
                    placeholder="DELETE"
                  />
                </label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    className={cx(ui.dangerAction ?? ui.primaryAction, 'disabled:cursor-not-allowed disabled:opacity-60')}
                    onClick={handleDeleteAccount}
                    disabled={deleteStatus.loading || deleteConfirm.trim().toUpperCase() !== 'DELETE'}
                  >
                    {deleteStatus.loading ? 'Deleting...' : 'Permanently delete'}
                  </button>
                  <button
                    type="button"
                    className={ui.secondaryAction ?? ui.primaryAction}
                    onClick={() => setDeleteOpen(false)}
                    disabled={deleteStatus.loading}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </section>
        ) : null}
      </section>
    </main>
  );
}
