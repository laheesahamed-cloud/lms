// Landing-only typeface (JetBrains Mono, used by the boot loader + hero browser
// chrome) loads with the landing chunk instead of the global shell, so app/admin
// routes never pay for its stylesheet. Headings/body use the brand font (Plus
// Jakarta Sans), which is self-hosted globally.
const LANDING_FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=optional';

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
