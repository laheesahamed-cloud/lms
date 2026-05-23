import { useEffect, useState } from 'react';
import { fetchAdminPushStatus, sendAdminPushNotification } from '../../../../shared/api/pushNotifications.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { cx, ui } from '../../../../shared/styles/tailwindClasses.js';
import { AdminApnsSettingsPanel } from './AdminApnsSettingsPanel.jsx';
import { AdminFcmSettingsPanel } from './AdminFcmSettingsPanel.jsx';

const emptyPushForm = {
  title: 'ERPM LMS',
  body: '',
  targetRole: 'student',
  deliveryType: 'both',
  url: '/notifications',
};

function statusTone(ok) {
  return ok
    ? 'border-brand-success/24 bg-[var(--color-success-light)] text-brand-success'
    : 'border-brand-warning/30 bg-[var(--color-warning-light)] text-brand-warning';
}

export function AdminNotificationSettingsPanel() {
  const [status, setStatus] = useState(null);
  const [form, setForm] = useState(emptyPushForm);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function loadStatus() {
    setStatus(await fetchAdminPushStatus());
  }

  useEffect(() => {
    loadStatus().catch((err) => setError(getErrorMessage(err, 'Unable to load notification setup.')));
  }, []);

  async function handleSend(event) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const result = await sendAdminPushNotification(form);
      await loadStatus().catch(() => {});
      if (result.ok) {
        const appPart = result.inAppCreated ? '1 app notification created' : 'No app notification created';
        const nativePart = `${result.sent || 0} native device${result.sent === 1 ? '' : 's'} reached`;
        setMessage(`${appPart}. ${nativePart}.`);
      } else {
        setError(result.reason || `Sent ${result.sent || 0}, failed ${result.failed || 0}.`);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to send push notification.'));
    } finally {
      setBusy(false);
    }
  }

  const nativeReady = Boolean(status?.nativePushConfigured);
  const iosReady = Boolean(status?.iosNativePushConfigured);
  const androidReady = Boolean(status?.androidNativePushConfigured);
  const requiresNativePush = form.deliveryType === 'outside' || form.deliveryType === 'both';

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,190px),1fr))] gap-3">
        <div className={cx('rounded-xl border px-4 py-3', statusTone(nativeReady))}>
          <strong className="block text-[22px] font-black leading-none">{nativeReady ? 'Ready' : 'Setup needed'}</strong>
          <span className="mt-1 block text-xs font-bold">Native push status</span>
        </div>
        <div className={cx('rounded-xl border px-4 py-3', statusTone(iosReady))}>
          <strong className="block text-[22px] font-black leading-none">{iosReady ? 'Ready' : 'Setup needed'}</strong>
          <span className="mt-1 block text-xs font-bold">iOS push</span>
        </div>
        <div className={cx('rounded-xl border px-4 py-3', statusTone(androidReady))}>
          <strong className="block text-[22px] font-black leading-none">{androidReady ? 'Ready' : 'Setup needed'}</strong>
          <span className="mt-1 block text-xs font-bold">Android push</span>
        </div>
        <div className="rounded-xl border border-line-soft bg-surface-card px-4 py-3">
          <strong className="block text-[22px] font-black leading-none text-ink-strong">{status?.nativePushUsers ?? 0}</strong>
          <span className="mt-1 block text-xs font-bold text-ink-muted">Users with native push</span>
        </div>
        <div className="rounded-xl border border-line-soft bg-surface-card px-4 py-3">
          <strong className="block text-[22px] font-black leading-none text-ink-strong">{status?.nativePushTokens ?? 0}</strong>
          <span className="mt-1 block text-xs font-bold text-ink-muted">Active devices</span>
        </div>
      </div>

      <div className={ui.infoCard}>
        Notifications have two delivery paths: in-app notifications inside the LMS, and native app notifications for installed iOS/Android apps.
      </div>

      {!nativeReady ? (
        <div className={ui.warningFeedback}>
          Configure APNs for iOS and FCM for Android before sending native app notifications.
        </div>
      ) : null}

      <form className={ui.stackForm} onSubmit={handleSend}>
        <div className={ui.formGrid}>
          <label className={ui.formLabel}>
            Title
            <input
              className={ui.input}
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              required
            />
          </label>
          <label className={ui.formLabel}>
            Audience
            <select
              className={ui.input}
              value={form.targetRole}
              onChange={(event) => setForm((current) => ({ ...current, targetRole: event.target.value }))}
            >
              <option value="student">Students</option>
              <option value="admin">Admins</option>
              <option value="all">Everyone</option>
            </select>
          </label>
          <label className={ui.formLabel}>
            Delivery type
            <select
              className={ui.input}
              value={form.deliveryType}
              onChange={(event) => setForm((current) => ({ ...current, deliveryType: event.target.value }))}
            >
              <option value="both">In-app + native notification</option>
              <option value="inside">In-app only</option>
              <option value="outside">Native notification only</option>
            </select>
          </label>
          <label className={ui.formLabel}>
            Open URL
            <input
              className={ui.input}
              value={form.url}
              onChange={(event) => setForm((current) => ({ ...current, url: event.target.value }))}
              placeholder="/notifications"
            />
          </label>
        </div>

        <label className={ui.formLabel}>
          Message
          <textarea
            className={ui.textarea}
            value={form.body}
            onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))}
            required
          />
        </label>

        {message ? <div className={ui.feedbackSuccess}>{message}</div> : null}
        {error ? <div className={ui.feedbackError}>{error}</div> : null}

        <div className={ui.buttonRow}>
          <button className={ui.primaryAction} disabled={busy || (requiresNativePush && !nativeReady)}>
            {busy ? 'Sending...' : 'Send notification'}
          </button>
          <button type="button" className={ui.secondaryAction} onClick={loadStatus} disabled={busy}>
            Refresh status
          </button>
        </div>
      </form>

      <section className="grid gap-4 rounded-lg border border-line-soft bg-surface-1 p-4">
        <div>
          <h3 className="m-0 text-base font-black text-ink-strong">iOS push settings</h3>
          <p className="m-0 mt-1 text-[12.5px] leading-relaxed text-ink-soft">APNs credentials for native iPhone and iPad notifications.</p>
        </div>
        <AdminApnsSettingsPanel />
      </section>

      <section className="grid gap-4 rounded-lg border border-line-soft bg-surface-1 p-4">
        <div>
          <h3 className="m-0 text-base font-black text-ink-strong">Android push settings</h3>
          <p className="m-0 mt-1 text-[12.5px] leading-relaxed text-ink-soft">Firebase Cloud Messaging credentials for native Android notifications.</p>
        </div>
        <AdminFcmSettingsPanel />
      </section>
    </div>
  );
}
