import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cx } from '../../../../shared/styles/tailwindClasses.js';

const recapCardClass =
  'quick-theory-recap overflow-hidden rounded-lg border border-line-medium bg-surface-elevated text-ink-strong shadow-card dark:border-white/10 dark:bg-[rgba(8,14,26,0.98)]';
const recapCardPaddedClass = cx(recapCardClass, 'px-[18px] py-4');
const recapHeaderClass = 'qtr-header flex items-center gap-2.5 px-3.5 py-3';
const recapHeaderButtonClass = cx(
  recapHeaderClass,
  'qtr-header--btn w-full cursor-pointer border-0 border-b border-line-medium bg-transparent text-left [font:inherit] text-inherit transition hover:bg-surface-2 dark:border-white/10 dark:hover:bg-white/[0.05]'
);
const recapIconClass = 'qtr-header__icon shrink-0 text-base';
const recapTitleClass = 'qtr-header__title m-0 text-[13.5px] font-semibold leading-[1.3] text-ink-strong';
const recapConceptClass = 'qtr-concept mt-px block text-[11.5px] font-medium text-ink-soft';
const recapEmptyTextClass = 'qtr-empty-text my-2 mb-2.5 text-[13px] leading-normal text-ink-muted';
const recapBodyClass = 'qtr-body flex flex-col gap-2.5 px-3.5 py-3';

const sectionToneClasses = {
  default: 'border-line-medium bg-surface-2',
  primary: 'border-brand-primary/25 bg-brand-primary-light',
  investigations: 'border-brand-accent/25 bg-brand-accent-light',
  treatment: 'border-brand-success/25 bg-[var(--color-success-light)]',
};

const recapScaleClasses = {
  sm: {
    item: 'text-[13px] leading-[1.55]',
    label: 'text-[12.5px]',
    title: 'text-[12.5px]',
  },
  md: {
    item: 'text-[14px] leading-[1.6]',
    label: 'text-xs',
    title: 'text-[15px]',
  },
  lg: {
    item: 'text-[15.5px] leading-[1.75]',
    label: 'text-[13px]',
    title: 'text-[15px]',
  },
};

const fontButtonClass = (active, sizeClass) =>
  cx(
    'qtr-font-tools__btn h-[30px] min-w-[38px] rounded-full border-0 bg-transparent font-extrabold text-ink-soft shadow-none transition hover:text-ink-strong max-[520px]:h-7 max-[520px]:min-w-8',
    sizeClass,
    active && 'is-active bg-brand-primary-light text-brand-primary'
  );

function normalizeRecapArray(value) {
  if (Array.isArray(value)) {
    return value.map(String).map((item) => item.trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map(String).map((item) => item.trim()).filter(Boolean);
      }
    } catch {
      // Fall back to line-based admin drafts.
    }

    return trimmed.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  }

  return [];
}

export function normalizeQuickTheoryRecap(recap) {
  if (!recap) return null;

  const hierarchy = recap.hierarchy || {};
  return {
    ...recap,
    conceptName: recap.conceptName || recap.concept_name || '',
    hierarchy: {
      course: hierarchy.course || recap.hierarchyCourse || recap.hierarchy_course || '',
      subject: hierarchy.subject || recap.hierarchySubject || recap.hierarchy_subject || '',
      topic: hierarchy.topic || recap.hierarchyTopic || recap.hierarchy_topic || '',
      lesson: hierarchy.lesson || recap.hierarchyLesson || recap.hierarchy_lesson || '',
    },
    etiology: normalizeRecapArray(recap.etiology),
    pathophysiology: normalizeRecapArray(recap.pathophysiology),
    clinicalFeatures: normalizeRecapArray(recap.clinicalFeatures || recap.clinical_features),
    investigations: normalizeRecapArray(recap.investigations),
    treatment: normalizeRecapArray(recap.treatment),
    keyPoints: normalizeRecapArray(recap.keyPoints || recap.key_points),
    mnemonic: String(recap.mnemonic || '').trim(),
  };
}

export function hasQuickTheoryRecapContent(recap) {
  const normalized = normalizeQuickTheoryRecap(recap);
  return Boolean(normalized && (
    normalized.etiology.length ||
    normalized.pathophysiology.length ||
    normalized.clinicalFeatures.length ||
    normalized.investigations.length ||
    normalized.treatment.length ||
    normalized.keyPoints.length ||
    normalized.mnemonic
  ));
}

