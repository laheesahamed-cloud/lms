// Shared client-side image optimizer.
//
// Re-encodes an uploaded image to WebP and caps its width, stepping quality/size
// down only as far as needed to reach a target byte size. Used wherever the admin
// uploads an inline image (flashcards, question explanations) so the stored
// base64 stays small for the DB and API payloads.
//
// Lossy (WebP) but visually near-lossless at these qualities. It never returns a
// result larger than the original, and an already-small, sensibly sized image is
// kept untouched so we never trade quality for nothing.

const DEFAULT_TARGET_BYTES = 240 * 1024; // aim small: ~240 KB
const DEFAULT_MAX_WIDTH = 1280; // ample resolution for a flashcard / explanation figure
export const IMAGE_OPTIMIZER_MAX_BYTES = 1024 * 1024; // hard ceiling (backend enforces this too)

const DEFAULT_ATTEMPTS = [
  [1280, 0.86],
  [1280, 0.8],
  [1152, 0.82],
  [1024, 0.82],
  [1024, 0.76],
  [896, 0.78],
  [768, 0.74],
];

export function dataUrlByteLength(dataUrl) {
  const base64 = String(dataUrl || '').split(',')[1] || '';
  return Math.ceil((base64.length * 3) / 4);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Image read failed'));
    reader.readAsDataURL(file);
  });
}

function canvasToDataUrl(canvas, type, quality) {
  const dataUrl = canvas.toDataURL(type, quality);
  return type === 'image/webp' && !dataUrl.startsWith('data:image/webp')
    ? canvas.toDataURL('image/jpeg', quality)
    : dataUrl;
}

// Returns { src, optimized, size, width, height }. `src` is a data: URL ready to
// store/send; `size` is its byte length; `optimized` is false when the original
// was already small enough to keep as-is.
export async function optimizeImageFile(file, options = {}) {
  const targetBytes = options.targetBytes || DEFAULT_TARGET_BYTES;
  const maxWidth = options.maxWidth || DEFAULT_MAX_WIDTH;
  const attempts = options.attempts || DEFAULT_ATTEMPTS;

  const original = await readFileAsDataUrl(file);
  const originalBytes = dataUrlByteLength(original);

  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Image load failed'));
      img.src = url;
    });

    const naturalWidth = image.naturalWidth || image.width;
    const naturalHeight = image.naturalHeight || image.height;

    // Already small enough and not oversized → keep as-is (no re-encode, no quality loss).
    if (naturalWidth <= maxWidth && originalBytes <= targetBytes) {
      return { src: original, optimized: false, size: originalBytes, width: naturalWidth, height: naturalHeight };
    }

    let best = '';
    let bestBytes = Infinity;
    let bestWidth = naturalWidth;
    let bestHeight = naturalHeight;
    for (const [attemptWidth, quality] of attempts) {
      let width = naturalWidth;
      let height = naturalHeight;
      if (width > attemptWidth) {
        height = Math.round((height * attemptWidth) / width);
        width = attemptWidth;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d', { alpha: true }).drawImage(image, 0, 0, width, height);
      const next = canvasToDataUrl(canvas, 'image/webp', quality);
      const nextBytes = dataUrlByteLength(next);
      if (nextBytes < bestBytes) {
        best = next;
        bestBytes = nextBytes;
        bestWidth = width;
        bestHeight = height;
      }
      if (nextBytes <= targetBytes) {
        return { src: next, optimized: true, size: nextBytes, width, height };
      }
    }

    // Couldn't reach the target — fall back to the smallest result, but never
    // hand back something heavier than what the user picked.
    if (!best || bestBytes >= originalBytes) {
      return { src: original, optimized: false, size: originalBytes, width: naturalWidth, height: naturalHeight };
    }
    return { src: best, optimized: true, size: bestBytes, width: bestWidth, height: bestHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}
