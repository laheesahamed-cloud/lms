import { useEffect, useState } from 'react';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { fetchSmtpSettings, sendSmtpTestEmail, updateSmtpSettings } from '../../../../shared/api/settings.api.js';
import { XyndromeBrand } from '../../../../shared/brand/XyndromeBrand.jsx';
import { cx, ui } from '../../../../shared/styles/tailwindClasses.js';
import { PasswordField } from '../../../../shared/ui/PasswordField.jsx';

const defaultForm = {
  enabled: false,
  host: '',
  port: 587,
  security: 'starttls',
  username: '',
  password: '',
  fromName: 'xyndrome',
  fromEmail: '',
  publicUrl: 'http://localhost/lms',
  subject: 'Reset your xyndrome password',
  heading: 'Reset your password',
  intro: 'We received a request to reset your xyndrome password.',
  buttonLabel: 'Reset password',
  footer: 'If you did not request this, you can safely ignore this email.',
};

function toForm(data) {
  return {
    ...defaultForm,
    enabled: Boolean(data?.enabled),
    host: data?.host || '',
    port: Number(data?.port || 587),
    security: data?.security === 'ssl' ? 'ssl' : 'starttls',
    username: data?.username || '',
    password: '',
    fromName: data?.fromName || defaultForm.fromName,
    fromEmail: data?.fromEmail || '',
    publicUrl: data?.publicUrl || defaultForm.publicUrl,
    subject: data?.subject || defaultForm.subject,
    heading: data?.heading || defaultForm.heading,
    intro: data?.intro || defaultForm.intro,
    buttonLabel: data?.buttonLabel || defaultForm.buttonLabel,
    footer: data?.footer || defaultForm.footer,
  };
}

