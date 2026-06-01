import { useEffect, useMemo, useRef, useState } from 'react';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { fetchPopupAlertSettings, updatePopupAlertSettings } from '../../../../shared/api/settings.api.js';
import { cx, ui } from '../../../../shared/styles/tailwindClasses.js';
import { resolvePublicAssetUrl } from '../../../../shared/utils/publicAssetUrl.js';

const MAX_IMAGE_BYTES = 2_000_000;
const RECOMMENDED_IMAGE = 'Recommended: 1200 x 675 px, JPG/PNG/WEBP, max 2 MB.';

const defaultForm = {
  enabled: false,
  placement: 'landing',
  title: '',
  body: '',
  buttonLabel: '',
  buttonUrl: '',
  imageUrl: '',
  imageAlt: '',
  imageDataUrl: '',
  imageFileName: '',
  imageWidth: 0,
  imageHeight: 0,
  imageBytes: 0,
};

function toForm(data) {
  return {
    ...defaultForm,
    enabled: Boolean(data?.enabled),
    placement: ['landing', 'login', 'app', 'all'].includes(data?.placement) ? data.placement : 'landing',
    title: data?.title || '',
    body: data?.body || '',
    buttonLabel: data?.buttonLabel || '',
    buttonUrl: data?.buttonUrl || '',
    imageUrl: data?.imageUrl || '',
    imageAlt: data?.imageAlt || '',
    imageFileName: data?.imageFileName || '',
    imageWidth: Number(data?.imageWidth || 0),
    imageHeight: Number(data?.imageHeight || 0),
    imageBytes: Number(data?.imageBytes || 0),
  };
}

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (!value) return 'No image uploaded';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)} MB`;
  return `${Math.max(1, Math.round(value / 1000))} KB`;
}

function validatePopupImageFile(file) {
  if (!file) return '';
  const name = String(file.name || 'popup-image').trim();
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(String(file.type || '').toLowerCase())) {
    return 'Upload a JPG, PNG, or WEBP image.';
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return 'Popup image must be 2 MB or smaller.';
  }
  if (!name || name.length > 180 || /[\\/<>:"|?*\x00-\x1F]/.test(name)) {
    return 'Rename the image without special path characters, then upload again.';
  }
  return '';
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Unable to read image'));
    reader.readAsDataURL(file);
  });
}

function readImageMeta(dataUrl) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth || 0, height: image.naturalHeight || 0 });
    image.onerror = () => resolve({ width: 0, height: 0 });
    image.src = dataUrl;
  });
}

export function AdminPopupAlertSettingsPanel() {
  const fileInputRef = useRef(null);
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [status, setStatus] = useState({ loading: true, saving: false, error: '', success: '' });

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setStatus((current) => ({ ...current, loading: true, error: '', success: '' }));
    try {
      const data = await fetchPopupAlertSettings();
      setSettings(data);
      setForm(toForm(data));
      setStatus((current) => ({ ...current, loading: false }));
    } catch (error) {
      setStatus((current) => ({ ...current, loading: false, error: getErrorMessage(error, 'Unable to load popup alert settings') }));
    }
  }

  function patchForm(patch) {
    setForm((current) => ({ ...current, ...patch }));
  }

  async function handleImageChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setStatus((current) => ({ ...current, error: '', success: '' }));
    const validationError = validatePopupImageFile(file);
    if (validationError) {
      setStatus((current) => ({ ...current, error: validationError }));
      event.target.value = '';
      return;
    }

    try {
      const imageDataUrl = await readFileAsDataUrl(file);
      const imageMeta = await readImageMeta(imageDataUrl);
      patchForm({
        imageDataUrl,
        imageUrl: '',
        imageFileName: file.name,
        imageWidth: imageMeta.width,
        imageHeight: imageMeta.height,
        imageBytes: file.size,
        imageAlt: form.imageAlt || form.title || 'Popup alert image',
      });
    } catch (error) {
      setStatus((current) => ({ ...current, error: getErrorMessage(error, 'Unable to prepare image') }));
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus((current) => ({ ...current, saving: true, error: '', success: '' }));

    try {
      const payload = { ...form };
      if (!payload.imageDataUrl) {
        delete payload.imageDataUrl;
      }
      const data = await updatePopupAlertSettings(payload);
      setSettings(data);
      setForm(toForm(data));
      if (fileInputRef.current) fileInputRef.current.value = '';
      setStatus((current) => ({ ...current, saving: false, success: 'Popup alert settings saved successfully.' }));
    } catch (error) {
      setStatus((current) => ({ ...current, saving: false, error: getErrorMessage(error, 'Unable to save popup alert settings') }));
    }
  }

  const previewImageUrl = useMemo(
    () => form.imageDataUrl || resolvePublicAssetUrl(form.imageUrl),
    [form.imageDataUrl, form.imageUrl]
  );
  const hasContent = Boolean(form.title || form.body || previewImageUrl);

  return (
    <div className="min-w-0">
      {status.error ? <div className={ui.feedbackError}>{status.error}</div> : null}
      {status.success ? <div className={ui.feedbackSuccess}>{status.success}</div> : null}

      {status.loading ? (
        <div className={ui.emptyBox}>Loading popup alert settings...</div>
      ) : (
        <div className="grid grid-cols-[minmax(0,1.18fr)_minmax(300px,0.92fr)] items-start gap-[18px] max-[980px]:grid-cols-1">
          <form className={ui.stackForm} onSubmit={handleSubmit}>
            <div className="grid gap-3 rounded-lg border border-line-soft bg-surface-glass-subtle p-4">
              <label className={ui.checkboxRow}>
                <input type="checkbox" checked={form.enabled} onChange={(event) => patchForm({ enabled: event.target.checked })} />
                Show popup alert
              </label>
              <p className="m-0 text-[12.5px] leading-relaxed text-ink-soft">
                Keep it off while preparing the message. It will only appear when text or an image is saved.
              </p>
            </div>

            <div className={ui.formGrid}>
              <label className={ui.formLabel}>
                Show on
                <select className={ui.input} value={form.placement} onChange={(event) => patchForm({ placement: event.target.value })}>
                  <option value="landing">Landing page only</option>
                  <option value="login">Login page only</option>
                  <option value="app">Inside the app only</option>
                  <option value="all">Everywhere</option>
                </select>
              </label>
              <label className={ui.formLabel}>
                Button label
                <input className={ui.input} value={form.buttonLabel} onChange={(event) => patchForm({ buttonLabel: event.target.value })} placeholder="Learn more" maxLength={80} />
              </label>
            </div>

            <label className={ui.formLabel}>
              Popup title
              <input className={ui.input} value={form.title} onChange={(event) => patchForm({ title: event.target.value })} placeholder="New batch starts this week" maxLength={120} />
            </label>
            <label className={ui.formLabel}>
              Popup text
              <textarea className={ui.textarea} value={form.body} onChange={(event) => patchForm({ body: event.target.value })} placeholder="Add the announcement students should see." maxLength={900} />
            </label>

            <div className="grid gap-3 rounded-lg border border-line-soft bg-surface-glass-subtle p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <strong className="text-sm text-ink-strong">Popup image</strong>
                  <p className="m-0 mt-1 text-[12.5px] leading-relaxed text-ink-soft">{RECOMMENDED_IMAGE}</p>
                </div>
                <button className={ui.secondaryAction} type="button" onClick={() => fileInputRef.current?.click()}>
                  Choose image
                </button>
              </div>
              <input ref={fileInputRef} className="hidden" type="file" accept="image/png,image/jpeg,image/webp" onChange={handleImageChange} aria-label="Choose popup image" />
              <div className="rounded-md border border-line-soft bg-surface-1 px-3 py-2 text-[12.5px] leading-relaxed text-ink-soft">
                {form.imageWidth && form.imageHeight ? `${form.imageWidth} x ${form.imageHeight}px - ${formatBytes(form.imageBytes)}` : formatBytes(form.imageBytes)}
              </div>
              <label className={ui.formLabel}>
                Image alt text
                <input className={ui.input} value={form.imageAlt} onChange={(event) => patchForm({ imageAlt: event.target.value })} placeholder="Describe the image" maxLength={160} />
              </label>
              {previewImageUrl ? (
                <button
                  className={ui.secondaryAction}
                  type="button"
                  onClick={() => patchForm({ imageDataUrl: '', imageUrl: '', imageFileName: '', imageWidth: 0, imageHeight: 0, imageBytes: 0 })}
                >
                  Remove image
                </button>
              ) : null}
            </div>

            <label className={ui.formLabel}>
              Button URL
              <input className={ui.input} value={form.buttonUrl} onChange={(event) => patchForm({ buttonUrl: event.target.value })} placeholder="https://xyndrome.lk/register" />
            </label>

            <div className={ui.buttonRow}>
              <button className={ui.primaryAction} type="submit" disabled={status.saving || (form.enabled && !hasContent)}>
                {status.saving ? 'Saving...' : 'Save popup alert'}
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
                {settings?.configured ? 'Popup content saved' : 'Add text or an image before enabling'}
              </strong>
            </div>

            <div className="overflow-hidden rounded-lg border border-line-soft bg-surface-card shadow-sm">
              {previewImageUrl ? (
                <img
                  className="aspect-[16/9] w-full bg-surface-2 object-cover"
                  src={previewImageUrl}
                  alt={form.imageAlt || ''}
                  onError={(event) => {
                    event.currentTarget.hidden = true;
                  }}
                />
              ) : (
                <div className="grid aspect-[16/9] place-items-center bg-surface-2 text-[12.5px] font-bold text-ink-soft">Image preview</div>
              )}
              <div className="grid gap-3 p-5">
                <span className="w-fit rounded-full border border-brand-primary/20 bg-[var(--color-primary-light)] px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-brand-primary">
                  {form.placement === 'all' ? 'Everywhere' : form.placement}
                </span>
                <h3 className="m-0 text-[22px] font-black leading-tight text-ink-strong">{form.title || 'Popup title preview'}</h3>
                <p className="m-0 whitespace-pre-wrap text-[14px] leading-relaxed text-ink-medium">{form.body || 'Popup message preview.'}</p>
                {form.buttonLabel ? <span className={cx(ui.primaryAction, 'w-fit rounded-lg px-4 py-3 text-[13px]')}>{form.buttonLabel}</span> : null}
              </div>
            </div>

            <div className={ui.warningFeedback}>
              Students can close the popup. A newly saved version will appear again in their next session.
            </div>
            <p className="m-0 text-[12.5px] leading-relaxed text-ink-soft">{settings?.note}</p>
          </aside>
        </div>
      )}
    </div>
  );
}
