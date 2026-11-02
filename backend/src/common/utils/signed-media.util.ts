import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Stable signatures for media URLs that have to work without a login header —
 * an <audio> tag or the mobile app's media player sends none.
 *
 * The signature is an HMAC of WHAT is being fetched ("ecg:12", "sound:12",
 * "media:slug/file.webp"), not of when. So a URL never changes between
 * requests, which keeps the app's URL-keyed media cache working, but it can't be
 * guessed or counted up to, which is what the old plain-id URLs allowed. The
 * server only hands a signed URL to someone it has already authorised for that
 * content; anyone holding the bare path gets nothing.
 *
 * A URL that is copied and shared still works for whoever has it. That is the
 * trade for having no per-request token, and it's far narrower than "anyone on
 * the internet can download the whole library".
 */

const SIGNATURE_LENGTH = 24;

function secret() {
  return String(
    process.env.MEDIA_URL_SECRET
      || process.env.SETTINGS_ENCRYPTION_KEY
      || 'lms-dev-media-url-key-change-me'
  );
}

export function signMedia(resource: string) {
  return createHmac('sha256', secret())
    .update(resource)
    .digest('base64url')
    .slice(0, SIGNATURE_LENGTH);
}

export function isValidMediaSignature(resource: string, signature: unknown) {
  if (typeof signature !== 'string' || signature.length !== SIGNATURE_LENGTH) return false;
  const expected = Buffer.from(signMedia(resource));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/**
 * Lesson PDFs and videos live under /uploads/pdf and /uploads/video, stored as
 * plain `/uploads/...` paths. A response that carries one for a reader who may
 * open it gets the same stable signature appended; the file route checks it.
 */
const SIGNABLE_UPLOAD = /^\/uploads\/(?:pdf|video)\/[A-Za-z0-9._-]+$/;

export function isSignableUploadPath(path: string) {
  return SIGNABLE_UPLOAD.test(path);
}

export function uploadResource(path: string) {
  return `upload:${path}`;
}

/** `/uploads/pdf/x.pdf` -> `/uploads/pdf/x.pdf?s=<sig>`; anything else is returned untouched. */
export function signUploadUrl(url: string) {
  if (!isSignableUploadPath(url)) return url;
  return `${url}?s=${signMedia(uploadResource(url))}`;
}
