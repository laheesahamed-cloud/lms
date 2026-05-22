import { useEffect, useState } from 'react';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { fetchPaymentSettings, updatePaymentSettings } from '../../../../shared/api/settings.api.js';
import { ui } from '../../../../shared/styles/tailwindClasses.js';

const defaultForm = {
  enabled: false,
  sandboxMode: true,
  merchantId: '',
  merchantSecret: '',
  currency: 'LKR',
  returnUrl: '',
  cancelUrl: '',
  notifyUrl: '',
  checkoutTitle: 'ERPM LMS subscription',
  buttonLabel: 'Pay with PayHere',
  supportText: 'Sandbox payments are simulated by PayHere and no real card will be charged.',
  autoActivatePaidSubscriptions: true,
};

function toForm(data) {
  return {
    ...defaultForm,
    enabled: Boolean(data?.enabled),
    sandboxMode: data?.sandboxMode !== false,
    merchantId: data?.merchantId || '',
    merchantSecret: '',
    currency: 'LKR',
    returnUrl: data?.returnUrl || '',
    cancelUrl: data?.cancelUrl || '',
    notifyUrl: data?.notifyUrl || '',
    checkoutTitle: data?.checkoutTitle || defaultForm.checkoutTitle,
    buttonLabel: data?.buttonLabel || defaultForm.buttonLabel,
    supportText: data?.supportText || defaultForm.supportText,
    autoActivatePaidSubscriptions: data?.autoActivatePaidSubscriptions !== false,
  };
}

