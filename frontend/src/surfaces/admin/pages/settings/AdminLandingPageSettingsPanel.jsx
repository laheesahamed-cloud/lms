import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { fetchLandingPageSettings, updateLandingPageSettings } from '../../../../shared/api/settings.api.js';
import { cx, ui } from '../../../../shared/styles/tailwindClasses.js';

const FIELD_GROUPS = [
  {
    title: 'SEO',
    description: 'Used by the browser tab, Google previews, and social previews.',
    fields: [
      { name: 'metaTitle', label: 'Page title', max: 80 },
      { name: 'metaDescription', label: 'Meta description', type: 'textarea', max: 220 },
    ],
  },
  {
    title: 'Hero',
    description: 'The first message students see on the landing page.',
    fields: [
      { name: 'heroKicker', label: 'Small label', max: 90 },
      { name: 'heroTitleLine1', label: 'Title line 1', max: 80 },
      { name: 'heroTitleAccent', label: 'Gradient title word/line', max: 80 },
      { name: 'heroTitleLine3', label: 'Title line 3', max: 80 },
      { name: 'heroSubtitle', label: 'Subtitle', type: 'textarea', max: 260 },
      { name: 'heroPrimaryLabel', label: 'Primary button label', max: 40 },
      { name: 'heroSecondaryLabel', label: 'Secondary button label', max: 40 },
    ],
  },
  {
    title: 'Sections',
    description: 'Headings for the main landing-page blocks.',
    fields: [
      { name: 'featuresEyebrow', label: 'Features eyebrow', max: 60 },
      { name: 'featuresTitle', label: 'Features title', max: 120 },
      { name: 'featuresText', label: 'Features text', type: 'textarea', max: 260 },
      { name: 'howEyebrow', label: 'How it works eyebrow', max: 60 },
      { name: 'howTitle', label: 'How it works title', max: 120 },
      { name: 'howText', label: 'How it works text', type: 'textarea', max: 260 },
      { name: 'whyEyebrow', label: 'Why choose us eyebrow', max: 60 },
      { name: 'whyTitle', label: 'Why choose us title', max: 120 },
      { name: 'whyText', label: 'Why choose us text', type: 'textarea', max: 260 },
      { name: 'testimonialsEyebrow', label: 'Stories eyebrow', max: 60 },
      { name: 'testimonialsTitle', label: 'Stories title', max: 120 },
      { name: 'testimonialsText', label: 'Stories text', type: 'textarea', max: 260 },
      { name: 'faqEyebrow', label: 'FAQ eyebrow', max: 60 },
      { name: 'faqTitle', label: 'FAQ title', max: 120 },
      { name: 'faqText', label: 'FAQ text', type: 'textarea', max: 260 },
      { name: 'pricingEyebrow', label: 'Pricing eyebrow', max: 60 },
      { name: 'pricingTitle', label: 'Pricing title', max: 120 },
      { name: 'pricingText', label: 'Pricing text', type: 'textarea', max: 260 },
    ],
  },
  {
    title: 'CTA and footer',
    description: 'The final conversion block and footer copy.',
    fields: [
      { name: 'customPlanTitle', label: 'Custom plan title', max: 90 },
      { name: 'customPlanText', label: 'Custom plan text', type: 'textarea', max: 220 },
      { name: 'ctaEyebrow', label: 'CTA eyebrow', max: 60 },
      { name: 'ctaTitle', label: 'CTA title', max: 130 },
      { name: 'ctaText', label: 'CTA text', type: 'textarea', max: 280 },
      { name: 'ctaPrimaryLabel', label: 'CTA primary button', max: 40 },
      { name: 'ctaSecondaryLabel', label: 'CTA secondary button', max: 40 },
      { name: 'footerText', label: 'Footer text', type: 'textarea', max: 220 },
      { name: 'footerTagline', label: 'Footer tagline', max: 120 },
    ],
  },
];

function makeForm(content = {}) {
  return FIELD_GROUPS.flatMap((group) => group.fields).reduce((next, field) => {
    next[field.name] = content[field.name] || '';
    return next;
  }, {});
}

function trimToMax(value, max) {
  return String(value || '').slice(0, max);
}

