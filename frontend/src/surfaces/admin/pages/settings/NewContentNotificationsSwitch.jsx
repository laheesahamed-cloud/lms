import { useEffect, useState } from 'react';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { fetchGeneralSettings, updateGeneralSettings } from '../../../../shared/api/settings.api.js';
import { cx, ui } from '../../../../shared/styles/tailwindClasses.js';

/**
 * On/off switch for the automatic "new content" notification (quiz, lesson,
 * flashcards, paper published). Read by the server on every publish, so a flip
 * applies immediately — no app build or redeploy.
 */
export function NewContentNotificationsSwitch() {
  const [enabled, setEnabled] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchGeneralSettings()
      .then((data) => setEnabled(data.newContentNotifications !== false))
      .catch((err) => setError(getErrorMessage(err, 'Unable to load this setting.')));
  }, []);

  async function toggle() {
    if (enabled === null || saving) return;
    const next = !enabled;
    setSaving(true);
    setError('');
    try {
      const data = await updateGeneralSettings({ newContentNotifications: next });
      setEnabled(data.newContentNotifications !== false);
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to update this setting.'));
    } finally {
      setSaving(false);
    }
  }

  const on = enabled === true;

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-4 rounded-xl border border-line-soft bg-surface-card px-4 py-3.5">
        <div className="grid min-w-0 gap-1">
          <strong className="text-sm text-ink-strong">Notify students about new content</strong>
          <span className="text-[12.5px] font-medium leading-relaxed text-ink-soft">
            {on
              ? 'On — publishing a quiz, lesson, flashcards or paper sends students a push and an in-app announcement.'
              : enabled === null
                ? 'Loading…'
                : 'Off — publishing stays silent. Turn it on again when you want students to be told.'}
          </span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Notify students about new content"
          disabled={enabled === null || saving}
          onClick={toggle}
          className={cx(
            'relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60',
            on ? 'border-brand-primary/40 bg-brand-primary' : 'border-line-soft bg-surface-3',
          )}
        >
          <span
            className={cx(
              'inline-block size-5 rounded-full bg-white shadow transition-transform duration-150',
              on ? 'translate-x-[23px]' : 'translate-x-[3px]',
            )}
          />
        </button>
      </div>
      {error ? <div className={ui.feedbackError}>{error}</div> : null}
    </div>
  );
}
