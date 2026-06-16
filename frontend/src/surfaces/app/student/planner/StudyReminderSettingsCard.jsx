import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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
import { ImpactStyle, nativeImpact } from '../../../../shared/utils/nativeHaptics.js';

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
        width: '40px',
        height: '14px',
        borderRadius: '999px',
        padding: '2px',
        background: checked
          ? 'color-mix(in srgb, var(--color-primary, #2563eb) 50%, transparent)'
          : 'rgba(120, 120, 128, 0.32)',
        border: 'none',
        cursor: 'pointer',
        transition: 'background 250ms cubic-bezier(0.32, 0.72, 0, 1)',
        boxShadow: 'none',
        touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent',
        userSelect: 'none',
      }}
    >
      <span
        style={{
          display: 'block',
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          background: checked ? 'var(--color-primary, #2563eb)' : '#fff',
          boxShadow: '0 2px 1px -1px rgba(0,0,0,0.2), 0 1px 1px 0 rgba(0,0,0,0.14), 0 1px 3px 0 rgba(0,0,0,0.12)',
          transform: checked ? 'translateX(16px)' : 'translateX(0)',
          transition: 'transform 250ms cubic-bezier(0.32, 0.72, 0, 1), background 250ms ease',
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
  const [modal, setModal] = useState(null); // null | 'planner' | 'daily'

  useEffect(() => {
    getLocalNotificationPermission().then(setPermission).catch(() => {});
  }, []);

  // Auto-dismiss the saved/feedback message a few seconds after it appears.
  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(() => setMessage(''), 3500);
    return () => window.clearTimeout(timer);
  }, [message]);

  function update(patch) {
    setPrefs((current) => ({ ...current, ...patch }));
    setMessage('');
  }

  // Persist + (re)schedule immediately, using `next` so we never read stale state.
  async function persist(next) {
    setBusy(true);
    setMessage('');
    try {
      saveStudyReminderPrefs(next);
      const wantsReminders = next.plannerEnabled || next.customEnabled;
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

  // Turning a reminder ON opens its settings popup; OFF persists immediately
  // (there is no separate Save button anymore).
  function toggleReminder(key, on) {
    void nativeImpact(ImpactStyle.Light);
    const next = { ...prefs, [key]: on };
    setPrefs(next);
    setMessage('');
    if (on) setModal(key === 'plannerEnabled' ? 'planner' : 'daily');
    else persist(next);
  }

  // "Done" — keep the toggle on and save with the current value.
  function confirmModal() {
    setModal(null);
    persist(prefs);
  }

  // Tapping outside cancels setup: flip the just-enabled toggle back off,
  // silently (no haptic) and without saving — it was never persisted on.
  function dismissModal() {
    const key = modal === 'planner' ? 'plannerEnabled' : 'customEnabled';
    setModal(null);
    setPrefs((current) => ({ ...current, [key]: false }));
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

      <label className="flex min-h-11 cursor-pointer select-none items-center justify-between gap-3 text-[13px] font-semibold text-ink-medium" htmlFor="planner-toggle">
        <span className="min-w-0 flex-1">Remind me before planner tasks are due</span>
        <Toggle
          id="planner-toggle"
          checked={Boolean(prefs.plannerEnabled)}
          onChange={(val) => toggleReminder('plannerEnabled', val)}
        />
      </label>

      <label className="flex min-h-11 cursor-pointer select-none items-center justify-between gap-3 text-[13px] font-semibold text-ink-medium" htmlFor="daily-toggle">
        <span className="min-w-0 flex-1">Daily study reminder</span>
        <Toggle
          id="daily-toggle"
          checked={Boolean(prefs.customEnabled)}
          onChange={(val) => toggleReminder('customEnabled', val)}
        />
      </label>

      {permission === 'denied' ? (
        <div className={ui.warningFeedback}>Notification permission is blocked. Allow notifications to receive reminders.</div>
      ) : null}
      {message ? <div className={ui.feedbackSuccess}>{message}</div> : null}

      {modal ? createPortal(
        <div
          className="fixed inset-0 z-[1200] flex items-center justify-center bg-[rgba(15,23,42,0.30)] p-4 backdrop-blur-md animate-overlayIn dark:bg-[rgba(2,6,23,0.66)]"
          onClick={dismissModal}
          role="presentation"
        >
          <div
            className="w-[min(380px,90vw)] rounded-[var(--ds-card-radius-compact)] border border-line-soft bg-surface-card-elevated p-5 shadow-[var(--ds-floating-shadow)] animate-fadePop dark:border-white/[0.09]"
            role="dialog"
            aria-modal="true"
            aria-label={modal === 'planner' ? 'Planner reminder settings' : 'Daily reminder settings'}
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="m-0 text-base font-black text-ink-strong">
              {modal === 'planner' ? 'Remind me before tasks' : 'Daily study reminder'}
            </h3>
            <p className="m-0 mt-1 text-[12.5px] leading-relaxed text-ink-soft">
              {modal === 'planner'
                ? 'How long before a task is due should we remind you?'
                : 'What time should we remind you each day?'}
            </p>

            <div className="mt-4">
              {modal === 'planner' ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[13px] font-semibold text-ink-medium">Lead time (hours before due)</span>
                  <HourStepper
                    value={prefs.plannerLeadHours}
                    onChange={(val) => update({ plannerLeadHours: val })}
                  />
                </div>
              ) : (
                <label className={ui.formLabel}>
                  Reminder time
                  <input
                    className={ui.input}
                    type="time"
                    value={prefs.customTime}
                    onChange={(event) => update({ customTime: event.target.value })}
                  />
                </label>
              )}
            </div>

            <div className="mt-5 flex justify-end">
              <button type="button" className={cx(ui.primaryAction)} onClick={confirmModal} disabled={busy}>
                {busy ? 'Saving...' : 'Done'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      ) : null}
    </section>
  );
}