function RecapSection({ icon, title, items, tone = 'default', scale = 'md' }) {
  if (!items || items.length === 0) return null;
  const scaleClass = recapScaleClasses[scale] || recapScaleClasses.md;
  return (
    <section className={cx('qtr-section rounded-md border px-3 py-2.5', sectionToneClasses[tone] || sectionToneClasses.default)}>
      <div className="qtr-section__head mb-2 flex items-center gap-1.5">
        <span className="qtr-section__icon text-[13px]" aria-hidden="true">{icon}</span>
        <h5 className={cx('qtr-section__title m-0 font-semibold uppercase tracking-[0.04em] text-ink-soft', scaleClass.label)}>{title}</h5>
      </div>
      <ul className="qtr-section__list m-0 flex list-disc flex-col gap-1.5 pl-[18px]">
        {items.map((item, index) => (
          <li
            className={cx('text-ink-strong [overflow-wrap:anywhere]', scaleClass.item)}
            key={`${index}-${item.slice(0, 12)}`}
          >
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

function RecapBreadcrumb({ hierarchy }) {
  const parts = [hierarchy.course, hierarchy.subject, hierarchy.topic, hierarchy.lesson].filter(Boolean);
  if (!parts.length) return null;
  return (
    <div className="qtr-breadcrumb flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[11px] font-medium text-ink-muted">
      {parts.map((part, index) => (
        <span key={`${index}-${part}`} className="qtr-breadcrumb__item flex items-center gap-1">
          {index > 0 && <span className="qtr-breadcrumb__sep text-ink-muted opacity-50" aria-hidden="true">›</span>}
          {part}
        </span>
      ))}
    </div>
  );
}

function RecapContent({ recap, context, revealed, scale = 'md' }) {
  const normalizedRecap = normalizeQuickTheoryRecap(recap);
  const scaleClass = recapScaleClasses[scale] || recapScaleClasses.md;
  const hasContent =
    normalizedRecap?.etiology.length ||
    normalizedRecap?.pathophysiology.length ||
    normalizedRecap?.clinicalFeatures.length ||
    normalizedRecap?.investigations.length ||
    normalizedRecap?.treatment.length ||
    normalizedRecap?.keyPoints.length ||
    normalizedRecap?.mnemonic;

  if (!hasContent) {
    return <p className={cx('qtr-empty-text my-2 mb-2.5 text-ink-muted', scaleClass.item)}>Recap content is pending.</p>;
  }

  return (
    <>
      {normalizedRecap.hierarchy && <RecapBreadcrumb hierarchy={normalizedRecap.hierarchy} />}

      {context === 'practice' && !revealed ? (
        <>
          <div className="qtr-hint-notice border-l-2 border-brand-primary/35 py-1.5 pl-3 text-xs font-semibold leading-relaxed text-ink-soft">
            Answer first to unlock the full recap. Key points stay visible as a hint.
          </div>
          <RecapSection icon="✦" title="Key Points" items={normalizedRecap.keyPoints} tone="primary" scale={scale} />
        </>
      ) : (
        <>
          <RecapSection icon="🧬" title="Etiology" items={normalizedRecap.etiology} scale={scale} />
          <RecapSection icon="⚙️" title="Pathophysiology" items={normalizedRecap.pathophysiology} scale={scale} />
          <RecapSection icon="🩺" title="Clinical Picture / Examination" items={normalizedRecap.clinicalFeatures} scale={scale} />
          <RecapSection icon="🔬" title="Investigations" items={normalizedRecap.investigations} tone="investigations" scale={scale} />
          <RecapSection icon="💊" title="Treatment" items={normalizedRecap.treatment} tone="treatment" scale={scale} />
          <RecapSection icon="📌" title="Key Points" items={normalizedRecap.keyPoints} tone="primary" scale={scale} />
          {normalizedRecap.mnemonic ? (
            <div className="qtr-mnemonic border-l-2 border-[color-mix(in_srgb,var(--color-warning)_42%,transparent)] py-1.5 pl-3 pr-1">
              <div className={cx('qtr-mnemonic__head mb-1.5 flex items-center gap-1.5 font-semibold uppercase tracking-[0.04em] text-ink-soft', scaleClass.label)}>
                <span aria-hidden="true">🧠</span>
                <strong>Mnemonic</strong>
              </div>
              <p className={cx('qtr-mnemonic__text m-0 italic text-ink-strong', scaleClass.item)}>{normalizedRecap.mnemonic}</p>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}

export function TheoryRecapPopupTrigger({ recap, context = 'review', revealed = true, onOpen = null }) {
  const [open, setOpen] = useState(false);
  const [fontScale, setFontScale] = useState('md');
  const normalizedRecap = normalizeQuickTheoryRecap(recap);
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const dragStateRef = useRef({
    active: false,
    startY: 0,
    startX: 0,
    pointerId: null,
    scroller: null,
    dragging: false,
  });

  function resetPopupDrag() {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.style.transform = '';
    dialog.style.opacity = '';
    dialog.style.transition = '';
  }

  function closePopup() {
    resetPopupDrag();
    setOpen(false);
  }

  function beginPopupDrag(target, x, y, pointerId, captureTarget = null) {
    if (!(target instanceof Element)) return;
    if (target.closest('button, a, input, textarea, select, [role="button"]')) return;

    const scroller = target.closest('.qtr-popup__scroller');
    if (!target.closest('.qtr-popup__drag-zone, .qtr-popup__head, .qtr-popup__body')) return;

    dragStateRef.current = {
      active: true,
      startY: y,
      startX: x,
      pointerId,
      scroller,
      dragging: false,
    };

    captureTarget?.setPointerCapture?.(pointerId);
  }

  function handlePopupPointerDown(e) {
    beginPopupDrag(e.target, e.clientX, e.clientY, e.pointerId, e.currentTarget);
  }

  function movePopupDrag(x, y, pointerId, preventDefault) {
    const state = dragStateRef.current;
    if (!state.active || state.pointerId !== pointerId) return;

    const deltaY = y - state.startY;
    const deltaX = Math.abs(x - state.startX);
    if (deltaY <= 0 || deltaX > deltaY * 1.4) return;
    if (state.scroller && state.scroller.scrollTop > 1) return;

    const dialog = dialogRef.current;
    if (!dialog) return;

    preventDefault?.();
    if (state.scroller) state.scroller.scrollTop = 0;

    if (!state.dragging) {
      state.dragging = true;
      dragStateRef.current = state;
      dialog.style.transition = 'none';
      dialog.dataset.dragging = 'true';
    }

    const clampedY = Math.min(deltaY, 220);
    dialog.style.transform = `translate3d(0, ${clampedY}px, 0)`;
    dialog.style.opacity = String(Math.max(0.72, 1 - clampedY / 380));
  }

  function handlePopupPointerMove(e) {
    movePopupDrag(e.clientX, e.clientY, e.pointerId, () => e.preventDefault());
  }

  function endPopupDrag(x, y, pointerId, releaseTarget = null) {
    const state = dragStateRef.current;
    if (!state.active || state.pointerId !== pointerId) return;

    dragStateRef.current = {
      active: false,
      startY: 0,
      startX: 0,
      pointerId: null,
      scroller: null,
      dragging: false,
    };

    releaseTarget?.releasePointerCapture?.(pointerId);

    const dialog = dialogRef.current;
    const deltaY = y - state.startY;
    if (!dialog) {
      if (deltaY > 86) closePopup();
      return;
    }

    dialog.style.transition = 'transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 180ms ease';
    delete dialog.dataset.dragging;

    const deltaX = Math.abs(x - state.startX);
    if (state.dragging && deltaY > 86 && deltaX <= deltaY * 1.4) {
      dialog.style.transform = 'translate3d(0, 110%, 0)';
      dialog.style.opacity = '0.88';
      window.setTimeout(() => setOpen(false), 120);
      return;
    }

    dialog.style.transform = '';
    dialog.style.opacity = '';
    window.setTimeout(() => {
      if (dialogRef.current === dialog) dialog.style.transition = '';
    }, 200);
  }

  function handlePopupPointerUp(e) {
    endPopupDrag(e.clientX, e.clientY, e.pointerId, e.currentTarget);
  }

  function handlePopupPointerCancel(e) {
    const state = dragStateRef.current;
    if (!state.active || state.pointerId !== e.pointerId) return;

    dragStateRef.current = {
      active: false,
      startY: 0,
      startX: 0,
      pointerId: null,
      scroller: null,
      dragging: false,
    };
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    resetPopupDrag();
  }

  function handlePopupTouchStart(e) {
    const touch = e.touches?.[0];
    if (!touch) return;
    beginPopupDrag(e.target, touch.clientX, touch.clientY, 'touch');
  }

  function handlePopupTouchMove(e) {
    const touch = e.touches?.[0];
    if (!touch) return;
    movePopupDrag(touch.clientX, touch.clientY, 'touch', () => {
      if (e.cancelable) e.preventDefault();
    });
  }

  function handlePopupTouchEnd(e) {
    const touch = e.changedTouches?.[0];
    if (!touch) return;
    endPopupDrag(touch.clientX, touch.clientY, 'touch');
  }

  function handlePopupTouchCancel() {
    const state = dragStateRef.current;
    if (!state.active || state.pointerId !== 'touch') return;
    dragStateRef.current = {
      active: false,
      startY: 0,
      startX: 0,
      pointerId: null,
      scroller: null,
      dragging: false,
    };
    resetPopupDrag();
  }

  useEffect(() => {
    if (!open) return undefined;
    const previousActive = document.activeElement;
    window.setTimeout(() => closeButtonRef.current?.focus(), 0);

    function onKey(e) {
      if (e.key === 'Escape') {
        closePopup();
        return;
      }

      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')]
        .filter((node) => !node.disabled && node.offsetParent !== null);
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (previousActive && typeof previousActive.focus === 'function') previousActive.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) resetPopupDrag();
  }, [open]);

  const hasRecap = hasQuickTheoryRecapContent(normalizedRecap);
  const popupScaleClass = recapScaleClasses[fontScale] || recapScaleClasses.md;

  return (
    <>
      <button className={cx(
          'qtr-popup-trigger flex w-full cursor-pointer items-start gap-2.5 rounded-md border border-brand-primary/25 bg-brand-primary-light px-3 py-2.5 text-left [font:inherit] text-ink-strong transition hover:border-brand-primary/45 hover:bg-[color-mix(in_srgb,var(--color-primary)_14%,var(--surface-elevated))] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-45 dark:border-brand-primary/25 dark:bg-brand-primary/12 dark:hover:bg-brand-primary/18 max-[520px]:gap-2.5',
          !hasRecap && 'qtr-popup-trigger--empty opacity-45'
        )}
        type="button"
       
        onClick={() => {
          if (!hasRecap) return;
          if (typeof onOpen === 'function') {
            onOpen();
          }
          setOpen(true);
        }}
        disabled={!hasRecap}
        title={hasRecap ? 'Open Quick Theory Recap' : 'No quick theory recap available'}
      >
        <span className="qtr-popup-trigger__icon mt-0.5 shrink-0 text-base text-brand-primary" aria-hidden="true">⚡</span>
        <span className="qtr-popup-trigger__copy grid min-w-0 flex-1 gap-0.5">
          <span className="qtr-popup-trigger__label min-w-0 whitespace-normal text-[13.5px] font-extrabold leading-snug text-ink-strong max-[520px]:text-[12.5px]">Quick theory recap</span>
          {normalizedRecap?.conceptName ? (
            <span className="qtr-popup-trigger__concept min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[11.5px] font-medium text-ink-soft max-[520px]:text-[10.5px]">{normalizedRecap.conceptName}</span>
          ) : null}
        </span>
      </button>

      {open ? createPortal(
        <div
          className="qtr-popup-backdrop fixed inset-0 z-[1200] flex items-center justify-center bg-[rgba(15,23,42,0.35)] p-5 backdrop-blur-[3px] animate-qtrBackdropIn dark:bg-[rgba(15,23,32,0.72)] max-[600px]:items-end max-[600px]:p-0"
          onClick={closePopup}
        >
          <div
            ref={dialogRef}
            className={cx(
              `qtr-popup qtr-popup--${fontScale}`,
              'flex h-[min(78dvh,720px)] max-h-[calc(100dvh-40px)] w-full max-w-[500px] touch-pan-y flex-col overflow-hidden rounded-xl border border-brand-primary/20 bg-surface-elevated text-ink-strong shadow-2xl animate-qtrPopupIn ring-1 ring-white/40 will-change-transform dark:border-white/10 dark:bg-[rgba(23,35,48,0.96)] dark:ring-white/10 max-[900px]:max-w-[540px] max-[600px]:h-[min(86dvh,760px)] max-[600px]:max-h-[calc(100dvh-var(--safe-top,0px)-10px)] max-[600px]:max-w-full max-[600px]:rounded-b-none max-[600px]:animate-qtrPopupSheetIn'
            )}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={handlePopupPointerDown}
            onPointerMove={handlePopupPointerMove}
            onPointerUp={handlePopupPointerUp}
            onPointerCancel={handlePopupPointerCancel}
            onTouchStart={handlePopupTouchStart}
            onTouchMove={handlePopupTouchMove}
            onTouchEnd={handlePopupTouchEnd}
            onTouchCancel={handlePopupTouchCancel}
            tabIndex={-1}
            aria-labelledby="qtr-popup-title"
            aria-modal="true"
            role="dialog"
          >
            <div className="qtr-popup__drag-zone hidden h-7 shrink-0 items-center justify-center bg-surface-elevated dark:bg-[rgba(10,18,31,0.98)] max-[600px]:flex" aria-hidden="true">
              <span className="h-1.5 w-11 rounded-full bg-slate-400/45 dark:bg-white/25" />
            </div>
            <div className="qtr-popup__head flex shrink-0 cursor-grab items-center justify-between gap-3 border-b border-line-soft bg-surface-elevated px-[18px] py-4 active:cursor-grabbing dark:border-white/10 dark:bg-[rgba(10,18,31,0.98)] max-[520px]:flex-col max-[520px]:items-stretch max-[520px]:gap-2.5 max-[520px]:px-4 max-[520px]:py-3">
              <div className="qtr-popup__head-left flex min-w-0 items-center gap-2.5 max-[520px]:w-full">
                <span className="qtr-popup__icon shrink-0 text-xl leading-none" aria-hidden="true">⚡</span>
                <div className="min-w-0">
                  <h3 className={cx('qtr-popup__title m-0 font-bold leading-[1.3] text-ink-strong', popupScaleClass.title)} id="qtr-popup-title">Quick Theory Recap</h3>
                  {normalizedRecap?.conceptName ? (
                    <span className="qtr-popup__concept mt-0.5 block overflow-hidden text-ellipsis whitespace-nowrap text-xs font-medium text-brand-primary">{normalizedRecap.conceptName}</span>
                  ) : null}
                </div>
              </div>
              <div className="qtr-popup__tools flex shrink-0 items-center gap-2.5 max-[520px]:w-full max-[520px]:justify-between max-[520px]:gap-1.5">
                <div className="qtr-font-tools inline-flex items-center gap-1.5 rounded-full border border-line-medium bg-surface-2 p-1 dark:border-white/10 dark:bg-white/[0.045] max-[520px]:min-w-0 max-[520px]:flex-1 max-[520px]:justify-between max-[520px]:gap-0.5" aria-label="Font size">
                  <button className={fontButtonClass(fontScale === 'sm', 'text-[11px]')}
                    type="button"
                   
                    onClick={() => setFontScale('sm')}
                    aria-label="Small text"
                  >
                    A
                  </button>
                  <button className={fontButtonClass(fontScale === 'md', 'text-[13px]')}
                    type="button"
                   
                    onClick={() => setFontScale('md')}
                    aria-label="Medium text"
                  >
                    AA
                  </button>
                  <button className={fontButtonClass(fontScale === 'lg', 'text-[15px]')}
                    type="button"
                   
                    onClick={() => setFontScale('lg')}
                    aria-label="Large text"
                  >
                    AAA
                  </button>
                </div>
                <button className="qtr-popup__close flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-sm border border-line-medium bg-surface-2 text-[13px] text-ink-medium transition hover:bg-surface-3 hover:text-ink-strong dark:border-white/10 dark:bg-white/[0.045] dark:hover:bg-white/[0.08]"
                  ref={closeButtonRef}
                  type="button"
                 
                  onClick={closePopup}
                  aria-label="Close theory recap"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="qtr-popup__body flex min-h-0 flex-1 flex-col bg-surface-elevated px-[18px] py-4 dark:bg-[rgba(8,14,26,0.98)] max-[520px]:px-3.5 max-[520px]:py-3">
              <div className="qtr-popup__scroller flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain pr-1 [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin]">
                <RecapContent recap={normalizedRecap} context={context} revealed={revealed} scale={fontScale} />
              </div>
            </div>
          </div>
        </div>,
        document.body
      ) : null}
    </>
  );
}

export function QuickTheoryRecap({ recap, context = 'review', revealed = true, generating = false, onGenerate = null }) {
  const [expanded, setExpanded] = useState(context === 'review');
  const normalizedRecap = normalizeQuickTheoryRecap(recap);

  if (generating) {
    return (
      <div className={cx(recapCardPaddedClass, 'quick-theory-recap--loading')}>
        <div className={cx(recapHeaderClass, 'px-0 py-0')}>
          <span className={recapIconClass} aria-hidden="true">⚡</span>
          <h4 className={recapTitleClass}>Quick Theory Recap</h4>
        </div>
        <div className="qtr-generating flex items-center gap-2.5 pb-0.5 pt-2.5 text-[13px] text-ink-soft">
          <div className="qtr-spinner size-4 shrink-0 animate-spin rounded-full border-2 border-line-medium border-t-brand-primary" aria-hidden="true" />
          <span>Generating theory recap…</span>
        </div>
      </div>
    );
  }

  if (!normalizedRecap) {
    return (
      <div className={cx(recapCardPaddedClass, 'quick-theory-recap--empty')}>
        <div className={cx(recapHeaderClass, 'px-0 py-0')}>
          <span className={recapIconClass} aria-hidden="true">⚡</span>
          <h4 className={recapTitleClass}>Quick Theory Recap</h4>
        </div>
        <p className={recapEmptyTextClass}>No theory recap available for this question.</p>
        {onGenerate ? (
          <button type="button" className="qtr-generate-btn rounded-sm border border-line-medium bg-surface-1 px-3.5 py-1.5 text-[12.5px] text-ink-soft transition hover:bg-surface-2 hover:text-ink-strong" onClick={onGenerate}>
            Generate recap
          </button>
        ) : null}
      </div>
    );
  }

  const hasContent =
    normalizedRecap.etiology.length ||
    normalizedRecap.pathophysiology.length ||
    normalizedRecap.clinicalFeatures.length ||
    normalizedRecap.investigations.length ||
    normalizedRecap.treatment.length ||
    normalizedRecap.keyPoints.length ||
    normalizedRecap.mnemonic;

  if (!hasContent) {
    return (
      <div className={cx(recapCardPaddedClass, 'quick-theory-recap--empty')}>
        <div className={cx(recapHeaderClass, 'px-0 py-0')}>
          <span className={recapIconClass} aria-hidden="true">⚡</span>
          <h4 className={recapTitleClass}>Quick Theory Recap</h4>
          {normalizedRecap.conceptName ? <span className={recapConceptClass}>{normalizedRecap.conceptName}</span> : null}
        </div>
        <p className={recapEmptyTextClass}>Recap content is pending.</p>
      </div>
    );
  }

  const isPracticeCollapsed = context === 'practice' && !revealed && !expanded;

  return (
    <div className={cx(recapCardClass, isPracticeCollapsed && 'quick-theory-recap--collapsed')}>
      <button className={recapHeaderButtonClass}
        type="button"
       
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={!isPracticeCollapsed && expanded}
      >
        <span className={recapIconClass} aria-hidden="true">⚡</span>
        <div className="qtr-header__text min-w-0 flex-1">
          <h4 className={recapTitleClass}>Quick Theory Recap</h4>
          {normalizedRecap.conceptName ? <span className={recapConceptClass}>{normalizedRecap.conceptName}</span> : null}
        </div>
        <span className="qtr-header__chevron shrink-0 text-[10px] text-ink-muted" aria-hidden="true">
          {expanded ? '▲' : '▼'}
        </span>
      </button>

      {expanded ? (
        <div className={recapBodyClass}>
          <RecapContent recap={normalizedRecap} context={context} revealed={revealed} />
        </div>
      ) : null}
    </div>
  );
}
