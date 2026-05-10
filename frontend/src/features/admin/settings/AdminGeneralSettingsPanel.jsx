import { useEffect, useState } from 'react';
import { getErrorMessage } from '../../../api/client.js';
import { fetchGeneralSettings, updateGeneralSettings } from '../../../api/settings.api.js';
import { ui } from '../../../styles/tailwindClasses.js';

export function AdminGeneralSettingsPanel() {
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState({ whatsappNumber: '' });
  const [status, setStatus] = useState({ loading: true, saving: false, error: '', success: '' });

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setStatus((current) => ({ ...current, loading: true, error: '', success: '' }));

    try {
      const data = await fetchGeneralSettings();
      setSettings(data);
      setForm({ whatsappNumber: data.whatsappNumber || '' });
      setStatus((current) => ({ ...current, loading: false }));
    } catch (error) {
      setStatus((current) => ({
        ...current,
        loading: false,
        error: getErrorMessage(error, 'Unable to load general settings'),
      }));
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus((current) => ({ ...current, saving: true, error: '', success: '' }));

    try {
      const data = await updateGeneralSettings({ whatsappNumber: form.whatsappNumber });
      setSettings(data);
      setForm({ whatsappNumber: data.whatsappNumber || '' });
      setStatus((current) => ({
        ...current,
        saving: false,
        success: 'General settings updated successfully.',
      }));
    } catch (error) {
      setStatus((current) => ({
        ...current,
        saving: false,
        error: getErrorMessage(error, 'Unable to update general settings'),
      }));
    }
  }

  return (
    <div className="min-w-0">
      {status.error ? <div className={ui.feedbackError}>{status.error}</div> : null}
      {status.success ? <div className={ui.feedbackSuccess}>{status.success}</div> : null}

      {status.loading ? (
        <div className={ui.emptyBox}>Loading general settings...</div>
      ) : (
        <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(280px,0.9fr)] items-start gap-[18px] max-[900px]:grid-cols-1">
          <form className={ui.stackForm} onSubmit={handleSubmit}>
            <label className="flex flex-col gap-2 text-[13px] font-bold text-ink-strong">
              WhatsApp number
              <input className="w-full"
               
                value={form.whatsappNumber}
                onChange={(event) => setForm({ whatsappNumber: event.target.value })}
                placeholder="+8801712345678"
                autoComplete="tel"
              />
            </label>

            <div className={ui.buttonRow}>
              <button className={ui.primaryAction} type="submit" disabled={status.saving}>
                {status.saving ? 'Saving...' : 'Save general settings'}
              </button>
              <button type="button" className={ui.secondaryAction} onClick={loadSettings} disabled={status.saving}>
                Refresh
              </button>
            </div>
          </form>

          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-col gap-1.5 rounded-lg border border-line-soft bg-surface-glass-subtle px-4 py-3.5">
              <span className="text-xs text-ink-soft">WhatsApp contact</span>
              <strong className="[overflow-wrap:anywhere] text-sm leading-normal text-ink-strong">{settings?.whatsappNumber || 'Not set yet'}</strong>
            </div>
            <div className="flex flex-col gap-1.5 rounded-lg border border-line-soft bg-surface-glass-subtle px-4 py-3.5">
              <span className="text-xs text-ink-soft">Usage</span>
              <strong className="[overflow-wrap:anywhere] text-sm leading-normal text-ink-strong">Use this as the main support or admissions contact number.</strong>
            </div>
            <p className="m-0 mt-0.5 text-[12.5px] leading-relaxed text-ink-soft">{settings?.note}</p>
          </div>
        </div>
      )}
    </div>
  );
}