export function AdminPaymentSettingsPanel() {
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [status, setStatus] = useState({ loading: true, saving: false, error: '', success: '' });

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setStatus((current) => ({ ...current, loading: true, error: '', success: '' }));
    try {
      const data = await fetchPaymentSettings();
      setSettings(data);
      setForm(toForm(data));
      setStatus((current) => ({ ...current, loading: false }));
    } catch (error) {
      setStatus((current) => ({
        ...current,
        loading: false,
        error: getErrorMessage(error, 'Unable to load payment settings'),
      }));
    }
  }

  function patchForm(patch) {
    setForm((current) => ({ ...current, ...patch }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus((current) => ({ ...current, saving: true, error: '', success: '' }));

    try {
      const payload = { ...form, currency: 'LKR' };
      if (!payload.merchantSecret.trim()) {
        delete payload.merchantSecret;
      }
      const data = await updatePaymentSettings(payload);
      setSettings(data);
      setForm(toForm(data));
      setStatus((current) => ({
        ...current,
        saving: false,
        success: 'Payment settings updated successfully.',
      }));
    } catch (error) {
      setStatus((current) => ({
        ...current,
        saving: false,
        error: getErrorMessage(error, 'Unable to update payment settings'),
      }));
    }
  }

  return (
    <div className="min-w-0">
      {status.error ? <div className={ui.feedbackError}>{status.error}</div> : null}
      {status.success ? <div className={ui.feedbackSuccess}>{status.success}</div> : null}

      {status.loading ? (
        <div className={ui.emptyBox}>Loading payment settings...</div>
      ) : (
        <div className="grid grid-cols-[minmax(0,1.35fr)_minmax(280px,0.9fr)] items-start gap-[18px] max-[900px]:grid-cols-1">
          <form className={ui.stackForm} onSubmit={handleSubmit}>
            <div className="grid gap-3 rounded-lg border border-line-soft bg-surface-glass-subtle p-4">
              <label className={ui.checkboxRow}>
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(event) => patchForm({ enabled: event.target.checked })}
                />
                Enable PayHere checkout for students
              </label>
              <label className={ui.checkboxRow}>
                <input
                  type="checkbox"
                  checked={form.sandboxMode}
                  onChange={(event) => patchForm({ sandboxMode: event.target.checked })}
                />
                Use sandbox mode
              </label>
              <label className={ui.checkboxRow}>
                <input
                  type="checkbox"
                  checked={form.autoActivatePaidSubscriptions}
                  onChange={(event) => patchForm({ autoActivatePaidSubscriptions: event.target.checked })}
                />
                Automatically activate subscriptions after verified payment
              </label>
            </div>

            <div className={ui.formGrid}>
              <label className={ui.formLabel}>
                Merchant ID
                <input
                  className={ui.input}
                  value={form.merchantId}
                  onChange={(event) => patchForm({ merchantId: event.target.value })}
                  placeholder="121XXXX"
                />
              </label>
              <label className={ui.formLabel}>
                Merchant secret
                <input
                  className={ui.input}
                  value={form.merchantSecret}
                  onChange={(event) => patchForm({ merchantSecret: event.target.value })}
                  placeholder={settings?.hasMerchantSecret ? settings.maskedMerchantSecret : 'Paste sandbox merchant secret'}
                  type="password"
                  autoComplete="new-password"
                />
              </label>
              <label className={ui.formLabel}>
                Currency
                <select className={ui.input} value={form.currency} onChange={(event) => patchForm({ currency: event.target.value })}>
                  <option value="LKR">LKR</option>
                </select>
              </label>
              <label className={ui.formLabel}>
                Checkout title
                <input className={ui.input} value={form.checkoutTitle} onChange={(event) => patchForm({ checkoutTitle: event.target.value })} />
              </label>
              <label className={ui.formLabel}>
                Button label
                <input className={ui.input} value={form.buttonLabel} onChange={(event) => patchForm({ buttonLabel: event.target.value })} />
              </label>
            </div>

            <label className={ui.formLabel}>
              Student payment note
              <textarea className={ui.textarea} value={form.supportText} onChange={(event) => patchForm({ supportText: event.target.value })} />
            </label>

            <div className={ui.formGrid}>
              <label className={ui.formLabel}>
                Return URL override
                <input className={ui.input} value={form.returnUrl} onChange={(event) => patchForm({ returnUrl: event.target.value })} placeholder="Leave blank to use the LMS subscriptions page" />
              </label>
              <label className={ui.formLabel}>
                Cancel URL override
                <input className={ui.input} value={form.cancelUrl} onChange={(event) => patchForm({ cancelUrl: event.target.value })} placeholder="Leave blank to use the LMS subscriptions page" />
              </label>
              <label className={ui.formLabel}>
                Notify URL override
                <input className={ui.input} value={form.notifyUrl} onChange={(event) => patchForm({ notifyUrl: event.target.value })} placeholder="Public URL required for PayHere callbacks" />
              </label>
            </div>

            <div className={ui.buttonRow}>
              <button className={ui.primaryAction} type="submit" disabled={status.saving}>
                {status.saving ? 'Saving...' : 'Save PayHere settings'}
              </button>
              <button type="button" className={ui.secondaryAction} onClick={loadSettings} disabled={status.saving}>
                Refresh
              </button>
            </div>
          </form>

          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-col gap-1.5 rounded-lg border border-line-soft bg-surface-glass-subtle px-4 py-3.5">
              <span className="text-xs text-ink-soft">Active PayHere endpoint</span>
              <strong className="[overflow-wrap:anywhere] text-sm leading-normal text-ink-strong">{settings?.actionUrl || '-'}</strong>
            </div>
            <div className="flex flex-col gap-1.5 rounded-lg border border-line-soft bg-surface-glass-subtle px-4 py-3.5">
              <span className="text-xs text-ink-soft">Configuration status</span>
              <strong className="[overflow-wrap:anywhere] text-sm leading-normal text-ink-strong">
                {settings?.configured
                  ? settings?.sandboxMode
                    ? 'Ready for sandbox checkout'
                    : 'Ready for live checkout'
                  : 'Merchant ID and secret required'}
              </strong>
            </div>
            <div className={ui.warningFeedback}>
              PayHere cannot send server notifications to localhost. Use the notify URL override with a public HTTPS URL when testing callbacks.
            </div>
            <p className="m-0 mt-0.5 text-[12.5px] leading-relaxed text-ink-soft">{settings?.note}</p>
          </div>
        </div>
      )}
    </div>
  );
}
