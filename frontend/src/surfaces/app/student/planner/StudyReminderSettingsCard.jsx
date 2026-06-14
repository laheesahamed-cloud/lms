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

function Toggle({ checked, onChange, id }) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        width: '51px',
        height: '31px',
        borderRadius: '999px',
        padding: '2px',
        background: checked ? 'var(--color-primary, #2563eb)' : 'var(--surface-3, rgba(120,120,128,0.32))',
        border: 'none',
        cursor: 'pointer',
        transition: 'background 220ms ease',
        boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.1)',
      }}
    >
      <span
        style={{
          display: 'block',
          width: '27px',
          height: '27px',
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
          transform: checked ? 'translateX(20px)' : 'translateX(0)',
          transition: 'transform 220ms cubic-bezier(0.34,1.56,0.64,1)',
        }}
      />
    </button>
  );
}

function HourStepper({ value, onChange }) {
  const num = Number(value) || 0;
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0',
      border: '1px solid var(--line-soft)',
      borderRadius: '10px',
      overflow: 'hidden',
      height: '38px',
    }}>
      <button
        type="button"
        aria-label="Decrease hours"
        disabled={num <= 0}
        onClick={() => onChange(Math.max(0, num - 1))}
        style={{
          width: '44px',
          height: '100%',
          background: 'transparent',
          border: 'none',
          fontSize: '20px',
          fontWeight: 300,
          color: num <= 0 ? 'var(--ink-muted)' : 'var(--ink-strong)',
          cursor: num <= 0 ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        −
      </button>
      <span style={{
        minWidth: '40px',
        textAlign: 'center',
        fontSize: '15px',
        fontWeight: 600,
        color: 'var(--ink-strong)',
        borderLeft: '1px solid var(--line-soft)',
        borderRight: '1px solid var(--line-soft)',
        padding: '0 4px',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {num}h
      </span>
      <button
        type="button"
        aria-label="Increase hours"
        disabled={num >= 72}
        onClick={() => onChange(Math.min(72, num + 1))}
        style={{
          width: '44px',
          height: '100%',
          background: 'transparent',
          border: 'none',
          fontSize: '20px',
          fontWeight: 300,
          color: num >= 72 ? 'var(--ink-muted)' : 'var(--ink-strong)',
          cursor: num >= 72 ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        +
      </button>
    </div>
  );
}

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

      <label className="flex items-center justify-between gap-3 text-[13px] font-semibold text-ink-medium" htmlFor="planner-toggle">
        <span>Remind me before planner tasks are due</span>
        <Toggle
          id="planner-toggle"
          checked={Boolean(prefs.plannerEnabled)}
          onChange={(val) => update({ plannerEnabled: val })}
        />
      </label>

      {prefs.plannerEnabled ? (
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] font-semibold text-ink-medium">Lead time (hours before due)</span>
          <HourStepper
            value={prefs.plannerLeadHours}
            onChange={(val) => update({ plannerLeadHours: val })}
          />
        </div>
      ) : null}

      <label className="flex items-center justify-between gap-3 text-[13px] font-semibold text-ink-medium" htmlFor="daily-toggle">
        <span>Daily study reminder</span>
        <Toggle
          id="daily-toggle"
          checked={Boolean(prefs.customEnabled)}
          onChange={(val) => update({ customEnabled: val })}
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
