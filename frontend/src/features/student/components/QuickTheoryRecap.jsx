import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cx } from '../../../styles/tailwindClasses.js';

const recapCardClass =
  'quick-theory-recap overflow-hidden rounded-lg border border-line-medium bg-surface-elevated shadow-card';
const recapCardPaddedClass = cx(recapCardClass, 'px-[18px] py-4');
const recapHeaderClass = 'qtr-header flex items-center gap-2.5 px-4 py-3';
const recapHeaderButtonClass = cx(
  recapHeaderClass,
  'qtr-header--btn w-full cursor-pointer border-0 border-b border-line-medium bg-transparent text-left [font:inherit] text-inherit transition hover:bg-surface-2'
);
const recapIconClass = 'qtr-header__icon shrink-0 text-base';
const recapTitleClass = 'qtr-header__title m-0 text-[13.5px] font-semibold leading-[1.3] text-ink-strong';
const recapConceptClass = 'qtr-concept mt-px block text-[11.5px] font-medium text-ink-soft';
const recapEmptyTextClass = 'qtr-empty-text my-2 mb-2.5 text-[13px] leading-normal text-ink-muted';
const recapBodyClass = 'qtr-body flex flex-col gap-3 px-4 py-3.5';

const sectionToneClasses = {
  default: 'border-line-medium bg-surface-2',
  primary: 'border-brand-primary/25 bg-brand-primary-light',
  investigations: 'border-brand-accent/25 bg-brand-accent-light',
  treatment: 'border-brand-success/25 bg-[var(--color-success-light)]',
};

const recapScaleClasses = {
  sm: {
    item: 'text-[12.5px] leading-[1.45]',
    label: 'text-[12.5px]',
    title: 'text-[12.5px]',
  },
  md: {
    item: 'text-[13px] leading-normal',
    label: 'text-xs',
    title: 'text-[15px]',
  },
  lg: {
    item: 'text-[15px] leading-[1.7]',
    label: 'text-[13px]',
    title: 'text-[15px]',
  },
};

const fontButtonClass = (active, sizeClass) =>
  cx(
    'qtr-font-tools__btn h-[30px] min-w-[38px] rounded-full border-0 bg-transparent font-extrabold text-ink-soft shadow-none transition hover:text-ink-strong',
    sizeClass,
    active && 'is-active bg-brand-primary-light text-brand-primary'
  );

