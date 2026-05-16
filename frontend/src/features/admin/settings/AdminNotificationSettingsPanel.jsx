import { useEffect, useState } from 'react';
import { fetchAdminPushStatus, sendAdminPushNotification } from '../../../api/pushNotifications.api.js';
import { getErrorMessage } from '../../../api/client.js';
import { detectPlatform } from '../../../platform/detect.js';
import { cx, ui } from '../../../styles/tailwindClasses.js';

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
  const isNativeApp = detectPlatform().isNative;

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
        const phonePart = `${result.sent || 0} phone device${result.sent === 1 ? '' : 's'} reached`;
        setMessage(`${appPart}. ${phonePart}.`);
      } else {
        setError(result.reason || `Sent ${result.sent || 0}, failed ${result.failed || 0}.`);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to send push notification.'));
    } finally {
      setBusy(false);
    }
  }

  const vapidReady = Boolean(status?.vapidEnabled);
  const nativeReady = Boolean(status?.nativePushConfigured);
  const phoneReady = isNativeApp ? nativeReady : vapidReady;
  const requiresPhonePush = form.deliveryType === 'outside' || form.deliveryType === 'both';

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,190px),1fr))] gap-3">
        <div className={cx('rounded-xl border px-4 py-3', statusTone(phoneReady))}>
          <strong className="block text-[22px] font-black leading-none">{phoneReady ? 'Ready' : 'Setup needed'}</strong>
          <span className="mt-1 block text-xs font-bold">{isNativeApp ? 'Native push status' : 'VAPID status'}</span>
        </div>
        <div className="rounded-xl border border-line-soft bg-surface-card px-4 py-3">
          <strong className="block text-[22px] font-black leading-none text-ink-strong">{isNativeApp ? status?.nativePushUsers ?? 0 : status?.phoneUsers ?? 0}</strong>
          <span className="mt-1 block text-xs font-bold text-ink-muted">{isNativeApp ? 'Users with native push' : 'Users with phone push'}</span>
        </div>
        <div className="rounded-xl border border-line-soft bg-surface-card px-4 py-3">
          <strong className="block text-[22px] font-black leading-none text-ink-strong">{isNativeApp ? status?.nativePushTokens ?? 0 : status?.phoneSubscriptions ?? 0}</strong>
          <span className="mt-1 block text-xs font-bold text-ink-muted">Active devices</span>
        </div>
      </div>

      <div className={ui.infoCard}>
        {isNativeApp
          ? 'The admin chooses the delivery type for each message. App notifications appear inside the LMS notification page. Device alerts are sent only to users who enabled native notifications in the installed app.'
          : 'The admin chooses the delivery type for each message. App notifications appear inside the LMS notification page. Phone notifications use Web Push and only reach users who enabled phone notifications on their device.'}
      </div>

      {!phoneReady ? (
        <div className={ui.warningFeedback}>
          {isNativeApp
            ? 'Enable Push Notifications in Apple Developer/Xcode, add Firebase google-services.json for Android, and configure backend APNs/FCM credentials before sending native device alerts.'
            : <>Generate VAPID keys with <code>npm run push:vapid --prefix backend</code>, then set <code>VAPID_PUBLIC_KEY</code>, <code>VAPID_PRIVATE_KEY</code>, and <code>VAPID_SUBJECT</code> in the backend environment.</>}
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
              <option value="both">App + phone notification</option>
              <option value="inside">Inside app only</option>
              <option value="outside">Phone notification only</option>
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
          <button className={ui.primaryAction} disabled={busy || (requiresPhonePush && !phoneReady)}>
            {busy ? 'Sending...' : 'Send notification'}
          </button>
          <button type="button" className={ui.secondaryAction} onClick={loadStatus} disabled={busy}>
            Refresh status
          </button>
        </div>
      </form>
    </div>
  );
}
