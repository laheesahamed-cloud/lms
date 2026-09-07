// Identifies requests coming from the official Xyndrome mobile app (Flutter,
// iOS/Android) as opposed to the web app. Used to gate premium content that
// must only ever be consumed inside the mobile app (see AppOnlyContentException).
//
// NOTE: this is a soft signal, not device attestation — a header can be forged
// by anyone calling the API directly (curl, Postman, a modified web build). It
// is enough to stop the *website* from ever rendering premium content (the
// actual goal here), but it is not anti-piracy DRM. If that bar is ever needed,
// look at App Attest (iOS) / Play Integrity (Android) instead.
export const APP_CLIENT_HEADER = 'x-app-client';
export const MOBILE_APP_CLIENT_VALUE = 'xyndrome-mobile-app';

export function isMobileAppClient(headerValue?: string | string[] | null): boolean {
  if (!headerValue) return false;
  const value = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  return String(value).trim().toLowerCase() === MOBILE_APP_CLIENT_VALUE;
}
