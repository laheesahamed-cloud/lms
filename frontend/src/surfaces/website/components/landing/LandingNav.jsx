/*
 * LandingNav — fixed, theme-aware navbar for the v2 landing page.
 * Transparent + white wordmark/logo while it sits over a dark section (the
 * cinematic hero is pinned dark for ~8200px, plus the dark subjects gallery);
 * solid white + dark wordmark over the light sections. The parent samples the
 * colour under the bar and passes `overDark` so the bar never mismatches the
 * section behind it. Brand echo: the CTA is the only element with solid indigo bg.
 */
import { Link } from 'react-router-dom';

const ASSET = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/';
const LOGO_LIGHTBG = `${ASSET}brand/xyndrome-logo-mark-light.webp`; // dark logo for light bg
const LOGO_DARKBG = `${ASSET}brand/xyndrome-logo-mark-dark.webp`;   // light logo for dark bg

const NAV_LINKS = [
  { label: 'Subjects', href: '#subjects' },
  { label: 'Features', href: '#features' },
  { label: 'About', href: '#about' },
];

export function LandingNav({ ctaTo = '/register', signInTo = '/login', overDark = true }) {
  // Frosted/dark-text only when the bar is NOT over a dark section.
  const scrolled = !overDark;

  const linkColor = scrolled ? 'text-[#111118]/70 hover:text-[#111118]' : 'text-white/80 hover:text-white';

  return (
    <header
      className={[
        // pt = top safe-area inset so the bar's own background fills the iPhone
        // notch strip (matching whatever section is behind it) instead of leaving
        // an empty, mismatched gap above the bar.
        'fixed inset-x-0 top-0 z-[20000] pt-[env(safe-area-inset-top,0px)] transition-[background-color,box-shadow,backdrop-filter,border-color] duration-300',
        scrolled
          ? 'border-b border-[#111118]/8 bg-white shadow-[0_4px_24px_rgba(17,17,24,0.06)]'
          : 'border-b border-transparent bg-transparent',
      ].join(' ')}
    >
      <div className="mx-auto flex h-[64px] w-[min(1180px,calc(100%-40px))] items-center gap-8">
        <Link to="/" className="flex shrink-0 items-center gap-2.5 no-underline" aria-label="xyndrome home">
          <img
            src={scrolled ? LOGO_LIGHTBG : LOGO_DARKBG}
            alt="xyndrome"
            width="32"
            height="32"
            className="h-8 w-auto"
          />
          <span className={['text-[18px] font-extrabold tracking-tight transition-colors duration-300', scrolled ? 'text-[#111118]' : 'text-white'].join(' ')}>
            xyndrome
          </span>
        </Link>

        <nav className="hidden flex-1 justify-center gap-8 md:flex">
          {NAV_LINKS.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className={['relative text-[14px] font-semibold no-underline transition-colors duration-200 after:absolute after:-bottom-1 after:left-0 after:h-[2px] after:w-full after:origin-left after:scale-x-0 after:bg-[#2563eb] after:transition-transform after:duration-300 hover:after:scale-x-100', linkColor].join(' ')}
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-3 md:ml-0">
          <Link
            to={signInTo}
            className={['hidden text-[14px] font-semibold no-underline transition-colors duration-200 sm:inline-flex', linkColor].join(' ')}
          >
            Sign In
          </Link>
          <Link
            to={ctaTo}
            className="lpv2-press inline-flex items-center gap-1.5 rounded-xl bg-[#2563eb] px-4 py-2 text-[14px] font-bold text-white no-underline shadow-[0_8px_20px_-8px_rgba(37,99,235,0.7)] hover:bg-[#1d4fd7]"
          >
            Start Free Trial
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      </div>
    </header>
  );
}
