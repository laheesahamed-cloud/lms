import { useState } from 'react';
import { getApiRecoverySettings, saveApiRecoverySettings } from '../../../../shared/api/client.js';
import { cx, ui } from '../../../../shared/styles/tailwindClasses.js';

export function AdminApiRecoverySettingsPanel() {
  const [form, setForm] = useState(() => getApiRecoverySettings());
  const [message, setMessage] = useState('');

  function updateField(field, value) {
    setMessage('');
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    const saved = saveApiRecoverySettings(form);
    setForm(saved);
    setMessage('API recovery settings saved for this browser.');
  }

  return (
    <div className="min-w-0">
      {message ? <div className={ui.feedbackSuccess}>{message}</div> : null}

      <div className="grid grid-cols-[minmax(0,1.25fr)_minmax(260px,0.75fr)] items-start gap-[18px] max-[900px]:grid-cols-1">
        <form className={ui.stackForm} onSubmit={handleSubmit}>
          <div className={ui.formGrid}>
            <label className={ui.formLabel}>
              API timeout
              <input
                className={ui.input}
                type="number"
                min="1000"
                max="120000"
                step="500"
                value={form.timeoutMs}
                onChange={(event) => updateField('timeoutMs', event.target.value)}
              />
              <span className="text-[12px] font-medium leading-relaxed text-ink-soft">
                Milliseconds before the app treats an API call as too slow.
              </span>
            </label>

            <label className={ui.formLabel}>
              Timeout retries
              <input
                className={ui.input}
                type="number"
                min="0"
                max="5"
                step="1"
                value={form.timeoutRetryCount}
                onChange={(event) => updateField('timeoutRetryCount', event.target.value)}
              />
              <span className="text-[12px] font-medium leading-relaxed text-ink-soft">
                Automatic retry attempts after a timeout.
              </span>
            </label>

            <label className={ui.formLabel}>
              Retry delay
              <input
                className={ui.input}
                type="number"
                min="0"
                max="10000"
                step="100"
                value={form.retryDelayMs}
                onChange={(event) => updateField('retryDelayMs', event.target.value)}
              />
              <span className="text-[12px] font-medium leading-relaxed text-ink-soft">
                Milliseconds to wait before retrying.
              </span>
            </label>
          </div>

          <label className={cx(ui.formLabel, 'flex-row items-start gap-3 rounded-lg border border-line-soft bg-surface-1 p-3')}>
            <input
              className="mt-1 size-4 accent-[var(--color-primary)]"
              type="checkbox"
              checked={form.retryWriteRequests}
              onChange={(event) => updateField('retryWriteRequests', event.target.checked)}
            />
            <span className="grid gap-1">
              <strong className="text-sm text-ink-strong">Retry write requests too</strong>
              <span className="text-[12px] font-medium leading-relaxed text-ink-soft">
                Keep this on to recover slow saves, submits, AI generation, and deletes after a timeout.
              </span>
            </span>
          </label>

          <div className={ui.buttonRow}>
            <button className={ui.primaryAction} type="submit">
              Save API recovery
            </button>
          </div>
        </form>

        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-col gap-1.5 rounded-lg border border-line-soft bg-surface-glass-subtle px-4 py-3.5">
            <span className="text-xs text-ink-soft">Current timeout</span>
            <strong className="[overflow-wrap:anywhere] text-sm leading-normal text-ink-strong">{Number(form.timeoutMs || 0).toLocaleString()} ms</strong>
          </div>
          <div className="flex flex-col gap-1.5 rounded-lg border border-line-soft bg-surface-glass-subtle px-4 py-3.5">
            <span className="text-xs text-ink-soft">Automatic recovery</span>
            <strong className="[overflow-wrap:anywhere] text-sm leading-normal text-ink-strong">
              {Number(form.timeoutRetryCount || 0) > 0 ? `${form.timeoutRetryCount} retry attempt(s)` : 'Retries disabled'}
            </strong>
          </div>
          <div className={ui.infoCard}>
            Timed-out requests retry automatically with a longer timeout. Turn off write retries only if a sensitive endpoint cannot safely receive a retry.
          </div>
        </div>
      </div>
    </div>
  );
}
