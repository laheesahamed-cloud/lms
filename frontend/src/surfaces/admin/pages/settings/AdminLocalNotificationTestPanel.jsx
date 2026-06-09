import { useEffect, useState } from 'react';
import { sendAdminPushNotification } from '../../../../shared/api/pushNotifications.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { cx, ui } from '../../../../shared/styles/tailwindClasses.js';
import {
  getLocalNotificationSupport,
  getLocalNotificationPermission,
  requestLocalNotificationPermission,
  showLocalNotification,
} from '../../../../shared/platform/native/LocalNotifications.js';

/**
 * Admin "Local notification test console".
 *
 * Lets an admin verify all three on-device paths without a real push setup:
 *   1. Immediate local notification.
 *   2. Scheduled local notification (~10s out) — confirms scheduling works.
 *   3. DB-announcement -> local: writes a real announcement to the DB, then shows it
 *      locally, proving the admin-authored / database-backed content path.
 *
 * On native (Capacitor) this uses @capacitor/local-notifications. In the browser admin
 * panel it falls back to the Web Notification API so the buttons still work for testing.
 */
export function AdminLocalNotificationTestPanel() {
  const [support, setSupport] = useState(() => ({ supported: false, channel: 'none', platform: '...' }));
  const [permission, setPermission] = useState('default');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function refresh() {
    setSupport(getLocalNotificationSupport());
    setPermission(await getLocalNotificationPermission().catch(() => 'unsupported'));
  }

  useEffect(() => {
    refresh().catch(() => {});
  }, []);

  async function ensurePermission() {
    const result = await requestLocalNotificationPermission();
    setPermission(result);
    if (result !== 'granted') {
      throw new Error(
        result === 'denied'
          ? 'Local notification permission is blocked. Enable notifications for this app/site, then retry.'
          : 'Local notifications are not supported in this environment.'
      );
    }
  }

  async function run(kind, fn) {
    setBusy(kind);
    setMessage('');
    setError('');
    try {
      await ensurePermission();
      await fn();
    } catch (err) {
      setError(getErrorMessage(err, 'Test failed.'));
    } finally {
      setBusy('');
      refresh().catch(() => {});
    }
  }

  function handleImmediate() {
    return run('immediate', async () => {
      const result = await showLocalNotification({
        id: 910000001,
        title: 'Test notification',
        body: 'This is an immediate local notification from the admin test console.',
        url: '/notifications',
      });
      if (!result.ok) throw new Error('Could not show the local notification.');
      setMessage(`Immediate local notification fired (${result.channel}).`);
    });
  }

  function handleScheduled() {
    return run('scheduled', async () => {
      const at = new Date(Date.now() + 10_000);
      const result = await showLocalNotification({
        id: 910000002,
        title: 'Scheduled test',
        body: 'This local notification was scheduled ~10 seconds ago.',
        url: '/notifications',
        at,
      });
      if (!result.ok) throw new Error('Could not schedule the local notification.');
      setMessage(`Scheduled a local notification for ${at.toLocaleTimeString()} (${result.channel}). Keep the app open.`);
    });
  }

  function handleDbAnnouncement() {
    return run('db', async () => {
      const payload = {
        title: 'xyndrome announcement (test)',
        body: 'Admin-authored message saved to the database and shown as a local notification.',
        targetRole: 'admin',
        deliveryType: 'inside', // write to the announcements table (no push needed)
        url: '/notifications',
      };
      const dbResult = await sendAdminPushNotification(payload);
      // Now surface that same content locally to demonstrate the DB -> local display path.
      const localResult = await showLocalNotification({
        id: 910000003,
        title: payload.title,
        body: payload.body,
        url: payload.url,
      });
      if (!localResult.ok) throw new Error('Saved to DB, but could not show it locally.');
      setMessage(
        `Saved to database (${dbResult.inAppCreated ? '1' : '0'} announcement) and shown as a local notification (${localResult.channel}).`
      );
    });
  }

  const permissionTone =
    permission === 'granted'
      ? 'border-brand-success/24 bg-[var(--color-success-light)] text-brand-success'
      : 'border-brand-warning/30 bg-[var(--color-warning-light)] text-brand-warning';

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,190px),1fr))] gap-3">
        <div className="rounded-xl border border-line-soft bg-surface-card px-4 py-3">
          <strong className="block text-[18px] font-black capitalize leading-none text-ink-strong">
            {support.channel === 'native' ? `Native (${support.platform})` : support.channel === 'web' ? 'Web fallback' : 'Unsupported'}
          </strong>
          <span className="mt-1 block text-xs font-bold text-ink-muted">Delivery channel</span>
        </div>
        <div className={cx('rounded-xl border px-4 py-3', permissionTone)}>
          <strong className="block text-[18px] font-black capitalize leading-none">{permission}</strong>
          <span className="mt-1 block text-xs font-bold">Permission</span>
        </div>
      </div>

      <div className={ui.infoCard}>
        Local notifications fire on the device and need no APNs/FCM/VAPID setup. On native this uses{' '}
        <code>@capacitor/local-notifications</code>; in this browser panel it falls back to the Web Notification API so you can
        still test. The “database → local” test writes a real announcement, then shows it locally.
      </div>

      {!support.supported ? (
        <div className={ui.warningFeedback}>This environment cannot show local notifications.</div>
      ) : null}

      {message ? <div className={ui.feedbackSuccess}>{message}</div> : null}
      {error ? <div className={ui.feedbackError}>{error}</div> : null}

      <div className={ui.buttonRow}>
        <button
          type="button"
          className={ui.primaryAction}
          onClick={handleImmediate}
          disabled={Boolean(busy) || !support.supported}
        >
          {busy === 'immediate' ? 'Firing...' : 'Fire test now'}
        </button>
        <button
          type="button"
          className={ui.secondaryAction}
          onClick={handleScheduled}
          disabled={Boolean(busy) || !support.supported}
        >
          {busy === 'scheduled' ? 'Scheduling...' : 'Test scheduled (~10s)'}
        </button>
        <button
          type="button"
          className={ui.secondaryAction}
          onClick={handleDbAnnouncement}
          disabled={Boolean(busy) || !support.supported}
        >
          {busy === 'db' ? 'Saving...' : 'Test database → local'}
        </button>
        <button
          type="button"
          className={ui.ghostSmall}
          onClick={() => requestLocalNotificationPermission().then(setPermission)}
          disabled={Boolean(busy)}
        >
          Request permission
        </button>
      </div>
    </div>
  );
}