export function AdminSmtpSettingsPanel() {
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [testEmail, setTestEmail] = useState('');
  const [status, setStatus] = useState({ loading: true, saving: false, testing: false, error: '', success: '' });

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setStatus((current) => ({ ...current, loading: true, error: '', success: '' }));
    try {
      const data = await fetchSmtpSettings();
      setSettings(data);
      setForm(toForm(data));
      setTestEmail((current) => current || data?.fromEmail || '');
      setStatus((current) => ({ ...current, loading: false }));
    } catch (error) {
      setStatus((current) => ({ ...current, loading: false, error: getErrorMessage(error, 'Unable to load SMTP settings') }));
    }
  }

  function patchForm(patch) {
    setForm((current) => ({ ...current, ...patch }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus((current) => ({ ...current, saving: true, error: '', success: '' }));

    try {
      const payload = { ...form, port: Number(form.port || 587) };
      if (!payload.password.trim()) {
        delete payload.password;
      }
      const data = await updateSmtpSettings(payload);
      setSettings(data);
      setForm(toForm(data));
      setStatus((current) => ({ ...current, saving: false, success: 'SMTP settings saved successfully.' }));
    } catch (error) {
      setStatus((current) => ({ ...current, saving: false, error: getErrorMessage(error, 'Unable to save SMTP settings') }));
    }
  }

  async function handleTestEmail(event) {
    event.preventDefault();
    const recipient = testEmail.trim();
    setStatus((current) => ({ ...current, testing: true, error: '', success: '' }));

    try {
      const data = await sendSmtpTestEmail({ toEmail: recipient });
      setStatus((current) => ({ ...current, testing: false, success: data.message || 'SMTP test email sent.' }));
    } catch (error) {
      setStatus((current) => ({ ...current, testing: false, error: getErrorMessage(error, 'Unable to send SMTP test email') }));
    }
  }

  const previewUrl = `${String(form.publicUrl || defaultForm.publicUrl).replace(/\/+$/, '')}/auth/reset-password?token=example-token`;

  return (
    <div className="min-w-0">
      {status.error ? <div className={ui.feedbackError}>{status.error}</div> : null}
      {status.success ? <div className={ui.feedbackSuccess}>{status.success}</div> : null}

      {status.loading ? (
        <div className={ui.emptyBox}>Loading SMTP settings...</div>
      ) : (
        <div className="grid grid-cols-[minmax(0,1.25fr)_minmax(300px,0.95fr)] items-start gap-[18px] max-[980px]:grid-cols-1">
          <form className={ui.stackForm} onSubmit={handleSubmit}>
            <div className="grid gap-3 rounded-lg border border-line-soft bg-surface-glass-subtle p-4">
              <label className={ui.checkboxRow}>
                <input type="checkbox" checked={form.enabled} onChange={(event) => patchForm({ enabled: event.target.checked })} />
                Send password reset emails with SMTP
              </label>
              <p className="m-0 text-[12.5px] leading-relaxed text-ink-soft">
                Keep this off until your host, sender, username, and password are filled. Secrets stay on the backend.
              </p>
            </div>

            <div className={ui.formGrid}>
              <label className={ui.formLabel}>
                SMTP host
                <input className={ui.input} value={form.host} onChange={(event) => patchForm({ host: event.target.value })} placeholder="mail.yourdomain.com" />
              </label>
              <label className={ui.formLabel}>
                Port
                <input className={ui.input} type="number" min="1" max="65535" value={form.port} onChange={(event) => patchForm({ port: event.target.value })} />
              </label>
              <label className={ui.formLabel}>
                Security
                <select className={ui.input} value={form.security} onChange={(event) => patchForm({ security: event.target.value })}>
                  <option value="starttls">STARTTLS / 587</option>
                  <option value="ssl">SSL / 465</option>
                </select>
              </label>
              <label className={ui.formLabel}>
                SMTP username
                <input className={ui.input} value={form.username} onChange={(event) => patchForm({ username: event.target.value })} placeholder="support@yourdomain.com" autoComplete="username" />
              </label>
              <PasswordField
                label="SMTP password"
                value={form.password}
                onChange={(event) => patchForm({ password: event.target.value })}
                placeholder={settings?.hasPassword ? settings.maskedPassword : 'Paste SMTP/app password'}
                autoComplete="new-password"
              />
              <label className={ui.formLabel}>
                Public app URL
                <input className={ui.input} value={form.publicUrl} onChange={(event) => patchForm({ publicUrl: event.target.value })} placeholder="https://yourdomain.com/lms" />
              </label>
            </div>

            <div className={ui.formGrid}>
              <label className={ui.formLabel}>
                From name
                <input className={ui.input} value={form.fromName} onChange={(event) => patchForm({ fromName: event.target.value })} />
              </label>
              <label className={ui.formLabel}>
                From email
                <input className={ui.input} type="email" value={form.fromEmail} onChange={(event) => patchForm({ fromEmail: event.target.value })} placeholder="support@yourdomain.com" />
              </label>
            </div>

            <div className="grid gap-4 rounded-lg border border-line-soft bg-surface-glass-subtle p-4">
              <strong className="text-sm text-ink-strong">Password reset email format</strong>
              <label className={ui.formLabel}>
                Subject
                <input className={ui.input} value={form.subject} onChange={(event) => patchForm({ subject: event.target.value })} />
              </label>
              <label className={ui.formLabel}>
                Heading
                <input className={ui.input} value={form.heading} onChange={(event) => patchForm({ heading: event.target.value })} />
              </label>
              <label className={ui.formLabel}>
                Intro text
                <textarea className={ui.textarea} value={form.intro} onChange={(event) => patchForm({ intro: event.target.value })} />
              </label>
              <label className={ui.formLabel}>
                Button label
                <input className={ui.input} value={form.buttonLabel} onChange={(event) => patchForm({ buttonLabel: event.target.value })} />
              </label>
              <label className={ui.formLabel}>
                Footer note
                <textarea className={ui.textarea} value={form.footer} onChange={(event) => patchForm({ footer: event.target.value })} />
              </label>
            </div>

            <div className={ui.buttonRow}>
              <button className={ui.primaryAction} type="submit" disabled={status.saving}>
                {status.saving ? 'Saving...' : 'Save SMTP settings'}
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
                {settings?.configured ? 'SMTP details saved' : 'Host, username, password, and sender email required'}
              </strong>
            </div>

            <form className="grid gap-3 rounded-lg border border-line-soft bg-surface-glass-subtle p-4" onSubmit={handleTestEmail}>
              <strong className="text-sm text-ink-strong">Send test email</strong>
              <label className={ui.formLabel}>
                Recipient email
                <input
                  className={ui.input}
                  type="email"
                  value={testEmail}
                  onChange={(event) => setTestEmail(event.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </label>
              <button
                className={ui.secondaryAction}
                type="submit"
                disabled={status.testing || status.saving || !settings?.configured || !settings?.enabled}
              >
                {status.testing ? 'Sending test...' : 'Send test email'}
              </button>
              <p className="m-0 text-[12px] leading-relaxed text-ink-soft">
                Save SMTP settings first. The test uses saved encrypted credentials, not unsaved form values.
              </p>
            </form>

            <div className="overflow-hidden rounded-lg border border-line-soft bg-surface-card shadow-sm">
              <div className="bg-[linear-gradient(135deg,#2563EB,#0EA5E9)] px-5 py-4 text-white">
                <XyndromeBrand
                  className="max-w-full"
                  markSize={34}
                  logoVariant="dark"
                  subtitle="Password reset"
                  textClassName="!text-[19px] !text-white"
                  subtitleClassName="!text-[10px] !text-white/70"
                  style={{
                    '--xyndrome-logo-scope': '#dbeafe',
                    '--xyndrome-brand-text': '#ffffff',
                    '--xyndrome-brand-muted': 'rgba(255,255,255,0.7)',
                  }}
                />
                <h3 className="m-0 mt-2 text-[22px] font-black leading-tight">{form.heading}</h3>
              </div>
              <div className="grid gap-4 p-5">
                <p className="m-0 text-[14px] leading-relaxed text-ink-medium">{form.intro}</p>
                <span className={cx(ui.primaryAction, 'w-fit rounded-lg px-4 py-3 text-[13px]')}>{form.buttonLabel}</span>
                <p className="m-0 text-[12px] leading-relaxed text-ink-soft">This link expires in 30 minutes.</p>
                <p className="m-0 break-all text-[11.5px] leading-relaxed text-ink-muted">{previewUrl}</p>
              </div>
              <div className="border-t border-line-soft bg-surface-2 px-5 py-4 text-[12px] leading-relaxed text-ink-soft">
                {form.footer}
              </div>
            </div>

            <div className={ui.warningFeedback}>
              For real users, set Public app URL to your live LMS URL. Localhost reset links only work on your machine.
            </div>
            <p className="m-0 text-[12.5px] leading-relaxed text-ink-soft">{settings?.note}</p>
          </aside>
        </div>
      )}
    </div>
  );
}
