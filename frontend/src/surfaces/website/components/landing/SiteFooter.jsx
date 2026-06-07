/*
 * SiteFooter — section 11. Near-black footer, 3-column on desktop, stacked on
 * mobile, with a bottom bar. Logo uses the dark-bg (light) brand mark.
 */
import { Link } from 'react-router-dom';

const ASSET = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/';
const LOGO = `${ASSET}brand/xyndrome-logo-mark-dark.webp`;

const NAV = [
  { label: 'Subjects', href: '#subjects' },
  { label: 'Pricing', to: '/subscriptions' },
  { label: 'About', href: '#about' },
  { label: 'Sign In', to: '/login' },
  { label: 'Get Started', to: '/register' },
];

const POLICY_NAV = [
  { label: 'Terms', to: '/terms' },
  { label: 'Privacy', to: '/privacy-policy' },
  { label: 'Refunds', to: '/refund-policy' },
];

function Social({ label, d }) {
  return (
    <a href="#" aria-label={label} className="grid h-9 w-9 place-items-center rounded-lg border border-white/12 text-white/55 transition-colors duration-200 hover:border-[#5274f3]/50 hover:text-[#7aa2ff]">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={d} /></svg>
    </a>
  );
}

export function SiteFooter() {
  return (
    <footer className="bg-[#111118] text-white">
      <div className="mx-auto grid w-[min(1180px,calc(100%-40px))] gap-10 py-16 md:grid-cols-3">
        {/* Left */}
        <div>
          <Link to="/" className="mb-4 inline-flex items-center gap-2.5 no-underline">
            <img src={LOGO} alt="xyndrome" width="30" height="30" className="h-7 w-auto" />
            <span className="text-[18px] font-extrabold tracking-tight text-white">xyndrome</span>
          </Link>
          <p className="max-w-xs text-[13.5px] leading-relaxed text-white/55">Sri Lanka’s medical exam companion.</p>
          <p className="mt-3 text-[13px] font-semibold text-[#7aa2ff]">xyndrome.lk</p>
        </div>

        {/* Center */}
        <nav className="flex flex-col gap-2.5 md:items-center">
          <span className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-white/35">Platform</span>
          {NAV.map((l) => (
            l.to ? (
              <Link key={l.label} to={l.to} className="group w-fit text-[14px] text-white/60 no-underline transition-colors hover:text-white">
                <span className="bg-[linear-gradient(currentColor,currentColor)] bg-[length:0%_1px] bg-left-bottom bg-no-repeat pb-0.5 transition-[background-size] duration-300 group-hover:bg-[length:100%_1px]">{l.label}</span>
              </Link>
            ) : (
              <a key={l.label} href={l.href} className="group w-fit text-[14px] text-white/60 no-underline transition-colors hover:text-white">
                <span className="bg-[linear-gradient(currentColor,currentColor)] bg-[length:0%_1px] bg-left-bottom bg-no-repeat pb-0.5 transition-[background-size] duration-300 group-hover:bg-[length:100%_1px]">{l.label}</span>
              </a>
            )
          ))}
        </nav>

        {/* Right */}
        <div className="md:justify-self-end">
          <span className="mb-3 block text-[11px] font-bold uppercase tracking-[0.14em] text-white/35">Follow</span>
          <div className="flex gap-2.5">
            <Social label="Instagram" d="M12 2.2c3.2 0 3.6 0 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s0 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58 0-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 0 1-1.38-.9 3.7 3.7 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.21 15.58 2.2 15.2 2.2 12s0-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.21 8.8 2.2 12 2.2zm0 3.65A6.15 6.15 0 1 0 18.15 12 6.15 6.15 0 0 0 12 5.85zm0 10.15A4 4 0 1 1 16 12a4 4 0 0 1-4 4zm6.4-10.4a1.44 1.44 0 1 1-1.44-1.44 1.44 1.44 0 0 1 1.44 1.44z" />
            <Social label="Facebook" d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.78-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12z" />
            <Social label="X" d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.65l-5.21-6.82-5.97 6.82H1.68l7.73-8.84L1.25 2.25h6.82l4.71 6.23 5.46-6.23zm-1.16 17.52h1.84L7.01 4.13H5.04l12.04 15.64z" />
          </div>
          <div className="mt-5 flex flex-col gap-2">
            <span className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/14 px-3 py-2 text-[12px] font-semibold text-white/60"> App Store</span>
            <span className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/14 px-3 py-2 text-[12px] font-semibold text-white/60">Google Play</span>
          </div>
        </div>
      </div>

      <div className="border-t border-white/[0.08]">
        <div className="mx-auto flex w-[min(1180px,calc(100%-40px))] flex-col items-center justify-between gap-2 py-5 text-center text-[12px] text-white/40 sm:flex-row sm:text-left">
          <span>© 2026 xyndrome · Built for Sri Lankan medical students</span>
          <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1" aria-label="Policies">
            {POLICY_NAV.map((link) => (
              <Link key={link.label} to={link.to} className="text-white/45 no-underline transition-colors hover:text-white">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}

export default SiteFooter;
