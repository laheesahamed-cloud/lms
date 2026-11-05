import { cx } from '../styles/tailwindClasses.js';
import { SubjectIcon } from './SubjectIcon.jsx';

// The course card used on Courses and Q-Bank / Exams: subject icon and name,
// a small count line with the percentage, and a progress bar. One component so
// the two pages cannot drift apart.

const courseVisualPresets = [
  {
    key: 'cardio',
    label: 'Clinical rhythm',
    keywords: ['cardio', 'heart', 'ecg', 'physiology', 'circulation'],
  },
  {
    key: 'pharma',
    label: 'Therapy logic',
    keywords: ['pharma', 'drug', 'medicine', 'therapy', 'prescription'],
  },
  {
    key: 'micro',
    label: 'Pattern recall',
    keywords: ['micro', 'infection', 'pathogen', 'immunology', 'biology'],
  },
  {
    key: 'anatomy',
    label: 'Body systems',
    keywords: ['anatomy', 'body', 'organ', 'clinical', 'surgery'],
  },
  {
    key: 'default',
    label: 'Study pathway',
    keywords: [],
  },
];

function getCourseVisual(title, description, index = 0) {
  const haystack = `${title || ''} ${description || ''}`.toLowerCase();
  const matched = courseVisualPresets.find((preset) =>
    preset.key !== 'default' && preset.keywords.some((keyword) => haystack.includes(keyword))
  );

  return matched || courseVisualPresets[index % courseVisualPresets.length] || courseVisualPresets[courseVisualPresets.length - 1];
}

function clampPercent(value) {
  const numericValue = Number(value || 0);
  if (!Number.isFinite(numericValue)) return 0;
  return Math.max(0, Math.min(100, Math.round(numericValue)));
}

function getCourseStatus(progress) {
  if (progress >= 100) {
    return {
      label: 'Completed',
      className: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-200',
    };
  }

  if (progress > 0) {
    return {
      label: 'In progress',
      className: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/25 dark:bg-sky-400/10 dark:text-sky-200',
    };
  }

  return {
    label: 'Ready',
    className: 'border-line-soft bg-surface-2 text-ink-medium dark:border-white/10 dark:bg-white/[0.05] dark:text-white/70',
  };
}

export function CourseProgressCard({ title, description = '', meta, progress, index = 0, onOpen }) {
  const pct = clampPercent(progress);
  const status = getCourseStatus(pct);
  const visual = getCourseVisual(title, description, index);

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open ${title}`}
      className={cx(
        'lms-quiz-card lms-quiz-course-card student-course-card student-course-card--simple lms-card-clickable group grid min-h-[112px] gap-3.5 rounded-[var(--ds-card-radius)] border border-line-soft bg-surface-card p-4 text-left shadow-[var(--ds-card-shadow)] outline-none transition-[background,border-color,box-shadow,transform] duration-150 ease-[var(--ease-out)] hover:border-brand-primary/18 hover:bg-surface-2/35 active:scale-[0.98] focus-visible:ring-4 focus-visible:ring-brand-primary/18 dark:border-white/[0.07] dark:bg-[rgba(6,10,18,0.92)] dark:hover:bg-white/[0.035] max-[520px]:min-h-[100px] max-[520px]:rounded-[var(--ds-card-radius-compact)] max-[520px]:p-3.5',
        `student-course-card--${visual.key}`
      )}
    >
      <div className="flex items-start gap-3">
        <span className="student-course-card__icon relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl border-0">
          <SubjectIcon name={title} />
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <h2 className="lms-card-title line-clamp-2 dark:text-white max-[520px]:text-[14px]" title={title}>
            {title}
          </h2>
          {/* "Ready" is the default state of a course that has not been started, so
              it says nothing; only a real state gets a pill. */}
          {status.label !== 'Ready' ? (
            <span className={cx('mt-2 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-black uppercase', status.className)}>
              {status.label}
            </span>
          ) : null}
        </div>
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-2 text-[11px] font-bold">
          <span className="truncate text-ink-muted" title={meta}>
            {meta}
          </span>
          <span className={cx('font-extrabold', pct >= 100 ? 'text-brand-primary dark:text-sky-300' : 'text-ink-strong dark:text-white')}>
            {pct}%
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-surface-3 dark:bg-white/[0.09]">
          <span
            className="student-course-card__progress-fill block h-full w-full origin-left rounded-full transition-transform duration-500 ease-out"
            style={{ transform: `scaleX(${pct / 100})` }}
          />
        </div>
      </div>
    </button>
  );
}
