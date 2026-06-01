import { useEffect, useState } from 'react';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { fetchAvailabilitySettings, updateAvailabilitySettings } from '../../../../shared/api/settings.api.js';
import { XyndromeBrand } from '../../../../shared/brand/XyndromeBrand.jsx';
import { withRouterBasename } from '../../../../shared/platform/config.js';
import { useAvailabilityStore } from '../../../../shared/stores/availabilityStore.js';
import { cx, ui } from '../../../../shared/styles/tailwindClasses.js';

const modeOptions = [
  {
    mode: 'live',
    label: 'Live',
    shortLabel: 'Live',
    description: 'Normal access for website, student app, and native apps.',
    scope: 'Website, app, native, and PWA are open.',
    impact: 'Visitors and students continue normally.',
    tone: 'text-brand-success bg-[var(--color-success-light)] border-brand-success/24',
    selectedClass: 'border-brand-success/32 bg-[color-mix(in_srgb,var(--color-success)_7%,var(--surface-card))] shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-success)_10%,transparent)]',
    icon: 'live',
  },
  {
    mode: 'maintenance',
    label: 'Maintenance',
    shortLabel: 'Pause all',
    description: 'Send visitors and students to the launch landing screen while admin routes stay open.',
    scope: 'Only admin routes load; everyone else lands on the launch screen.',
    impact: 'Use this when you need a clean pause.',
    tone: 'text-brand-warning bg-[var(--color-warning-light)] border-brand-warning/28',
    selectedClass: 'border-brand-warning/34 bg-[color-mix(in_srgb,var(--color-warning)_7%,var(--surface-card))] shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-warning)_10%,transparent)]',
    icon: 'maintenance',
  },
  {
    mode: 'coming-soon',
    label: 'Coming soon',
    shortLabel: 'Pre-launch',
    description: 'Send visitors and students to the coming soon landing screen while admin routes stay open.',
    scope: 'Only admin routes load; everyone else lands on the launch screen.',
    impact: 'Use this before opening the LMS publicly.',
    tone: 'text-brand-primary bg-[var(--color-primary-light)] border-brand-primary/24',
    selectedClass: 'border-brand-primary/36 bg-[color-mix(in_srgb,var(--color-primary)_7%,var(--surface-card))] shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-primary)_10%,transparent)]',
    icon: 'coming-soon',
  },
];

function previewPath(mode) {
  return withRouterBasename(`/launch-preview/${mode}`);
}

