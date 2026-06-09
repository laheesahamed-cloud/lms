import { useEffect, useState } from 'react';
import { cx, ui } from '../../../../shared/styles/tailwindClasses.js';
import {
  getStudyReminderPrefs,
  saveStudyReminderPrefs,
  reconcileStudyReminders,
} from '../../../../shared/notifications/studyReminders.js';
import {
  getLocalNotificationSupport,
  getLocalNotificationPermission,
  requestLocalNotificationPermission,
} from '../../../../shared/platform/native/LocalNotifications.js';

/**
 * Student-facing controls for on-device study reminders:
 *   - Planner due-date reminders (remind N hours before tasks/exams)
 *   - A daily custom reminder at a chosen time
 *
 * Saving reconciles the scheduled local notifications immediately.
 */
export function StudyReminderSettingsCard() {
  const [prefs, setPrefs] = useState(() => getStudyReminderPrefs());
  const [support] = useState(() => getLocalNotificationSupport());
  const [permission, setPermission] = useState('default');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    getLocalNotificationPermission().then(setPermission).catch(() => {});
  }, []);

  function update(patch) {
    setPrefs((current) => ({ ...current, ...patch }));
    setMessage('');
  }

  async function handleSave() {
    setBusy(true);
    setMessage('');
    try {
      saveStudyReminderPrefs(prefs);
      const wantsReminders = prefs.plannerEnabled || prefs.customEnabled;
      if (wantsReminders) {
        const perm = await requestLocalNotificationPermission();
        setPermission(perm);
        if (perm !== 'granted') {
          setMessage('Saved, but notifications are blocked. Enable notification permission to receive reminders.');
          return;
        }
      }
      const result = await reconcileStudyReminders();
      setMessage(
        result.ok
          ? `Saved. ${result.scheduled} reminder${result.scheduled === 1 ? '' : 's'} scheduled.`
          : 'Saved. Reminders will schedule once notifications are allowed.'
      );
    } finally {
      setBusy(false);
    }
  }

  if (!support.supported) return null;

  return (
    <section className="grid gap-3 rounded-2xl border border-line-soft bg-surface-card p-4" aria-label="Study reminders">
      <div>
        <h2 className="m-0 text-base font-black text-ink-strong">Study reminders</h2>
        <p className="m-0 mt-1 text-[12.5px] leading-relaxed text-ink-soft">
          On-device reminders. {support.channel === 'native' ? 'Delivered by your installed app.' : 'Delivered by this browser while open.'}
        </p>
      </div>

      <label className="flex items-center justify-between gap-3 text-[13px] font-semibold text-ink-medium">
        <span>Remind me before planner tasks are due</span>
        <input
          type="checkbox"
          checked={Boolean(prefs.plannerEnabled)}
          onChange={(event) => update({ plannerEnabled: event.target.checked })}
        />
      </label>

      {prefs.plannerEnabled ? (
        <label className={ui.formLabel}>
          Lead time (hours before due)
          <input
            className={ui.input}
            type="number"
            min={0}
            max={72}
            value={prefs.plannerLeadHours}
            onChange={(event) => update({ plannerLeadHours: Number(event.target.value) })}
          />
        </label>
      ) : null}

      <label className="flex items-center justify-between gap-3 text-[13px] font-semibold text-ink-medium">
        <span>Daily study reminder</span>
        <input
          type="checkbox"
          checked={Boolean(prefs.customEnabled)}
          onChange={(event) => update({ customEnabled: event.target.checked })}
        />
      </label>

      {prefs.customEnabled ? (
        <label className={ui.formLabel}>
          Reminder time
          <input
            className={ui.input}
            type="time"
            value={prefs.customTime}
            onChange={(event) => update({ customTime: event.target.value })}
          />
        </label>
      ) : null}

      {permission === 'denied' ? (
        <div className={ui.warningFeedback}>Notification permission is blocked. Allow notifications to receive reminders.</div>
      ) : null}
      {message ? <div className={ui.feedbackSuccess}>{message}</div> : null}

      <div className={ui.buttonRow}>
        <button type="button" className={cx(ui.primaryAction)} onClick={handleSave} disabled={busy}>
          {busy ? 'Saving...' : 'Save reminders'}
        </button>
      </div>
    </section>
  );
}
