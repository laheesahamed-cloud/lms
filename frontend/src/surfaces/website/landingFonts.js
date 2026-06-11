// Landing-only typefaces (DM Serif Display + JetBrains Mono) load with the
// landing chunk instead of the global shell, so app/admin routes never pay
// for their stylesheet. Plus Jakarta Sans stays global in index.html.
const LANDING_FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=JetBrains+Mono:wght@400;500;700&display=optional';

let injected = false;

export function ensureLandingFonts() {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  if (document.querySelector(`link[href="${LANDING_FONTS_HREF}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = LANDING_FONTS_HREF;
  link.crossOrigin = 'anonymous';
  document.head.appendChild(link);
}
