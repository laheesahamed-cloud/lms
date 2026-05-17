import { useEffect, useMemo, useState } from 'react';
import { cx, ui } from '../../../../shared/styles/tailwindClasses.js';

const STUDY_COLORS = ['#2563eb', '#f59e0b', '#ef4444', '#10b981', '#8b5cf6', '#06b6d4'];
const studyUi = {
  highlight:
    'rounded-[3px] bg-amber-700/15 px-1 font-semibold not-italic text-amber-800 dark:bg-amber-600/35 dark:text-[#ffe57a]',
  boldTerm: 'font-bold text-blue-700 dark:text-[#ff8a80]',
  empty:
    'flex min-h-[300px] flex-1 flex-col items-center justify-center gap-3.5 px-10 py-[60px] text-center text-ink-muted [&_h3]:m-0 [&_h3]:text-base [&_h3]:text-ink-medium [&_p]:m-0 [&_p]:text-[13px]',
  shell: 'flex min-h-full flex-col gap-3.5 px-[18px] pb-[22px] pt-[18px]',
  topbar:
    'flex flex-wrap items-start justify-between gap-3 [&_h2]:mb-1 [&_h2]:mt-0.5 [&_h2]:text-2xl [&_h2]:font-extrabold [&_h2]:text-ink-strong [&_p]:m-0 [&_p]:text-[13px] [&_p]:text-ink-muted',
  topbarMeta: 'flex flex-wrap items-center gap-2',
  progress: 'h-2 overflow-hidden rounded-full bg-slate-400/20',
  progressFill: 'block h-full rounded-[inherit] transition-[width] duration-[220ms] ease-[var(--ease-std)]',
  stage: 'flex flex-1 min-h-[460px] cursor-pointer pb-[104px] max-[640px]:min-h-[380px] max-[640px]:pb-32',
  card: 'mx-auto flex min-h-full w-full max-w-[980px] flex-col justify-center border-0 bg-transparent px-8 py-[34px] shadow-none',
  group: 'flex flex-col gap-4',
  chip:
    'inline-flex items-center self-start rounded-full bg-[color-mix(in_srgb,var(--study-accent)_14%,white)] px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.08em] text-ink-strong dark:bg-[color-mix(in_srgb,var(--study-accent)_20%,rgba(255,255,255,0.04))] dark:text-[#eaf1ff]',
  title: 'm-0 text-[clamp(28px,4vw,42px)] leading-[1.08] text-ink-strong',
  introText: 'm-0 max-w-[900px] text-[clamp(17px,2.1vw,24px)] leading-[1.7] text-ink-medium',
  bulletList: 'mt-1 flex flex-col gap-3.5',
  bullet:
    'flex items-start gap-3 text-[clamp(17px,2vw,24px)] leading-[1.65] text-ink-strong animate-fadePop',
  bulletDot:
    'mt-3 size-[11px] shrink-0 rounded-full bg-[var(--study-accent)] shadow-[0_0_0_6px_color-mix(in_srgb,var(--study-accent)_14%,transparent)]',
  note:
    'flex flex-col gap-1.5 rounded-[18px] border border-slate-400/20 bg-white/60 px-[18px] py-4 animate-fadePop dark:border-slate-400/10 dark:bg-white/[0.04] [&_span]:text-base [&_span]:leading-[1.65] [&_span]:text-ink-strong [&_strong]:text-xs [&_strong]:font-bold [&_strong]:uppercase [&_strong]:tracking-[0.08em] [&_strong]:text-ink-soft',
  noteCallout: 'border-l-4 border-l-amber-500',
  noteMnemonic: 'border-l-4 border-l-violet-500',
  noteSticky: 'border-l-4 border-l-emerald-500',
  chipGrid: 'flex flex-wrap gap-3',
  keyChip:
    'inline-flex items-center rounded-[14px] bg-[color-mix(in_srgb,var(--study-accent)_15%,white)] px-4 py-2.5 text-[15px] font-bold leading-normal text-ink-strong animate-fadePop dark:bg-[color-mix(in_srgb,var(--study-accent)_16%,rgba(255,255,255,0.05))] dark:text-[#eaf1ff]',
  controls:
    'sticky bottom-0 z-[8] -mx-1.5 mt-0 flex flex-wrap items-center justify-center gap-3 border-t border-slate-400/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(255,255,255,0.96))] px-4 pb-[calc(14px_+_env(safe-area-inset-bottom,0px))] pt-3.5 backdrop-blur-[14px] dark:border-slate-400/10 dark:bg-[linear-gradient(180deg,rgba(0,0,0,0.72),rgba(0,0,0,0.96))] max-[640px]:justify-stretch [&_button]:min-w-[140px] max-[640px]:[&_button]:flex-[1_1_160px]',
};

