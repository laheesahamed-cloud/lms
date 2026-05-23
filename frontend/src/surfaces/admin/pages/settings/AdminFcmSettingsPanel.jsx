import { useEffect, useState } from 'react';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { fetchFcmSettings, updateFcmSettings } from '../../../../shared/api/settings.api.js';
import { ui } from '../../../../shared/styles/tailwindClasses.js';

const defaultForm = {
  projectId: '',
  serverKey: '',
  serviceAccountPath: '',
  serviceAccountJson: '',
};

function toForm(data) {
  return {
    ...defaultForm,
    projectId: data?.projectId || '',
    serviceAccountPath: data?.serviceAccountPath || data?.privateKeyPath || '',
    serverKey: '',
    serviceAccountJson: '',
  };
}

export function AdminFcmSettingsPanel() {
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [status, setStatus] = useState({ loading: true, saving: false, error: '', success: '' });

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setStatus((current) => ({ ...current, loading: true, error: '', success: '' }));
    try {
      const data = await fetchFcmSettings();
      setSettings(data);
      setForm(toForm(data));
      setStatus((current) => ({ ...current, loading: false }));
    } catch (error) {
      setStatus((current) => ({ ...current, loading: false, error: getErrorMessage(error, 'Unable to load Android push settings') }));
    }
  }

  function patchForm(patch) {
    setForm((current) => ({ ...current, ...patch }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus((current) => ({ ...current, saving: true, error: '', success: '' }));

    try {
      const payload = { ...form };
      if (!payload.serverKey.trim()) delete payload.serverKey;
      if (!payload.serviceAccountJson.trim()) delete payload.serviceAccountJson;
      const data = await updateFcmSettings(payload);
      setSettings(data);
      setForm(toForm(data));
      setStatus((current) => ({ ...current, saving: false, success: 'Android push settings saved successfully.' }));
    } catch (error) {
      setStatus((current) => ({ ...current, saving: false, error: getErrorMessage(error, 'Unable to save Android push settings') }));
    }
  }

  return (
    <div className="min-w-0">
      {status.error ? <div className={ui.feedbackError}>{status.error}</div> : null}
      {status.success ? <div className={ui.feedbackSuccess}>{status.success}</div> : null}

      {status.loading ? (
        <div className={ui.emptyBox}>Loading Android push settings...</div>
      ) : (
        <div className="grid grid-cols-[minmax(0,1.25fr)_minmax(280px,0.85fr)] items-start gap-[18px] max-[980px]:grid-cols-1">
          <form className={ui.stackForm} onSubmit={handleSubmit}>
            <div className={ui.formGrid}>
              <label className={ui.formLabel}>
                Firebase project ID
                <input className={ui.input} value={form.projectId} onChange={(event) => patchForm({ projectId: event.target.value })} placeholder="your-firebase-project" />
              </label>
              <label className={ui.formLabel}>
                Service account file path
                <input
                  className={ui.input}
                  value={form.serviceAccountPath}
                  onChange={(event) => patchForm({ serviceAccountPath: event.target.value })}
                  placeholder="/absolute/path/to/firebase-service-account.json"
                />
              </label>
            </div>

            <label className={ui.formLabel}>
              Service account JSON
              <textarea
                className={ui.textarea}
                value={form.serviceAccountJson}
                onChange={(event) => patchForm({ serviceAccountJson: event.target.value })}
                placeholder={settings?.hasServiceAccountJson ? settings.maskedServiceAccountJson : 'Paste Firebase service account JSON'}
                rows={6}
              />
            </label>

            <label className={ui.formLabel}>
              Legacy FCM server key
              <input
                className={ui.input}
                type="password"
                value={form.serverKey}
                onChange={(event) => patchForm({ serverKey: event.target.value })}
                placeholder={settings?.hasServerKey ? settings.maskedServerKey : 'Optional legacy server key'}
              />
            </label>

            <div className={ui.buttonRow}>
              <button className={ui.primaryAction} type="submit" disabled={status.saving}>
                {status.saving ? 'Saving...' : 'Save Android push settings'}
              </button>
              <button className={ui.secondaryAction} type="button" onClick={loadSettings} disabled={status.saving}>
                Refresh
              </button>
            </div>
          </form>

          <aside className="grid min-w-0 gap-3">
            <div className="flex flex-col gap-1.5 rounded-lg border border-line-soft bg-surface-glass-subtle px-4 py-3.5">
              <span className="text-xs text-ink-soft">Configuration status</span>
              <strong className="[overflow-wrap:anywhere] text-sm leading-normal text-ink-strong">
                {settings?.configured ? 'FCM details saved' : 'Project ID and service account required'}
              </strong>
            </div>
            <div className="flex flex-col gap-1.5 rounded-lg border border-line-soft bg-surface-glass-subtle px-4 py-3.5">
              <span className="text-xs text-ink-soft">Service account</span>
              <strong className="[overflow-wrap:anywhere] text-sm leading-normal text-ink-strong">
                {settings?.hasServiceAccountJson ? settings.maskedServiceAccountJson : settings?.serviceAccountPath ? 'Using file path' : 'Not set yet'}
              </strong>
            </div>
            <div className={ui.infoCard}>
              Use Firebase Cloud Messaging for Android native app notifications. Service account JSON is preferred over the legacy server key.
            </div>
            <p className="m-0 text-[12.5px] leading-relaxed text-ink-soft">{settings?.note}</p>
          </aside>
        </div>
      )}
    </div>
  );
}
