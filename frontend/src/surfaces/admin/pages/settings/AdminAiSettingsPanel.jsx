import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { getErrorMessage } from '../../../../shared/api/client.js';
import {
  activateAiProviderConfig,
  createAiProviderConfig,
  deleteAiProviderConfig,
  fetchAiProviderSettings,
  testAiProviderConfig,
  updateAiProviderConfig,
} from '../../../../shared/api/settings.api.js';
import { DeleteActionIcon, EditActionIcon } from '../../../../shared/ui/ActionIcons.jsx';
import { cx, ui } from '../../../../shared/styles/tailwindClasses.js';

const EMPTY_FORM = {
  providerKey: 'openrouter',
  apiKey: '',
  runCode: '',
  model: '',
  isActive: false,
};

/* ---- Static feature registry ---- */
const AI_FEATURES = [
  {
    id: 'quiz-gen',
    icon: '🧠',
    name: 'Quiz Generation',
    description: 'Generates SBA and True/False questions from lesson text or a topic prompt.',
    usedIn: 'Admin → Quiz Builder → "Generate with AI"',
    endpoint: 'POST /api/ai/generate-quiz',
    provider: 'active',
    note: null,
  },
  {
    id: 'lesson-beautify',
    icon: '✨',
    name: 'Lesson Beautification',
    description: 'Rewrites and structures raw lesson content into clean, formatted HTML.',
    usedIn: 'Admin → Lesson Editor → "Beautify with AI"',
    endpoint: 'POST /api/ai/beautify-lesson',
    provider: 'active',
    note: null,
  },
  {
    id: 'theory-recap',
    icon: '⚡',
    name: 'Theory Recap Generation',
    description: 'Generates a structured medical theory card (etiology, pathophysiology, treatment, key points, mnemonic) for each question.',
    usedIn: 'Admin → Questions → Edit question → Theory Recap → "Generate with AI"',
    endpoint: 'POST /api/theory-recap/question/:id/generate',
    provider: 'active',
    note: null,
  },
  {
    id: 'ai-notes',
    icon: '📚',
    name: 'Lessons',
    description: 'Generates visual, illustrated lessons with diagrams from lesson text. Available to students as a premium feature.',
    usedIn: 'Student → Lessons',
    endpoint: 'POST /api/ai-notes/generate',
    provider: 'lesson',
    note: 'Lessons use your saved AI providers. The active provider is preferred; if it has no key, Lessons use another saved provider with a key.',
  },
];

const PROVIDER_ICONS = {
  openrouter: '🔀',
  openai: '⬡',
  gemini: '◈',
  claude: '◆',
};

const PROVIDER_COLORS = {
  openrouter: 'purple',
  openai: 'green',
  gemini: 'blue',
  claude: 'orange',
};

const providerBadgeColors = {
  purple: 'border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300',
  green: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  blue: 'border-blue-500/25 bg-blue-500/10 text-blue-600 dark:text-blue-300',
  orange: 'border-orange-500/25 bg-orange-500/10 text-orange-600 dark:text-orange-300',
  default: 'border-line-soft bg-surface-glass-subtle text-ink-soft',
};

const aiSectionHeadClass = 'flex items-start justify-between gap-4 max-[700px]:flex-col';
const aiSectionTitleClass = 'm-0 mb-1 text-base font-bold text-ink-strong';
const aiSectionTextClass = 'm-0 text-[13px] text-ink-soft';
const aiMetaRowClass = 'flex items-start gap-2 text-[12.5px]';
const aiMetaLabelClass = 'w-[72px] shrink-0 pt-px font-medium text-ink-muted';
const aiMetaValueClass = 'font-medium leading-normal text-ink-strong';

function ProviderBadge({ providerKey, label, size = 'sm' }) {
  const color = PROVIDER_COLORS[providerKey] || 'default';
  const icon = PROVIDER_ICONS[providerKey] || '◉';
  return (
    <span className={cx(
      'inline-flex items-center gap-1 rounded-full border font-bold',
      size === 'md' ? 'px-3 py-1 text-[13px]' : 'px-[9px] py-0.5 pl-[7px] text-[11.5px]',
      providerBadgeColors[color] || providerBadgeColors.default
    )}>
      <span aria-hidden="true">{icon}</span>
      {label || providerKey}
    </span>
  );
}

