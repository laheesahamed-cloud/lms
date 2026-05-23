import { useEffect, useState } from 'react';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { fetchApnsSettings, updateApnsSettings } from '../../../../shared/api/settings.api.js';
import { ui } from '../../../../shared/styles/tailwindClasses.js';

const defaultForm = {
  keyId: '',
  teamId: '',
  bundleId: 'com.erpm.medical.lms',
  useSandbox: true,
  privateKeyPath: '',
  privateKey: '',
};

function toForm(data) {
  return {
    ...defaultForm,
    keyId: data?.keyId || '',
    teamId: data?.teamId || '',
    bundleId: data?.bundleId || defaultForm.bundleId,
    useSandbox: data?.useSandbox !== false,
    privateKeyPath: data?.privateKeyPath || '',
    privateKey: '',
  };
}

export function AdminApnsSettingsPanel() {
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [status, setStatus] = useState({ loading: true, saving: false, error: '', success: '' });

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setStatus((current) => ({ ...current, loading: true, error: '', success: '' }));
    try {
      const data = await fetchApnsSettings();
      setSettings(data);
      setForm(toForm(data));
      setStatus((current) => ({ ...current, loading: false }));
    } catch (error) {
      setStatus((current) => ({ ...current, loading: false, error: getErrorMessage(error, 'Unable to load iOS push settings') }));
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
      if (!payload.privateKey.trim()) {
        delete payload.privateKey;
      }
      const data = await updateApnsSettings(payload);
      setSettings(data);
      setForm(toForm(data));
      setStatus((current) => ({ ...current, saving: false, success: 'iOS push settings saved successfully.' }));
    } catch (error) {
      setStatus((current) => ({ ...current, saving: false, error: getErrorMessage(error, 'Unable to save iOS push settings') }));
    }
  }

  return (
    <div className="min-w-0">
      {status.error ? <div className={ui.feedbackError}>{status.error}</div> : null}
      {status.success ? <div className={ui.feedbackSuccess}>{status.success}</div> : null}

      {status.loading ? (
        <div className={ui.emptyBox}>Loading iOS push settings...</div>
      ) : (
        <div className="grid grid-cols-[minmax(0,1.25fr)_minmax(280px,0.85fr)] items-start gap-[18px] max-[980px]:grid-cols-1">
          <form className={ui.stackForm} onSubmit={handleSubmit}>
            <div className="grid gap-3 rounded-lg border border-line-soft bg-surface-glass-subtle p-4">
              <label className={ui.checkboxRow}>
                <input type="checkbox" checked={form.useSandbox} onChange={(event) => patchForm({ useSandbox: event.target.checked })} />
                Use APNs sandbox for debug/simulator builds
              </label>
              <p className="m-0 text-[12.5px] leading-relaxed text-ink-soft">
                Keep sandbox on for local Xcode debug builds. Turn it off only for production/TestFlight tokens.
              </p>
            </div>

            <div className={ui.formGrid}>
              <label className={ui.formLabel}>
                APNs Key ID
                <input className={ui.input} value={form.keyId} onChange={(event) => patchForm({ keyId: event.target.value })} placeholder="ABC123DEFG" />
              </label>
              <label className={ui.formLabel}>
                Apple Team ID
                <input className={ui.input} value={form.teamId} onChange={(event) => patchForm({ teamId: event.target.value })} placeholder="1A2B3C4D5E" />
              </label>
              <label className={ui.formLabel}>
                Bundle ID
                <input className={ui.input} value={form.bundleId} onChange={(event) => patchForm({ bundleId: event.target.value })} placeholder="com.erpm.medical.lms" />
              </label>
            </div>

            <label className={ui.formLabel}>
              Private key file path
              <input
                className={ui.input}
                value={form.privateKeyPath}
                onChange={(event) => patchForm({ privateKeyPath: event.target.value })}
                placeholder="/absolute/path/to/AuthKey_ABC123DEFG.p8"
              />
              <span className="text-[12px] font-medium leading-relaxed text-ink-soft">
                Recommended for local servers. The backend must be able to read this file.
              </span>
            </label>

            <label className={ui.formLabel}>
              Private key text
              <textarea
                className={ui.textarea}
                value={form.privateKey}
                onChange={(event) => patchForm({ privateKey: event.target.value })}
                placeholder={settings?.hasPrivateKey ? settings.maskedPrivateKey : 'Paste AuthKey .p8 content'}
                rows={6}
              />
              <span className="text-[12px] font-medium leading-relaxed text-ink-soft">
                Optional alternative to file path. Stored encrypted and masked after saving.
              </span>
            </label>

            <div className={ui.buttonRow}>
              <button className={ui.primaryAction} type="submit" disabled={status.saving}>
                {status.saving ? 'Saving...' : 'Save iOS push settings'}
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
                {settings?.configured ? 'APNs details saved' : 'Key ID, Team ID, Bundle ID, and private key required'}
              </strong>
            </div>
            <div className="flex flex-col gap-1.5 rounded-lg border border-line-soft bg-surface-glass-subtle px-4 py-3.5">
              <span className="text-xs text-ink-soft">APNs environment</span>
              <strong className="[overflow-wrap:anywhere] text-sm leading-normal text-ink-strong">
                {form.useSandbox ? 'Sandbox' : 'Production'}
              </strong>
            </div>
            <div className="flex flex-col gap-1.5 rounded-lg border border-line-soft bg-surface-glass-subtle px-4 py-3.5">
              <span className="text-xs text-ink-soft">Private key</span>
              <strong className="[overflow-wrap:anywhere] text-sm leading-normal text-ink-strong">
                {settings?.hasPrivateKey ? settings.maskedPrivateKey : settings?.privateKeyPath ? 'Using file path' : 'Not set yet'}
              </strong>
            </div>
            <div className={ui.infoCard}>
              After saving, rebuild/run the iOS app from Xcode if entitlements or signing changed. Real APNs delivery still requires an Apple Developer push-enabled app ID.
            </div>
            <p className="m-0 text-[12.5px] leading-relaxed text-ink-soft">{settings?.note}</p>
          </aside>
        </div>
      )}
    </div>
  );
}