function RichText({ text }) {
  if (!text) return null;
  const parts = [];
  let remaining = String(text);
  let key = 0;

  while (remaining.length > 0) {
    const hiStart = remaining.indexOf('==');
    const boldStart = remaining.indexOf('**');
    const next = Math.min(
      hiStart === -1 ? Infinity : hiStart,
      boldStart === -1 ? Infinity : boldStart,
    );

    if (next === Infinity) {
      parts.push(remaining);
      break;
    }

    if (next > 0) {
      parts.push(remaining.slice(0, next));
      remaining = remaining.slice(next);
      key += 1;
    }

    if (remaining.startsWith('==')) {
      const end = remaining.indexOf('==', 2);
      if (end === -1) {
        parts.push(remaining);
        break;
      }
      parts.push(<mark key={key += 1} className={studyUi.highlight}>{remaining.slice(2, end)}</mark>);
      remaining = remaining.slice(end + 2);
      continue;
    }

    const end = remaining.indexOf('**', 2);
    if (end === -1) {
      parts.push(remaining);
      break;
    }
    parts.push(<strong key={key += 1} className={studyUi.boldTerm}>{remaining.slice(2, end)}</strong>);
    remaining = remaining.slice(end + 2);
  }

  return <>{parts}</>;
}

function normalizeStudySlides(pages) {
  return (pages || []).flatMap((page, pageIndex) => {
    const slides = [];
    const pageLabel = `Page ${pageIndex + 1}`;

    slides.push({
      kind: 'intro',
      pageIndex,
      title: page.title || pageLabel,
      subtitle: page.subtitle || 'Study this page step by step.',
      revealSteps: 1,
    });

    (page.sections || []).forEach((section, sectionIndex) => {
      const extras = [section.callout, section.mnemonic, section.sticky_note].filter(Boolean).length;
      slides.push({
        kind: 'section',
        pageIndex,
        sectionIndex,
        title: section.heading || `Section ${sectionIndex + 1}`,
        bullets: section.bullets || [],
        callout: section.callout || '',
        mnemonic: section.mnemonic || '',
        stickyNote: section.sticky_note || '',
        revealSteps: Math.max(1, (section.bullets || []).length + extras),
      });
    });

    if (page.key_points?.length) {
      slides.push({
        kind: 'key_points',
        pageIndex,
        title: 'Key Exam Points',
        keyPoints: page.key_points || [],
        revealSteps: Math.max(1, page.key_points.length),
      });
    }

    if (page.summary_box) {
      slides.push({
        kind: 'summary',
        pageIndex,
        title: 'Summary',
        summary: page.summary_box,
        revealSteps: 1,
      });
    }

    return slides;
  });
}