function FeatureCard({ feature, activeProvider, hasGemini }) {
  const usesActive = feature.provider === 'active';
  const usesGemini = feature.provider === 'gemini';
  const usesLessonProvider = feature.provider === 'lesson';
  const configured = usesActive ? Boolean(activeProvider?.hasApiKey) : usesGemini || usesLessonProvider ? hasGemini : false;

  return (
    <div className={cx(
      'flex flex-col gap-3 rounded-xl border border-line-soft bg-surface-glass-subtle p-[18px] transition',
      !configured && 'border-brand-error/30'
    )}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0 text-[22px] leading-none" aria-hidden="true">{feature.icon}</span>
        <div className="flex-1">
          <h4 className="m-0 mb-1 text-sm font-bold text-ink-strong">{feature.name}</h4>
          <span className={cx('text-[11px] font-semibold', configured ? 'text-brand-success' : 'text-brand-error')}>
            {configured ? '● Ready' : '● Not configured'}
          </span>
        </div>
      </div>

      <p className="m-0 text-[13px] leading-relaxed text-ink-soft">{feature.description}</p>

      <div className="flex flex-col gap-2 rounded-lg border border-line-soft bg-surface-1 p-3">
        <div className={aiMetaRowClass}>
          <span className={aiMetaLabelClass}>Used in</span>
          <span className={aiMetaValueClass}>{feature.usedIn}</span>
        </div>
        <div className={aiMetaRowClass}>
          <span className={aiMetaLabelClass}>Endpoint</span>
          <code className="rounded-md border border-line-soft bg-surface-glass-subtle px-1.5 py-px font-mono text-[11px] text-ink-soft">{feature.endpoint}</code>
        </div>
        <div className={aiMetaRowClass}>
          <span className={aiMetaLabelClass}>Powered by</span>
          {usesActive ? (
            activeProvider ? (
              <ProviderBadge providerKey={activeProvider.providerKey} label={activeProvider.providerLabel} />
            ) : (
              <span className="text-xs font-semibold text-brand-error">No active provider — set one below</span>
            )
          ) : usesLessonProvider ? (
            activeProvider?.hasApiKey ? (
              <ProviderBadge providerKey={activeProvider.providerKey} label={activeProvider.providerLabel} />
            ) : (
              <span className="text-xs font-semibold text-ink-soft">Any saved provider with an API key</span>
            )
          ) : (
            <ProviderBadge providerKey="gemini" label="Gemini (fixed)" />
          )}
        </div>
        {usesActive && activeProvider ? (
          <div className={aiMetaRowClass}>
            <span className={aiMetaLabelClass}>Model</span>
            <span className={cx(aiMetaValueClass, 'font-mono text-[11.5px]')}>{activeProvider.model || 'auto default'}</span>
          </div>
        ) : null}
      </div>

      {feature.note ? (
        <div className="flex items-start gap-[7px] rounded-md border border-amber-500/25 bg-[color-mix(in_srgb,#f59e0b_7%,var(--surface-1))] px-2.5 py-2 text-xs leading-relaxed text-ink-soft">
          <span aria-hidden="true">ⓘ</span>
          {feature.note}
        </div>
      ) : null}
    </div>
  );
}