function LaunchModeIcon({ type }) {
  if (type === 'maintenance') {
    return (
      <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
        <path d="M5 19L19 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M7.5 5H19v11.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 16.5V5h11.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.45" />
      </svg>
    );
  }

  if (type === 'coming-soon') {
    return (
      <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
        <path d="M12 4v4.5M12 15.5V20M4 12h4.5M15.5 12H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M8.8 8.8l-2.6-2.6M15.2 8.8l2.6-2.6M8.8 15.2l-2.6 2.6M15.2 15.2l2.6 2.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity="0.5" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
      <path d="M5 12.5l4.2 4.2L19 6.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 19.5h15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.45" />
    </svg>
  );
}

export function AdminAvailabilitySettingsPanel() {
  const [settings, setSettings] = useState(null);
  const [unlockCodeDraft, setUnlockCodeDraft] = useState('');
  const [status, setStatus] = useState({ loading: true, savingMode: '', savingCode: false, error: '', success: '' });

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setStatus((current) => ({ ...current, loading: true, error: '', success: '' }));

    try {
      const data = await fetchAvailabilitySettings();
      setSettings(data);
      setUnlockCodeDraft(data.unlockCode || '');
      useAvailabilityStore.getState().setAvailability(data);
      setStatus((current) => ({ ...current, loading: false }));
    } catch (error) {
      setStatus((current) => ({
        ...current,
        loading: false,
        error: getErrorMessage(error, 'Unable to load launch mode settings'),
      }));
    }
  }

  async function changeMode(mode) {
    if (status.savingMode || settings?.mode === mode) return;

    setStatus((current) => ({ ...current, savingMode: mode, error: '', success: '' }));
    try {
      const data = await updateAvailabilitySettings({ mode });
      setSettings(data);
      useAvailabilityStore.getState().setAvailability(data);
      const selected = modeOptions.find((option) => option.mode === data.mode);
      setStatus((current) => ({
        ...current,
        savingMode: '',
        success: `${selected?.label || 'Launch mode'} is active now.`,
      }));
    } catch (error) {
      setStatus((current) => ({
        ...current,
        savingMode: '',
        error: getErrorMessage(error, 'Unable to update launch mode'),
      }));
    }
  }

  async function saveUnlockCode(event) {
    event.preventDefault();
    if (status.savingCode) return;

    const unlockCode = unlockCodeDraft.trim();
    if (!/^\d{4,20}$/.test(unlockCode)) {
      setStatus((current) => ({
        ...current,
        error: 'Secret code must be 4 to 20 digits.',
        success: '',
      }));
      return;
    }

    setStatus((current) => ({ ...current, savingCode: true, error: '', success: '' }));
    try {
      const data = await updateAvailabilitySettings({ unlockCode });
      setSettings(data);
      setUnlockCodeDraft(data.unlockCode || unlockCode);
      useAvailabilityStore.getState().setAvailability(data);
      setStatus((current) => ({
        ...current,
        savingCode: false,
        success: 'Secret admin code updated.',
      }));
    } catch (error) {
      setStatus((current) => ({
        ...current,
        savingCode: false,
        error: getErrorMessage(error, 'Unable to update secret admin code'),
      }));
    }
  }

  function openPreview(mode) {
    if (typeof window === 'undefined') return;
    window.open(previewPath(mode), '_blank', 'noopener,noreferrer');
  }

  const activeMode = settings?.mode || 'live';
  const activeOption = modeOptions.find((option) => option.mode === activeMode) || modeOptions[0];
  const previewMode = activeMode === 'coming-soon' ? 'coming-soon' : 'maintenance';

  return (
    <div className="min-w-0">
      {status.error ? <div className={ui.feedbackError} role="alert">{status.error}</div> : null}
      {status.success ? <div className={ui.feedbackSuccess} role="status">{status.success}</div> : null}

      {status.loading ? (
        <div className={ui.emptyBox}>Loading launch mode settings...</div>
      ) : (
        <div className="grid gap-4">
          <section className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-lg border border-line-soft bg-[linear-gradient(145deg,color-mix(in_srgb,var(--color-primary)_6%,var(--surface-card)),var(--surface-card)_64%,color-mix(in_srgb,var(--color-accent)_5%,var(--surface-card)))] p-4 shadow-[var(--ds-card-shadow)] max-[760px]:grid-cols-1">
            <div className="flex min-w-0 items-center gap-3">
              <XyndromeBrand
                className="min-w-0"
                markSize={44}
                subtitle="launch control"
                style={{
                  '--xyndrome-brand-text': 'var(--ink-strong)',
                  '--xyndrome-brand-muted': 'var(--ink-soft)',
                }}
              />
              <span className="hidden h-10 w-px bg-line-soft sm:block" aria-hidden="true" />
              <div className="min-w-0">
                <span className={cx('inline-flex rounded-full border px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-[0.08em]', activeOption.tone)}>
                  {activeOption.label} now
                </span>
                <p className="m-0 mt-2 text-[13px] font-semibold leading-relaxed text-ink-soft">
                  {activeOption.scope}
                </p>
              </div>
            </div>
            <button className={ui.secondaryAction} type="button" onClick={() => openPreview(previewMode)}>
              Preview active screen
            </button>
          </section>

          <div className="grid grid-cols-[minmax(0,1.25fr)_minmax(280px,0.9fr)] items-start gap-[18px] max-[900px]:grid-cols-1">
            <div className="grid gap-4">
              <div className="grid grid-cols-3 gap-2 rounded-lg border border-line-soft bg-surface-1 p-2 max-[1100px]:grid-cols-2 max-[760px]:grid-cols-1" role="group" aria-label="Launch mode">
                {modeOptions.map((option) => {
                  const selected = activeMode === option.mode;
                  const saving = status.savingMode === option.mode;

                  return (
                    <button
                      key={option.mode}
                      type="button"
                      aria-pressed={selected}
                      disabled={Boolean(status.savingMode)}
                      className={cx(
                        'grid min-h-[138px] min-w-0 cursor-pointer content-start gap-3 rounded-md border p-4 text-left transition-[background,border-color,box-shadow,transform,opacity] duration-150 ease-[var(--ease-out)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/24 active:scale-[0.98] disabled:cursor-wait disabled:opacity-70',
                        selected
                          ? option.selectedClass
                          : 'border-transparent bg-transparent hover:-translate-y-px hover:border-line-soft hover:bg-surface-card'
                      )}
                      onClick={() => changeMode(option.mode)}
                    >
                      <span className="flex min-w-0 items-start justify-between gap-2">
                        <span className={cx('grid size-10 shrink-0 place-items-center rounded-md border', selected ? option.tone : 'border-line-soft bg-surface-2 text-ink-muted')}>
                          <LaunchModeIcon type={option.icon} />
                        </span>
                        <span className={cx('rounded-full border px-2 py-1 text-[10.5px] font-extrabold uppercase tracking-[0.08em]', selected ? option.tone : 'border-line-soft bg-surface-2 text-ink-muted')}>
                          {saving ? 'Saving' : selected ? 'Active' : 'Use'}
                        </span>
                      </span>
                      <span className="grid gap-1">
                        <strong className="text-sm font-extrabold text-ink-strong">{option.label}</strong>
                        <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-ink-muted">{option.shortLabel}</span>
                      </span>
                      <span className="text-[12.5px] font-medium leading-relaxed text-ink-soft">{option.description}</span>
                    </button>
                  );
                })}
              </div>

              <form className="grid gap-3 rounded-lg border border-line-soft bg-surface-glass-subtle p-4" onSubmit={saveUnlockCode}>
                <label className={ui.formLabel}>
                  Secret admin code
                  <input
                    className={ui.input}
                    inputMode="numeric"
                    maxLength={20}
                    minLength={4}
                    pattern="[0-9]{4,20}"
                    type="text"
                    value={unlockCodeDraft}
                    onChange={(event) => setUnlockCodeDraft(event.target.value.replace(/\D/g, '').slice(0, 20))}
                  />
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <button className={ui.primaryAction} type="submit" disabled={status.savingCode}>
                    {status.savingCode ? 'Saving code...' : 'Save secret code'}
                  </button>
                  <span className="text-[12.5px] font-medium leading-relaxed text-ink-soft">
                    Admins type this on the launch screen before signing in with their admin account.
                  </span>
                </div>
              </form>

              <div className={ui.buttonRow}>
                <button className={ui.secondaryAction} type="button" onClick={() => openPreview('maintenance')}>
                  Preview maintenance
                </button>
                <button className={ui.secondaryAction} type="button" onClick={() => openPreview('coming-soon')}>
                  Preview coming soon
                </button>
                <button className={ui.secondaryAction} type="button" onClick={() => window.open(withRouterBasename('/app/dashboard'), '_blank', 'noopener,noreferrer')}>
                  Open student side
                </button>
                <button className={ui.ghostAction} type="button" onClick={loadSettings} disabled={Boolean(status.savingMode)}>
                  Refresh
                </button>
              </div>
            </div>

            <div className="flex min-w-0 flex-col gap-3">
              <div className={cx('flex flex-col gap-1.5 rounded-lg border px-4 py-3.5', activeOption.tone)}>
                <span className="text-xs font-extrabold uppercase tracking-[0.08em] opacity-80">Active mode</span>
                <strong className="[overflow-wrap:anywhere] text-sm leading-normal">{activeOption.label}</strong>
                <span className="text-[12.5px] font-semibold leading-relaxed opacity-90">{activeOption.impact}</span>
              </div>
              <div className="flex flex-col gap-1.5 rounded-lg border border-line-soft bg-surface-glass-subtle px-4 py-3.5">
                <span className="text-xs text-ink-soft">Visitor/student routes</span>
                <strong className="[overflow-wrap:anywhere] text-sm leading-normal text-ink-strong">Redirect to the launch landing screen.</strong>
              </div>
              <div className="flex flex-col gap-1.5 rounded-lg border border-line-soft bg-surface-glass-subtle px-4 py-3.5">
                <span className="text-xs text-ink-soft">Admin routes</span>
                <strong className="[overflow-wrap:anywhere] text-sm leading-normal text-ink-strong">Stay available for mode changes.</strong>
              </div>
              <p className="m-0 mt-0.5 text-[12.5px] leading-relaxed text-ink-soft">
                Live opens the full LMS. Maintenance and Coming Soon send visitors and students to the launch landing screen, while admin routes stay available for changing this setting.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