export function AdminLandingPageSettingsPanel() {
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState(() => makeForm());
  const [status, setStatus] = useState({ loading: true, saving: false, error: '', success: '' });

  const changedCount = useMemo(() => {
    const current = settings?.content || {};
    return Object.entries(form).filter(([key, value]) => String(current[key] || '') !== String(value || '')).length;
  }, [form, settings?.content]);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setStatus((current) => ({ ...current, loading: true, error: '', success: '' }));

    try {
      const data = await fetchLandingPageSettings();
      setSettings(data);
      setForm(makeForm(data.content));
      setStatus((current) => ({ ...current, loading: false }));
    } catch (error) {
      setStatus((current) => ({
        ...current,
        loading: false,
        error: getErrorMessage(error, 'Unable to load landing page settings'),
      }));
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus((current) => ({ ...current, saving: true, error: '', success: '' }));

    try {
      const data = await updateLandingPageSettings(form);
      setSettings(data);
      setForm(makeForm(data.content));
      setStatus((current) => ({
        ...current,
        saving: false,
        success: 'Landing page updated successfully.',
      }));
    } catch (error) {
      setStatus((current) => ({
        ...current,
        saving: false,
        error: getErrorMessage(error, 'Unable to update landing page'),
      }));
    }
  }

  function updateField(name, value, max) {
    setForm((current) => ({ ...current, [name]: trimToMax(value, max) }));
  }

  function resetToDefaults() {
    setForm(makeForm(settings?.defaults || settings?.content));
    setStatus((current) => ({ ...current, error: '', success: 'Defaults loaded. Save to publish them.' }));
  }

  return (
    <div className="min-w-0">
      {status.error ? <div className={ui.feedbackError}>{status.error}</div> : null}
      {status.success ? <div className={ui.feedbackSuccess}>{status.success}</div> : null}

      {status.loading ? (
        <div className={ui.emptyBox}>Loading landing page settings...</div>
      ) : (
        <div className="grid grid-cols-[minmax(0,1.35fr)_minmax(300px,0.82fr)] items-start gap-[18px] max-[980px]:grid-cols-1">
          <form className="grid min-w-0 gap-4" onSubmit={handleSubmit}>
            {FIELD_GROUPS.map((group) => (
              <section key={group.title} className="rounded-lg border border-line-soft bg-surface-1 p-4 shadow-sm">
                <div className="mb-4">
                  <h3 className="m-0 text-[15px] font-black text-ink-strong">{group.title}</h3>
                  <p className="m-0 mt-1 text-[12.5px] leading-relaxed text-ink-soft">{group.description}</p>
                </div>
                <div className={cx(ui.formGrid, 'items-start')}>
                  {group.fields.map((field) => {
                    const value = form[field.name] || '';
                    const FieldTag = field.type === 'textarea' ? 'textarea' : 'input';
                    return (
                      <label key={field.name} className={cx(ui.formLabel, field.type === 'textarea' && 'sm:col-span-2')}>
                        {field.label}
                        <FieldTag
                          className={field.type === 'textarea' ? cx(ui.textarea, 'min-h-[82px]') : ui.input}
                          value={value}
                          maxLength={field.max}
                          onChange={(event) => updateField(field.name, event.target.value, field.max)}
                        />
                        <span className="text-[11.5px] font-medium text-ink-soft">
                          {value.length}/{field.max} characters
                        </span>
                      </label>
                    );
                  })}
                </div>
              </section>
            ))}

            <div className={ui.buttonRow}>
              <button className={ui.primaryAction} type="submit" disabled={status.saving}>
                {status.saving ? 'Saving...' : 'Save landing page'}
              </button>
              <button type="button" className={ui.secondaryAction} onClick={loadSettings} disabled={status.saving}>
                Refresh
              </button>
              <button type="button" className={ui.ghostAction} onClick={resetToDefaults} disabled={status.saving}>
                Load defaults
              </button>
            </div>
          </form>

          <aside className="sticky top-[calc(var(--topbar-height,72px)+16px)] grid min-w-0 gap-3 max-[980px]:static">
            <div className="rounded-lg border border-line-soft bg-surface-glass-subtle p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <span className={ui.eyebrow}>Live Preview</span>
                  <h3 className="m-0 mt-1 text-[17px] font-black text-ink-strong">Landing hero</h3>
                </div>
                <span className="rounded-full border border-brand-primary/16 bg-[var(--color-primary-light)] px-2.5 py-1 text-[11px] font-extrabold text-brand-primary">
                  {changedCount} changed
                </span>
              </div>
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0F1720] p-5 text-white shadow-sm">
                <div className="mb-3 inline-flex rounded-full border border-blue-300/20 bg-blue-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-blue-300">
                  {form.heroKicker}
                </div>
                <h4 className="m-0 text-[28px] font-black leading-[1.08] tracking-normal">
                  {form.heroTitleLine1}<br />
                  <span className="bg-[linear-gradient(90deg,#60A5FA,#A78BFA,#F472B6)] bg-clip-text text-transparent">
                    {form.heroTitleAccent}
                  </span><br />
                  {form.heroTitleLine3}
                </h4>
                <p className="mb-4 mt-3 text-[13px] leading-relaxed text-white/62">{form.heroSubtitle}</p>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-amber-200/30 bg-amber-400/14 px-3 py-2 text-[12px] font-black text-amber-100">
                    {form.heroPrimaryLabel}
                  </span>
                  <span className="rounded-full border border-white/[0.16] bg-white/[0.08] px-3 py-2 text-[12px] font-black text-white/80">
                    {form.heroSecondaryLabel}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-line-soft bg-surface-glass-subtle p-4">
              <span className={ui.eyebrow}>Section Preview</span>
              <h3 className="m-0 mt-1 text-[16px] font-black text-ink-strong">{form.featuresTitle}</h3>
              <p className="m-0 mt-2 text-[12.5px] leading-relaxed text-ink-soft">{form.featuresText}</p>
            </div>

            <div className="grid gap-2 rounded-lg border border-line-soft bg-surface-glass-subtle p-4 text-[12.5px] leading-relaxed text-ink-soft">
              <strong className="text-sm text-ink-strong">Publishing behavior</strong>
              <span>Saved edits appear on the public landing page through the public settings API.</span>
              <Link to="/" className={cx(ui.secondaryAction, 'mt-1 min-h-10')} target="_blank" rel="noreferrer">
                Open landing page
              </Link>
              <span>{settings?.note}</span>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