function ProviderCard({ provider, onEdit, onActivate, onDelete, activatingId, deletingId }) {
  const busy = activatingId === provider.id || deletingId === provider.id;

  return (
    <article className={cx(
      'flex flex-col gap-3.5 rounded-xl border border-line-soft bg-surface-glass-subtle p-[18px] transition',
      provider.isActive && 'border-brand-primary/35 shadow-[0_0_0_1px_color-mix(in_srgb,var(--color-primary)_12%,transparent)]'
    )}>
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <span className="text-xl leading-none" aria-hidden="true">{PROVIDER_ICONS[provider.providerKey] || '◉'}</span>
          <div>
            <h3 className="m-0 mb-[3px] text-[14.5px] font-bold text-ink-strong">{provider.providerLabel}</h3>
            <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-ink-muted">{provider.providerKey}</span>
          </div>
        </div>
        {provider.isActive ? (
          <span className="shrink-0 rounded-full border border-brand-primary/25 bg-brand-primary/10 px-[9px] py-[3px] text-[11px] font-bold text-brand-primary">Active</span>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2.5 rounded-md border border-line-soft bg-surface-1 px-2.5 py-[7px] text-[12.5px]">
          <span className="text-ink-muted">Model</span>
          <strong className="[overflow-wrap:anywhere] text-[12.5px] text-ink-strong">{provider.model || 'auto default'}</strong>
        </div>
        <div className="flex items-baseline justify-between gap-2.5 rounded-md border border-line-soft bg-surface-1 px-2.5 py-[7px] text-[12.5px]">
          <span className="text-ink-muted">API key</span>
          <strong className={cx('[overflow-wrap:anywhere] text-[12.5px]', provider.hasApiKey ? 'text-brand-success' : 'text-ink-muted')}>
            {provider.hasApiKey ? provider.maskedApiKey : 'Not saved'}
          </strong>
        </div>
        {provider.hasRunCode ? (
          <div className="flex items-baseline justify-between gap-2.5 rounded-md border border-line-soft bg-surface-1 px-2.5 py-[7px] text-[12.5px]">
            <span className="text-ink-muted">Run code</span>
            <strong className="[overflow-wrap:anywhere] text-[12.5px] text-brand-success">{provider.maskedRunCode}</strong>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button className={ui.primaryAction}
          type="button"
          onClick={() => onActivate(provider.id)}
          disabled={provider.isActive || busy}
          className={provider.isActive ? ui.secondaryAction : ''}
        >
          {activatingId === provider.id ? 'Activating…' : provider.isActive ? 'In use' : 'Use now'}
        </button>
        <button type="button" className={ui.iconButton} title="Edit" onClick={() => onEdit(provider)} disabled={busy}>
          <EditActionIcon />
        </button>
        <button className={ui.dangerIconButton}
          type="button"
         
          title="Delete"
          onClick={() => onDelete(provider.id)}
          disabled={busy}
        >
          <DeleteActionIcon />
        </button>
      </div>
    </article>
  );
}

function ProviderFormModal({ open, editingId, form, providerChoices, selectedProviderMeta, status, onFormChange, onSubmit, onTestKey, onClose }) {
  if (!open) return null;

  return createPortal(
    <div className={ui.modalBackdrop} onClick={onClose}>
      <div className={cx(ui.entityModal, 'max-w-[560px]')} onClick={(e) => e.stopPropagation()}>
        <div className={ui.entityModalTop}>
          <div>
            <h2 className={ui.entityModalTitle}>{editingId ? 'Edit provider' : 'Add provider'}</h2>
            <p className={ui.entityModalText}>Configure the provider, model, and API credentials. Use "Test key" to verify and auto-load available models.</p>
          </div>
          <button type="button" className={ui.subtleIconButton} onClick={onClose} aria-label="Close">x</button>
        </div>

        <form className={cx(ui.stackForm, ui.modalForm, 'px-6 pb-6 pt-[22px] max-[640px]:px-4')} onSubmit={onSubmit}>
          <div className={ui.formGrid}>
            <label className={ui.formLabel}>
              Provider
              <select className={ui.input}
                value={form.providerKey}
                onChange={(e) => onFormChange('providerKey', e.target.value)}
              >
                {providerChoices.map((p) => (
                  <option key={p.providerKey} value={p.providerKey}>{p.label}</option>
                ))}
              </select>
            </label>

            <label className={ui.formLabel}>
              Model
              <select className={ui.input}
                value={form.model}
                onChange={(e) => onFormChange('model', e.target.value)}
              >
                {(selectedProviderMeta?.modeOptions || []).map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </label>
          </div>

          <label className={ui.formLabel}>
            API key
            <input className={ui.input}
              value={form.apiKey}
              onChange={(e) => onFormChange('apiKey', e.target.value)}
              placeholder={editingId ? 'Leave blank to keep the existing key' : 'Paste your provider API key'}
              autoComplete="off"
            />
          </label>

          <label className={ui.formLabel}>
            Run code <span className="ml-1 text-[11px] font-normal text-ink-muted">(OpenRouter / custom proxy only)</span>
            <textarea className={ui.textarea}
              value={form.runCode}
              onChange={(e) => onFormChange('runCode', e.target.value)}
              placeholder={editingId ? 'Leave blank to keep the existing run code' : 'Paste the run / React code here (optional)'}
              rows={5}
            />
          </label>

          <label className="flex items-center gap-2.5 rounded-lg border border-line-soft bg-surface-1 px-3.5 py-3">
            <input className="size-[18px]"
             
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => onFormChange('isActive', e.target.checked)}
            />
            <span className="text-[13px] font-semibold text-ink-strong">Make this the active provider immediately after saving</span>
          </label>

          <div className={ui.buttonRow}>
            <button className={ui.primaryAction} type="submit" disabled={status.saving}>
              {status.saving ? 'Saving…' : editingId ? 'Save changes' : 'Add provider'}
            </button>
            <button className={ui.secondaryAction}
              type="button"
             
              onClick={onTestKey}
              disabled={status.testing || !form.apiKey.trim()}
            >
              {status.testing ? 'Testing…' : 'Test key'}
            </button>
            <button type="button" className={ui.secondaryAction} onClick={onClose} disabled={status.saving}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

export function AdminAiSettingsPanel() {
  const [settings, setSettings] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [providerModeOptions, setProviderModeOptions] = useState({});
  const [form, setForm] = useState(EMPTY_FORM);
  const [status, setStatus] = useState({
    loading: true,
    saving: false,
    testing: false,
    deletingId: null,
    activatingId: null,
    error: '',
    success: '',
  });

  useEffect(() => { loadSettings(); }, []);

  useEffect(() => {
    if (!status.error && !status.success) return undefined;
    const timer = window.setTimeout(() => {
      setStatus((s) => ({ ...s, error: '', success: '' }));
    }, 2800);
    return () => window.clearTimeout(timer);
  }, [status.error, status.success]);

  const providerChoices = useMemo(
    () => (settings?.availableProviders || []).map((p) => ({
      ...p,
      modeOptions: providerModeOptions[p.providerKey] || p.modeOptions || [],
    })),
    [settings?.availableProviders, providerModeOptions]
  );

  const activeProvider = settings?.activeProvider || null;

  const hasLessonProvider = useMemo(
    () => Boolean(settings?.lessonProviderConfigured),
    [settings?.lessonProviderConfigured]
  );
  const selectedProviderMeta = useMemo(
    () => providerChoices.find((p) => p.providerKey === form.providerKey) || null,
    [providerChoices, form.providerKey]
  );

  async function loadSettings() {
    setStatus((s) => ({ ...s, loading: true, error: '', success: '' }));
    try {
      const data = await fetchAiProviderSettings();
      setSettings(data);
      setProviderModeOptions(
        Object.fromEntries((data?.availableProviders || []).map((p) => [p.providerKey, p.modeOptions || []]))
      );
      setForm((c) => ({
        ...c,
        providerKey: c.providerKey || data?.availableProviders?.[0]?.providerKey || 'openrouter',
        model: c.model || data?.availableProviders?.[0]?.defaultModel || '',
      }));
      setStatus((s) => ({ ...s, loading: false }));
    } catch (error) {
      setStatus((s) => ({ ...s, loading: false, error: getErrorMessage(error, 'Unable to load AI provider settings') }));
    }
  }

  function resetForm(nextKey = 'openrouter') {
    const meta = providerChoices.find((p) => p.providerKey === nextKey) || providerChoices[0];
    setEditingId(null);
    setModalOpen(false);
    setForm({ ...EMPTY_FORM, providerKey: meta?.providerKey || 'openrouter', model: meta?.defaultModel || '' });
  }

  function openCreateModal() {
    const meta = providerChoices.find((p) => p.providerKey === 'openrouter') || providerChoices[0];
    setEditingId(null);
    setForm({ ...EMPTY_FORM, providerKey: meta?.providerKey || 'openrouter', model: meta?.defaultModel || '' });
    setModalOpen(true);
    setStatus((s) => ({ ...s, error: '', success: '' }));
  }

  function startEditing(provider) {
    setEditingId(provider.id);
    setForm({ providerKey: provider.providerKey, apiKey: '', runCode: '', model: provider.model || '', isActive: Boolean(provider.isActive) });
    setModalOpen(true);
    setStatus((s) => ({ ...s, error: '', success: '' }));
  }

  function handleFormChange(field, value) {
    if (field === 'providerKey') {
      const meta = providerChoices.find((p) => p.providerKey === value);
      setForm((c) => ({ ...c, providerKey: value, model: meta?.defaultModel || '' }));
    } else {
      setForm((c) => ({ ...c, [field]: value }));
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus((s) => ({ ...s, saving: true, error: '', success: '' }));
    const payload = { providerKey: form.providerKey, apiKey: form.apiKey, runCode: form.runCode, model: form.model, isActive: form.isActive };
    try {
      const data = editingId ? await updateAiProviderConfig(editingId, payload) : await createAiProviderConfig(payload);
      setSettings(data);
      resetForm(payload.providerKey);
      setStatus((s) => ({ ...s, saving: false, success: editingId ? 'Provider updated.' : 'Provider added.' }));
    } catch (error) {
      setStatus((s) => ({ ...s, saving: false, error: getErrorMessage(error, 'Unable to save AI provider') }));
    }
  }

  async function handleTestKey() {
    setStatus((s) => ({ ...s, testing: true, error: '', success: '' }));
    try {
      const result = await testAiProviderConfig({ providerKey: form.providerKey, apiKey: form.apiKey });
      const opts = Array.isArray(result?.modeOptions) ? result.modeOptions.filter(Boolean) : [];
      if (opts.length > 0) {
        setProviderModeOptions((c) => ({ ...c, [form.providerKey]: opts }));
        setForm((c) => ({ ...c, model: opts.includes(c.model) ? c.model : opts[0] }));
      }
      setStatus((s) => ({ ...s, testing: false, success: `${result.message || 'Key accepted.'}${opts.length > 0 ? ` Loaded ${opts.length} model(s).` : ''}` }));
    } catch (error) {
      setStatus((s) => ({ ...s, testing: false, error: getErrorMessage(error, 'Unable to test the API key') }));
    }
  }

  async function handleActivate(providerId) {
    setStatus((s) => ({ ...s, activatingId: providerId, error: '', success: '' }));
    try {
      const data = await activateAiProviderConfig(providerId);
      setSettings(data);
      setStatus((s) => ({ ...s, activatingId: null, success: 'Active provider changed.' }));
    } catch (error) {
      setStatus((s) => ({ ...s, activatingId: null, error: getErrorMessage(error, 'Unable to activate provider') }));
    }
  }

  async function handleDelete(providerId) {
    if (!window.confirm('Delete this provider configuration?')) return;
    setStatus((s) => ({ ...s, deletingId: providerId, error: '', success: '' }));
    try {
      const data = await deleteAiProviderConfig(providerId);
      setSettings(data);
      if (editingId === providerId) resetForm();
      setStatus((s) => ({ ...s, deletingId: null, success: 'Provider deleted.' }));
    } catch (error) {
      setStatus((s) => ({ ...s, deletingId: null, error: getErrorMessage(error, 'Unable to delete provider') }));
    }
  }

  return (
    <div className="min-w-0">
      {(status.error || status.success) && typeof document !== 'undefined'
        ? createPortal(
            <div className={cx(ui.toastContainer, ui.toastContainerCenter)} role="status" aria-live="polite">
              <div className={cx(ui.toast, status.error ? ui.toastError : ui.toastSuccess)}>
                <span className={ui.toastIcon} aria-hidden="true">{status.error ? '⚠' : '✓'}</span>
                <span>{status.error || status.success}</span>
              </div>
            </div>,
            document.body
          )
        : null}

      {status.loading ? (
        <div className={ui.emptyBox}>Loading AI settings…</div>
      ) : (
        <div className="flex flex-col gap-7">

          {/* ── Status banner ── */}
          <div className={cx(
            'flex items-center justify-between gap-4 rounded-xl border border-brand-primary/25 bg-[color-mix(in_srgb,var(--color-primary)_5%,var(--surface-1))] px-5 py-4 max-[700px]:items-start max-[700px]:flex-col',
            !activeProvider && 'border-brand-error/30 bg-[color-mix(in_srgb,var(--color-error)_4%,var(--surface-1))]'
          )}>
            <div className="flex items-center gap-3">
              <div className={cx(
                'size-2.5 shrink-0 rounded-full bg-brand-primary shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-primary)_20%,transparent)]',
                !activeProvider && 'bg-brand-error shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-error)_20%,transparent)]'
              )} aria-hidden="true" />
              <div>
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">Active provider</div>
                {activeProvider ? (
                  <div className="flex flex-wrap items-center gap-2.5">
                    <ProviderBadge providerKey={activeProvider.providerKey} label={activeProvider.providerLabel} size="md" />
                    <span className="rounded-md border border-line-soft bg-surface-glass-subtle px-2 py-0.5 text-xs font-medium text-ink-soft">{activeProvider.model || 'auto default'}</span>
                  </div>
                ) : (
                  <div className="text-[13px] font-semibold text-brand-error">
                    None selected — quiz generation, lesson AI, and theory recaps will fail
                  </div>
                )}
              </div>
            </div>
            <div className="shrink-0">
              <div className="flex max-w-[340px] items-center gap-1.5 text-xs leading-normal text-ink-muted">
                <span aria-hidden="true">🔒</span>
                <span>{settings?.encryptionStatus}</span>
              </div>
            </div>
          </div>

          {/* ── AI features in this LMS ── */}
          <section className="flex flex-col gap-4">
            <div className={aiSectionHeadClass}>
              <div>
                <h2 className={aiSectionTitleClass}>AI features in this LMS</h2>
                <p className={aiSectionTextClass}>Every AI-powered action, where it's triggered, which API powers it, and whether it's ready.</p>
              </div>
            </div>

            <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-3.5 max-[700px]:grid-cols-1">
              {AI_FEATURES.map((feature) => (
                <FeatureCard
                  key={feature.id}
                  feature={feature}
                  activeProvider={activeProvider}
                  hasGemini={hasLessonProvider}
                />
              ))}
            </div>
          </section>

          {/* ── Saved providers ── */}
          <section className="flex flex-col gap-4">
            <div className={aiSectionHeadClass}>
              <div>
                <h2 className={aiSectionTitleClass}>Saved providers</h2>
                <p className={aiSectionTextClass}>
                  {(settings?.providers || []).length === 0
                    ? 'No providers configured yet. Add one to enable AI features.'
                    : `${(settings.providers || []).length} provider(s) saved. The active one powers all shared AI features.`}
                </p>
              </div>
              <div className={ui.buttonRow}>
                <button className={ui.primaryAction} type="button" onClick={openCreateModal}>Add provider</button>
                <button type="button" className={ui.secondaryAction} onClick={loadSettings}>Refresh</button>
              </div>
            </div>

            {(settings?.providers || []).length > 0 ? (
              <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3.5 max-[700px]:grid-cols-1">
                {settings.providers.map((provider) => (
                  <ProviderCard
                    key={provider.id}
                    provider={provider}
                    onEdit={startEditing}
                    onActivate={handleActivate}
                    onDelete={handleDelete}
                    activatingId={status.activatingId}
                    deletingId={status.deletingId}
                  />
                ))}
              </div>
            ) : (
              <div className={ui.emptyBox}>No providers saved yet.</div>
            )}
          </section>

          {/* ── How it works note ── */}
          <section className="flex flex-col gap-4">
            <div className="rounded-xl border border-line-soft bg-surface-glass-subtle px-6 py-5">
              <h3 className="m-0 mb-4 text-sm font-bold text-ink-strong">How it works</h3>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4 max-[700px]:grid-cols-1">
                <div className="flex items-start gap-3">
                  <span className="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-brand-primary/10 text-xs font-extrabold text-brand-primary">1</span>
                  <div>
                    <strong className="mb-1 block text-[13px] font-bold text-ink-strong">Add a provider</strong>
                    <p className="m-0 text-xs leading-relaxed text-ink-soft">Click "Add provider", choose the provider (OpenRouter, OpenAI, Gemini, or Claude), paste the API key, and pick a model.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-brand-primary/10 text-xs font-extrabold text-brand-primary">2</span>
                  <div>
                    <strong className="mb-1 block text-[13px] font-bold text-ink-strong">Test the key</strong>
                    <p className="m-0 text-xs leading-relaxed text-ink-soft">Use "Test key" in the form to verify the credentials live — it will also auto-load the available models for that provider.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-brand-primary/10 text-xs font-extrabold text-brand-primary">3</span>
                  <div>
                    <strong className="mb-1 block text-[13px] font-bold text-ink-strong">Activate it</strong>
                    <p className="m-0 text-xs leading-relaxed text-ink-soft">Click "Use now" on any saved provider to make it the active one. Quiz generation, lesson beautify, and theory recaps instantly switch to it.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-brand-primary/10 text-xs font-extrabold text-brand-primary">4</span>
                  <div>
                    <strong className="mb-1 block text-[13px] font-bold text-ink-strong">Lessons use saved providers</strong>
                    <p className="m-0 text-xs leading-relaxed text-ink-soft">The Lessons generator prefers the active provider, then falls back to another saved provider with an API key. No separate fixed lesson key is needed.</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      <ProviderFormModal
        open={modalOpen}
        editingId={editingId}
        form={form}
        providerChoices={providerChoices}
        selectedProviderMeta={selectedProviderMeta}
        status={status}
        onFormChange={handleFormChange}
        onSubmit={handleSubmit}
        onTestKey={handleTestKey}
        onClose={() => resetForm()}
      />
    </div>
  );
}
