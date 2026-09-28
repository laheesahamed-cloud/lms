import { optimizeImageFile } from '../../../../shared/utils/imageOptimizer.js';
import { adminUploadOsceSlot, adminUploadOsceGlobal } from '../../../../shared/api/osce.api.js';

/**
 * OSCE images are pinch-zoomed, so they need more resolution than a flashcard
 * figure — the shared optimizer's 1280px / 240 KB defaults are raised per slot.
 * The backend has no image library (no `sharp`), so every resize happens here.
 */
const SLOT_TARGETS = {
  cover: { maxWidth: 1200, targetBytes: 180 * 1024 },
  scene: { maxWidth: 1600, targetBytes: 420 * 1024 },
  sign: { maxWidth: 1500, targetBytes: 360 * 1024 },
  ix: { maxWidth: 2000, targetBytes: 480 * 1024 },
  chain: { maxWidth: 800, targetBytes: 140 * 1024 },
};

function targetsFor(slot) {
  const family = String(slot || '').split(':')[0];
  return SLOT_TARGETS[family] || SLOT_TARGETS.scene;
}

function dataUrlToBlob(dataUrl) {
  const [head, body] = String(dataUrl).split(',');
  const mime = (head.match(/data:([^;]+)/) || [, 'image/webp'])[1];
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/** Small list-view copy of the same image, so a phone never pulls the full file. */
async function makeThumb(dataUrl, width = 480) {
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read the optimized image'));
    img.src = dataUrl;
  });
  const scale = Math.min(1, width / image.naturalWidth);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/webp', 0.75);
}

/**
 * Optimize a picked file for its slot and upload it. Returns the saved record
 * plus the sizes, so the panel can show what the student will actually download.
 */
export async function optimizeAndUploadSlot(caseId, slot, file, options = {}) {
  const { maxWidth, targetBytes } = targetsFor(slot);
  const optimized = await optimizeImageFile(file, { maxWidth, targetBytes });
  const thumb = await makeThumb(optimized.src).catch(() => null);

  const blob = dataUrlToBlob(optimized.src);
  const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
  const upload = new File([blob], `${slot.replace(/:/g, '-')}.${ext}`, { type: blob.type });

  const saved = await adminUploadOsceSlot(caseId, slot, {
    file: upload,
    width: optimized.width,
    height: optimized.height,
    thumb,
    source: options.source,
  });
  return { ...saved, width: optimized.width, height: optimized.height, bytes: blob.size };
}

/** Same pipeline for a file that arrived as a data URL (the bulk-drop inbox). */
export async function optimizeAndUploadDataUrl(caseId, slot, dataUrl, fileName, options = {}) {
  const blob = dataUrlToBlob(dataUrl);
  const file = new File([blob], fileName || 'inbox-image', { type: blob.type });
  return optimizeAndUploadSlot(caseId, slot, file, options);
}

/**
 * The shared doctor/patient art, optimised the same way. `saveGlobalImage` also
 * writes raw bytes, so without this the two portraits every long case loads
 * would be full-size PNGs.
 */
export async function optimizeAndUploadGlobal(slot, source) {
  const file = typeof source === 'string'
    ? new File([dataUrlToBlob(source)], 'generated', { type: dataUrlToBlob(source).type })
    : source;
  const optimized = await optimizeImageFile(file, {
    maxWidth: 1200, targetBytes: 200 * 1024,
  });
  const blob = dataUrlToBlob(optimized.src);
  const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
  const upload = new File([blob], `${slot}.${ext}`, { type: blob.type });
  const saved = await adminUploadOsceGlobal(slot, upload);
  return { ...saved, bytes: blob.size };
}

/** How far off the recommended shape a supplied image is, as a warning only. */
export function ratioWarning(spec, width, height) {
  if (!spec?.width || !spec?.height || !width || !height) return null;
  const want = spec.width / spec.height;
  const got = width / height;
  const drift = Math.abs(got - want) / want;
  if (drift < 0.12) return null;
  return `Supplied ${width}×${height} (${got.toFixed(2)}:1) — this slot expects ${spec.ratio}. It will still work, but may crop oddly.`;
}
