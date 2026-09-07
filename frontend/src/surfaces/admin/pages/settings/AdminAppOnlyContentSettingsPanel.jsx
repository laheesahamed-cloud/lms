import { useEffect, useState } from 'react';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { fetchAppOnlyContentSettings, updateAppOnlyContentSettings } from '../../../../shared/api/settings.api.js';
import { ui } from '../../../../shared/styles/tailwindClasses.js';

export function AdminAppOnlyContentSettingsPanel() {
  const [settings, setSettings] = useState(null);
  const [status, setStatus] = useState({ loading: true, saving: false, error: '', success: '' });

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setStatus((current) => ({ ...current, loading: true, error: '', success: '' }));
    try {
      const data = await fetchAppOnlyContentSettings();
      setSettings(data);
      setStatus((current) => ({ ...current, loading: false }));
    } catch (error) {
      setStatus((current) => ({ ...current, loading: false, error: getErrorMessage(error, 'Unable to load setting') }));
    }
  }

  async function toggle() {
    if (status.saving || !settings) return;
    const nextEnabled = !settings.enabled;
    setStatus((current) => ({ ...current, saving: true, error: '', success: '' }));
    try {
      const data = await updateAppOnlyContentSettings({ enabled: nextEnabled });
      setSettings(data);
      setStatus((current) => ({
        ...current,
        saving: false,
        success: nextEnabled ? 'Enabled — premium content now requires the app.' : 'Disabled — website falls back to normal subscription access.',
      }));
    } catch (error) {
      setStatus((current) => ({ ...current, saving: false, error: getErrorMessage(error, 'Unable to update setting') }));
    }
  }

  const enabled = Boolean(settings?.enabled);

  return (
    <div className="min-w-0">
      {status.error ? <div className={ui.feedbackError} role="alert">{status.error}</div> : null}
      {status.success ? <div className={ui.feedbackSuccess} role="status">{status.success}</div> : null}

      {status.loading ? (
        <div className={ui.emptyBox}>Loading setting...</div>
      ) : (
        <div className="grid gap-4">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-lg border border-line-soft bg-surface-card p-4 shadow-[var(--ds-card-shadow)] max-[640px]:grid-cols-1">
            <div className="min-w-0">
              <strong className="block text-sm font-extrabold text-ink-strong">Require the mobile app for premium content</strong>
              <p className="m-0 mt-1.5 text-[12.5px] font-medium leading-relaxed text-ink-soft">
                When on, premium (non-free) quizzes, lessons, and flashcards can only be opened in the iOS/Android app —
                the website shows a "Open in the App" screen instead, even for subscribed students. Subscribing/checkout
                on the website keeps working either way. Free content is never affected.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              disabled={status.saving}
              onClick={toggle}
              className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border transition-colors duration-150 ease-out disabled:cursor-wait disabled:opacity-70 ${
                enabled ? 'border-brand-success/30 bg-brand-success' : 'border-line-soft bg-surface-2'
              }`}
            >
              <span
                className={`inline-block size-6 rounded-full bg-white shadow transition-transform duration-150 ease-out ${
                  enabled ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <p className="m-0 text-[12.5px] leading-relaxed text-ink-soft">
            Ship this together with a mobile app build that identifies itself to the backend — otherwise the app's own
            students get locked out too. Default is off, so this is always a deliberate switch, not a side effect of a
            deploy.
          </p>
        </div>
      )}
    </div>
  );
}