function RecapSection({ icon, title, items, tone = 'default', scale = 'md' }) {
  if (!items || items.length === 0) return null;
  const scaleClass = recapScaleClasses[scale] || recapScaleClasses.md;
  return (
    <div className={cx('qtr-section rounded-md border p-2.5 px-3', sectionToneClasses[tone] || sectionToneClasses.default)}>
      <div className="qtr-section__head mb-[7px] flex items-center gap-1.5">
        <span className="qtr-section__icon text-[13px]" aria-hidden="true">{icon}</span>
        <h5 className={cx('qtr-section__title m-0 font-semibold uppercase tracking-[0.04em] text-ink-soft', scaleClass.label)}>{title}</h5>
      </div>
      <ul className="qtr-section__list m-0 flex list-disc flex-col gap-1 pl-[18px]">
        {items.map((item, index) => (
          <li className={cx('text-ink-strong', scaleClass.item)} key={`${index}-${item.slice(0, 12)}`}>{item}</li>
        ))}
      </ul>
    </div>
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
  const scaleClass = recapScaleClasses[scale] || recapScaleClasses.md;
  const hasContent =
    recap.etiology?.length ||
    recap.pathophysiology?.length ||
    recap.clinicalFeatures?.length ||
    recap.investigations?.length ||
    recap.treatment?.length ||
    recap.keyPoints?.length ||
    recap.mnemonic;

  if (!hasContent) {
    return <p className={cx('qtr-empty-text my-2 mb-2.5 text-ink-muted', scaleClass.item)}>Recap content is pending.</p>;
  }

  return (
    <>
      {recap.hierarchy && <RecapBreadcrumb hierarchy={recap.hierarchy} />}

      {context === 'practice' && !revealed ? (
        <>
          <div className="qtr-hint-notice flex items-center gap-1.5 rounded-sm border border-line-medium bg-surface-2 px-2.5 py-[7px] text-xs text-ink-soft">
            <span>💡</span> Theory hint — answer first to see full recap
          </div>
          <RecapSection icon="✦" title="Key Points" items={recap.keyPoints} tone="primary" scale={scale} />
        </>
      ) : (
        <>
          <RecapSection icon="🧬" title="Etiology" items={recap.etiology} scale={scale} />
          <RecapSection icon="⚙️" title="Pathophysiology" items={recap.pathophysiology} scale={scale} />
          <RecapSection icon="🩺" title="Clinical Picture / Examination" items={recap.clinicalFeatures} scale={scale} />
          <RecapSection icon="🔬" title="Investigations" items={recap.investigations} tone="investigations" scale={scale} />
          <RecapSection icon="💊" title="Treatment" items={recap.treatment} tone="treatment" scale={scale} />
          <RecapSection icon="📌" title="Key Points" items={recap.keyPoints} tone="primary" scale={scale} />
          {recap.mnemonic ? (
            <div className="qtr-mnemonic rounded-md border border-[color-mix(in_srgb,var(--color-warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-warning)_9%,var(--surface-elevated))] px-3 py-2.5">
              <div className={cx('qtr-mnemonic__head mb-1.5 flex items-center gap-1.5 font-semibold uppercase tracking-[0.04em] text-ink-soft', scaleClass.label)}>
                <span aria-hidden="true">🧠</span>
                <strong>Mnemonic</strong>
              </div>
              <p className={cx('qtr-mnemonic__text m-0 italic text-ink-strong', scaleClass.item)}>{recap.mnemonic}</p>
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
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const previousActive = document.activeElement;
    window.setTimeout(() => closeButtonRef.current?.focus(), 0);

    function onKey(e) {
      if (e.key === 'Escape') {
        setOpen(false);
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

  const hasRecap = recap && (
    recap.etiology?.length ||
    recap.pathophysiology?.length ||
    recap.clinicalFeatures?.length ||
    recap.investigations?.length ||
    recap.treatment?.length ||
    recap.keyPoints?.length ||
    recap.mnemonic
  );
  const popupScaleClass = recapScaleClasses[fontScale] || recapScaleClasses.md;

  return (
    <>
      <button className={cx(
          'qtr-popup-trigger flex w-full cursor-pointer items-center gap-2 rounded-md border border-brand-primary/25 bg-brand-primary-light px-3.5 py-2.5 text-left [font:inherit] text-ink-strong transition hover:border-brand-primary/45 hover:bg-[color-mix(in_srgb,var(--color-primary)_14%,var(--surface-elevated))] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-45',
          !hasRecap && 'qtr-popup-trigger--empty opacity-45'
        )}
        type="button"
       
        onClick={() => {
          if (!hasRecap) return;
          if (typeof onOpen === 'function') {
            onOpen();
            return;
          }
          setOpen(true);
        }}
        disabled={!hasRecap}
        title={hasRecap ? 'Open Quick Theory Recap' : 'No quick theory recap available'}
      >
        <span className="qtr-popup-trigger__icon shrink-0 text-base text-brand-primary" aria-hidden="true">⚡</span>
        <span className="qtr-popup-trigger__label flex-1 text-[13.5px] font-semibold text-ink-strong">Quick Theory Recap</span>
        {recap?.conceptName ? (
          <span className="qtr-popup-trigger__concept max-w-[140px] overflow-hidden text-ellipsis whitespace-nowrap text-[11.5px] font-medium text-ink-soft">{recap.conceptName}</span>
        ) : null}
      </button>

      {open ? createPortal(
        <div
          className="qtr-popup-backdrop fixed inset-0 z-[1200] flex items-center justify-center bg-[rgba(15,23,42,0.35)] p-5 backdrop-blur-[3px] animate-qtrBackdropIn dark:bg-[rgba(0,0,0,0.55)] max-[600px]:items-end max-[600px]:p-0"
          onClick={() => setOpen(false)}
        >
          <div
            ref={dialogRef}
            className={cx(
              `qtr-popup qtr-popup--${fontScale}`,
              'flex h-[min(78vh,720px)] max-h-[calc(100vh-40px)] w-full max-w-[500px] flex-col overflow-hidden rounded-xl border border-brand-primary/20 bg-surface-elevated text-ink-strong shadow-2xl animate-qtrPopupIn ring-1 ring-white/40 max-[900px]:max-w-[540px] max-[600px]:h-[min(85vh,760px)] max-[600px]:max-h-[85vh] max-[600px]:max-w-full max-[600px]:rounded-b-none max-[600px]:animate-qtrPopupSheetIn'
            )}
            onClick={(e) => e.stopPropagation()}
            tabIndex={-1}
            aria-labelledby="qtr-popup-title"
            aria-modal="true"
            role="dialog"
          >
            <div className="qtr-popup__head flex shrink-0 items-center justify-between gap-3 border-b border-line-soft bg-surface-elevated px-[18px] py-4">
              <div className="qtr-popup__head-left flex min-w-0 items-center gap-2.5">
                <span className="qtr-popup__icon shrink-0 text-xl leading-none" aria-hidden="true">⚡</span>
                <div>
                  <h3 className={cx('qtr-popup__title m-0 font-bold leading-[1.3] text-ink-strong', popupScaleClass.title)} id="qtr-popup-title">Quick Theory Recap</h3>
                  {recap.conceptName ? (
                    <span className="qtr-popup__concept mt-0.5 block text-xs font-medium text-brand-primary">{recap.conceptName}</span>
                  ) : null}
                </div>
              </div>
              <div className="qtr-popup__tools flex shrink-0 items-center gap-2.5">
                <div className="qtr-font-tools inline-flex items-center gap-1.5 rounded-full border border-line-medium bg-surface-2 p-1" aria-label="Font size">
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
                <button className="qtr-popup__close flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-sm border border-line-medium bg-surface-2 text-[13px] text-ink-medium transition hover:bg-surface-3 hover:text-ink-strong"
                  ref={closeButtonRef}
                  type="button"
                 
                  onClick={() => setOpen(false)}
                  aria-label="Close theory recap"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="qtr-popup__body flex min-h-0 flex-1 flex-col bg-surface-elevated px-[18px] py-4">
              <div className="qtr-popup__scroller flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain pr-1 [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin]">
                <RecapContent recap={recap} context={context} revealed={revealed} scale={fontScale} />
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

  if (!recap) {
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
    recap.etiology?.length ||
    recap.pathophysiology?.length ||
    recap.clinicalFeatures?.length ||
    recap.investigations?.length ||
    recap.treatment?.length ||
    recap.keyPoints?.length ||
    recap.mnemonic;

  if (!hasContent) {
    return (
      <div className={cx(recapCardPaddedClass, 'quick-theory-recap--empty')}>
        <div className={cx(recapHeaderClass, 'px-0 py-0')}>
          <span className={recapIconClass} aria-hidden="true">⚡</span>
          <h4 className={recapTitleClass}>Quick Theory Recap</h4>
          {recap.conceptName ? <span className={recapConceptClass}>{recap.conceptName}</span> : null}
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
          {recap.conceptName ? <span className={recapConceptClass}>{recap.conceptName}</span> : null}
        </div>
        <span className="qtr-header__chevron shrink-0 text-[10px] text-ink-muted" aria-hidden="true">
          {expanded ? '▲' : '▼'}
        </span>
      </button>

      {expanded ? (
        <div className={recapBodyClass}>
          <RecapContent recap={recap} context={context} revealed={revealed} />
        </div>
      ) : null}
    </div>
  );
}
