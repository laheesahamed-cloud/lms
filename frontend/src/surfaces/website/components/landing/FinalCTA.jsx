/*
 * FinalCTA — section 10. Pastel gradient-mesh background (never flat),
 * DM Serif headline, tactile dark primary + ghost secondary, trust line,
 * thin indigo divider above.
 */
import { Link } from 'react-router-dom';

const ASSET = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/';

const MESH = `
  radial-gradient(ellipse at 20% 50%, rgba(255,214,214,0.5) 0%, transparent 50%),
  radial-gradient(ellipse at 80% 20%, rgba(232,214,255,0.5) 0%, transparent 50%),
  radial-gradient(ellipse at 60% 80%, rgba(214,255,232,0.5) 0%, transparent 50%),
  #fafaf7
`;

export function FinalCTA({ primaryTo = '/register' }) {
  return (
    <section className="relative">
      <div className="lpv2-brand-rule" aria-hidden="true" />
      <div className="relative overflow-hidden px-6 py-24 text-center md:py-32" style={{ background: MESH }}>
        <div className="relative z-[1] mx-auto max-w-2xl">
          <img src={`${ASSET}landing/logo.png`} alt="xyndrome" width="120" height="92" className="mx-auto mb-7 h-16 w-auto" />
          <h2 className="font-display text-[clamp(40px,8vw,80px)] leading-[1.02] text-[#111118]">Start your free trial.</h2>
          <p className="mx-auto mt-5 max-w-md text-[15px] text-[#6b7280] md:text-base">
            Try write-on notes, a teaching Q-Bank, your own flashcards, mock exams and a study planner, all in one app. No credit card required.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <a href="https://play.google.com/store" target="_blank" rel="noopener noreferrer" className="lpv2-press inline-block no-underline">
              <img
                src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png"
                alt="Get it on Google Play"
                height="56"
                className="h-14 w-auto"
              />
            </a>
            <a href="https://apps.apple.com" target="_blank" rel="noopener noreferrer" className="lpv2-press inline-block no-underline">
              <img
                src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg"
                alt="Download on the App Store"
                height="56"
                className="h-14 w-auto"
              />
            </a>
          </div>

          <a href="https://instagram.com/xyndrome.med" target="_blank" rel="noopener noreferrer"
            className="mt-5 inline-flex items-center gap-2 no-underline transition-opacity hover:opacity-70">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="0.5" fill="#6b7280" stroke="none"/>
            </svg>
            <span className="text-[13px] font-semibold text-[#6b7280]">@xyndrome.med</span>
          </a>

          <p className="mt-4 text-[12.5px] font-medium text-[#6b7280]">
            Secure access&nbsp;&nbsp;·&nbsp;&nbsp;Made for Sri Lanka&nbsp;&nbsp;·&nbsp;&nbsp;iOS &amp; Android
          </p>
        </div>
      </div>
    </section>
  );
}