export function StudyModePlayer({ pages = [], onFinish }) {
  const slides = useMemo(() => normalizeStudySlides(pages), [pages]);
  const [slideIndex, setSlideIndex] = useState(0);
  const [revealStep, setRevealStep] = useState(1);

  const slide = slides[slideIndex] || null;
  const slideAccent = STUDY_COLORS[(slide?.pageIndex || 0) % STUDY_COLORS.length];

  useEffect(() => {
    setSlideIndex(0);
    setRevealStep(1);
  }, [slides.length]);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'ArrowRight' || event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        handleNext();
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        handlePrevious();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  function openSlide(index, initialReveal = 1) {
    const bounded = Math.max(0, Math.min(index, slides.length - 1));
    setSlideIndex(bounded);
    setRevealStep(Math.max(1, initialReveal));
  }

  function handleNext() {
    if (!slide) return;
    if (revealStep < slide.revealSteps) {
      setRevealStep((current) => current + 1);
      return;
    }
    if (slideIndex < slides.length - 1) {
      openSlide(slideIndex + 1, 1);
      return;
    }
    onFinish?.();
  }

  function handlePrevious() {
    if (!slide) return;
    if (revealStep > 1) {
      setRevealStep((current) => current - 1);
      return;
    }
    if (slideIndex > 0) {
      const previousSlide = slides[slideIndex - 1];
      openSlide(slideIndex - 1, previousSlide?.revealSteps || 1);
    }
  }

  if (!slide) {
    return <div className={studyUi.empty}><h3>No study slides yet</h3><p>This lesson needs content before Study Mode can start.</p></div>;
  }

  const visibleBullets = slide.kind === 'section' ? slide.bullets.slice(0, revealStep) : [];
  const sectionBulletCount = slide.kind === 'section' ? slide.bullets.length : 0;
  const showCallout = slide.kind === 'section' && slide.callout && revealStep > sectionBulletCount;
  const showMnemonic = slide.kind === 'section' && slide.mnemonic && revealStep > sectionBulletCount + (slide.callout ? 1 : 0);
  const showSticky = slide.kind === 'section' && slide.stickyNote && revealStep > sectionBulletCount + (slide.callout ? 1 : 0) + (slide.mnemonic ? 1 : 0);
  const progressPercent = slides.length ? Math.round(((slideIndex + (revealStep / slide.revealSteps)) / slides.length) * 100) : 0;

  return (
    <div className={studyUi.shell}>
      <div className={studyUi.topbar}>
        <div>
          <span className={ui.eyebrow}>Study Mode</span>
          <h2>{slide.title}</h2>
          <p>Slide {slideIndex + 1} of {slides.length}</p>
        </div>
        <div className={studyUi.topbarMeta}>
          <span className={ui.tablePill}>Reveal {revealStep}/{slide.revealSteps}</span>
          <span className={ui.tablePill}>{progressPercent}%</span>
        </div>
      </div>

      <div className={studyUi.progress}>
        <span className={studyUi.progressFill} style={{ width: `${Math.max(6, progressPercent)}%`, background: slideAccent }} />
      </div>

      <div className={studyUi.stage} onClick={handleNext} role="button" tabIndex={0}>
        <div className={studyUi.card} style={{ '--study-accent': slideAccent }}>
          {slide.kind === 'intro' ? (
            <div className={studyUi.group}>
              <div className={studyUi.chip}>Page {(slide.pageIndex || 0) + 1}</div>
              <h3 className={studyUi.title}>{slide.title}</h3>
              <p className={studyUi.introText}>{slide.subtitle}</p>
            </div>
          ) : null}

          {slide.kind === 'section' ? (
            <div className={studyUi.group}>
              <div className={studyUi.chip}>Concept Focus</div>
              <h3 className={studyUi.title}>{slide.title}</h3>
              <div className={studyUi.bulletList}>
                {visibleBullets.map((bullet, index) => (
                  <div key={`${slide.title}-${index}`} className={studyUi.bullet}>
                    <span className={studyUi.bulletDot} />
                    <span><RichText text={bullet.startsWith('→') ? bullet.replace(/^→\s*/, '') : bullet} /></span>
                  </div>
                ))}
              </div>

              {showCallout ? (
                <div className={cx(studyUi.note, studyUi.noteCallout)}>
                  <strong>Exam Trap</strong>
                  <span><RichText text={slide.callout} /></span>
                </div>
              ) : null}

              {showMnemonic ? (
                <div className={cx(studyUi.note, studyUi.noteMnemonic)}>
                  <strong>Mnemonic</strong>
                  <span><RichText text={slide.mnemonic} /></span>
                </div>
              ) : null}

              {showSticky ? (
                <div className={cx(studyUi.note, studyUi.noteSticky)}>
                  <strong>Remember</strong>
                  <span><RichText text={slide.stickyNote} /></span>
                </div>
              ) : null}
            </div>
          ) : null}

          {slide.kind === 'key_points' ? (
            <div className={studyUi.group}>
              <div className={studyUi.chip}>Rapid Review</div>
              <h3 className={studyUi.title}>{slide.title}</h3>
              <div className={studyUi.chipGrid}>
                {slide.keyPoints.slice(0, revealStep).map((point, index) => (
                  <span key={`${slide.title}-kp-${index}`} className={studyUi.keyChip}>
                    <RichText text={point} />
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {slide.kind === 'summary' ? (
            <div className={studyUi.group}>
              <div className={studyUi.chip}>Wrap-Up</div>
              <h3 className={studyUi.title}>{slide.title}</h3>
              <p className={studyUi.introText}><RichText text={slide.summary} /></p>
            </div>
          ) : null}
        </div>
      </div>

      <div className={studyUi.controls}>
        <button type="button" className={ui.secondaryAction} onClick={handlePrevious} disabled={slideIndex === 0 && revealStep === 1}>
          Previous
        </button>
        <button className={ui.primaryAction} type="button" onClick={handleNext}>
          {slideIndex === slides.length - 1 && revealStep === slide.revealSteps ? 'Finish' : revealStep < slide.revealSteps ? 'Reveal next' : 'Next slide'}
        </button>
      </div>
    </div>
  );
}
