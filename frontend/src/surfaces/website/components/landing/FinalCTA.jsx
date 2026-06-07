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
            Try the LMS with structured notes, MCQs, mock exams, and progress tracking. No credit card required.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to={primaryTo}
              className="lpv2-press inline-flex items-center gap-2 rounded-2xl bg-[#111118] px-8 py-4 text-[15px] font-bold text-white shadow-[0_18px_40px_-18px_rgba(17,17,24,0.6)] hover:shadow-[0_26px_50px_-18px_rgba(17,17,24,0.7)]"
            >
              Start Free Trial
              <svg width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </Link>
            <a
              href="#subjects"
              className="lpv2-press inline-flex items-center gap-2 rounded-2xl border-[1.5px] border-[#111118] bg-white/40 px-8 py-4 text-[15px] font-bold text-[#111118] backdrop-blur-sm hover:bg-white/70"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.5-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14z" /></svg>
              Watch Demo
            </a>
          </div>

          <p className="mt-7 text-[12.5px] font-medium text-[#6b7280]">
            Secure access&nbsp;&nbsp;·&nbsp;&nbsp;Made for Sri Lanka&nbsp;&nbsp;·&nbsp;&nbsp;iOS &amp; Android
          </p>
        </div>
      </div>
    </section>
  );
}

export default FinalCTA;
