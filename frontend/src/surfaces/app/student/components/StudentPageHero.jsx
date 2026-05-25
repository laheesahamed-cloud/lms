import { cx } from '../../../../shared/styles/tailwindClasses.js';

const dashboardHeroTheme = {
  accent: 'text-brand-primary',
  chip: 'border-brand-primary/18 bg-brand-primary/8 text-brand-primary dark:border-sky-300/16 dark:bg-sky-400/10 dark:text-sky-100',
  mark: 'text-brand-primary/45 dark:text-sky-200/40',
};

function HeroMark() {
  return (
    <svg className="h-full w-full" viewBox="0 0 220 180" fill="none" aria-hidden="true">
      <path d="M38 126h92c22 0 40-18 40-40s-18-40-40-40H78c-22 0-40 18-40 40v40Z" stroke="currentColor" strokeWidth="2" opacity=".18" />
      <path d="M64 74h72M64 94h56M64 114h38" stroke="currentColor" strokeWidth="5" strokeLinecap="round" opacity=".22" />
      <path d="M150 92h16l8-22 12 44 9-24h18" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity=".32" />
      <circle cx="164" cy="70" r="5" fill="currentColor" opacity=".24" />
      <circle cx="186" cy="114" r="5" fill="currentColor" opacity=".20" />
      <rect x="34" y="36" width="74" height="104" rx="18" stroke="currentColor" strokeWidth="2" opacity=".14" />
      <rect x="54" y="24" width="34" height="22" rx="11" fill="currentColor" opacity=".14" />
    </svg>
  );
}

export function StudentPageHero({
  eyebrow = '',
  title,
  subtitle,
  metrics = [],
  className = '',
}) {
  const theme = dashboardHeroTheme;
  const visibleMetrics = metrics.filter(Boolean).slice(0, 4);

  return (
    <section
      className={cx(
        'student-page-hero lms-hero-card lms-page-header-card grid min-h-[148px] overflow-hidden rounded-[18px] border border-line-soft bg-surface-card p-5 text-ink-strong shadow-sm dark:border-white/[0.08] dark:bg-white/[0.035] max-[640px]:min-h-0 max-[640px]:rounded-[16px] max-[640px]:p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center',
        className
      )}
    >
      <div className="relative z-[1] flex h-full min-w-0 flex-col justify-between gap-4">
        <div className="min-w-0">
          {eyebrow ? (
            <p className={cx('student-page-hero__eyebrow m-0 mb-2 text-[11px] font-black uppercase tracking-[0.12em]', theme.accent)}>{eyebrow}</p>
          ) : null}
          <h1 className="student-page-hero__title m-0 text-[clamp(25px,4vw,40px)] font-black leading-[1.04] tracking-normal text-ink-strong dark:text-white max-[520px]:text-[clamp(23px,7vw,32px)]">
            {title}
          </h1>
          {subtitle ? (
            <p className="student-page-hero__subtitle m-0 mt-3 max-w-[680px] text-[clamp(13.5px,1.35vw,16px)] font-medium leading-relaxed text-ink-soft dark:text-white/62 max-[520px]:line-clamp-3">
              {subtitle}
            </p>
          ) : null}
        </div>

        {visibleMetrics.length ? (
          <div className="grid grid-cols-[repeat(4,minmax(0,1fr))] gap-2.5 max-[760px]:grid-cols-2 max-[520px]:gap-2">
            {visibleMetrics.map((metric, index) => (
              <div
                className={cx('student-page-hero__metric min-w-0 rounded-[14px] border px-3 py-2.5 max-[640px]:rounded-[12px] max-[640px]:px-3 max-[640px]:py-2', theme.chip)}
                key={`${metric.label}-${index}`}
              >
                <strong className="student-page-hero__metric-value block truncate text-[clamp(18px,2.2vw,26px)] font-black leading-none text-ink-strong dark:text-white">{metric.value}</strong>
                <span className="student-page-hero__metric-label mt-1 block truncate text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink-soft dark:text-white/58 max-[520px]:text-[9.5px]">{metric.label}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className={cx('pointer-events-none hidden size-[clamp(86px,11vw,132px)] opacity-70 lg:block', theme.mark)} aria-hidden="true">
        <HeroMark />
      </div>
    </section>
  );
}
