/*
 * FinalCTA — section 10. Pastel gradient-mesh background (never flat),
 * DM Serif headline, store badges (non-clickable), Instagram, trust line.
 */

const ASSET = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/';

const MESH = `
  radial-gradient(ellipse at 20% 50%, rgba(255,214,214,0.5) 0%, transparent 50%),
  radial-gradient(ellipse at 80% 20%, rgba(232,214,255,0.5) 0%, transparent 50%),
  radial-gradient(ellipse at 60% 80%, rgba(214,255,232,0.5) 0%, transparent 50%),
  #fafaf7
`;

export function FinalCTA() {
  return (
    <section className="relative">
      <div className="lpv2-brand-rule" aria-hidden="true" />
      <div className="relative overflow-hidden px-6 py-24 text-center md:py-32" style={{ background: MESH }}>
        <div className="relative z-[1] mx-auto max-w-2xl">
          <img src={`${ASSET}landing/logo.png`} alt="xyndrome" width="120" height="92" className="mx-auto mb-7 h-16 w-auto" />
          <h2 className="font-display text-[clamp(40px,8vw,80px)] leading-[1.02] text-[#111118]">Download the app.</h2>
          <p className="mx-auto mt-5 max-w-md text-[15px] text-[#6b7280] md:text-base">
            Write-on notes, a teaching Q-Bank, your own flashcards, mock exams and a study planner — all in one app.
          </p>

          {/* Store badges — display only, not clickable */}
          <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
            <div className="inline-flex h-[52px] items-center overflow-hidden rounded-xl">
              <img
                src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png"
                alt="Get it on Google Play"
                className="h-[70px] w-auto"
                style={{ marginTop: '-9px', marginBottom: '-9px' }}
              />
            </div>
            <div className="inline-flex h-[52px] items-center overflow-hidden rounded-xl">
              <img
                src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg"
                alt="Download on the App Store"
                className="h-[52px] w-auto"
              />
            </div>
          </div>
          <p className="mt-3 text-[12px] italic text-[#9ca3af]">
            coming soon — in progress. very slowly. but in progress. we start Monday. (every Monday.)
          </p>

          {/* Instagram */}
          <div className="mt-6 flex items-center justify-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"
              stroke="url(#igGrad)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <defs>
                <linearGradient id="igGrad" x1="0" y1="24" x2="24" y2="0" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#f09433"/>
                  <stop offset="25%" stopColor="#e6683c"/>
                  <stop offset="50%" stopColor="#dc2743"/>
                  <stop offset="75%" stopColor="#cc2366"/>
                  <stop offset="100%" stopColor="#bc1888"/>
                </linearGradient>
              </defs>
              <rect x="2" y="2" width="20" height="20" rx="5"/>
              <circle cx="12" cy="12" r="4"/>
              <circle cx="17.5" cy="6.5" r="1" fill="#dc2743" stroke="none"/>
            </svg>
            <span className="text-[14px] font-semibold text-[#111118]">@xyndrome.med</span>
          </div>

          <p className="mt-5 text-[12.5px] font-medium text-[#6b7280]">
            Secure access&nbsp;&nbsp;·&nbsp;&nbsp;Made for Sri Lanka&nbsp;&nbsp;·&nbsp;&nbsp;iOS &amp; Android
          </p>
        </div>
      </div>
    </section>
  );
}
