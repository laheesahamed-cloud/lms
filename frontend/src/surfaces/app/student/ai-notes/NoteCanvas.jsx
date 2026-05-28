import { forwardRef, memo, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useThemeStore } from '../../../../shared/stores/themeStore.js';
import { cx, ui } from '../../../../shared/styles/tailwindClasses.js';

if (typeof document !== 'undefined' && !document.getElementById('canvas-hand-font')) {
  const lnk = document.createElement('link');
  lnk.id = 'canvas-hand-font';
  lnk.rel = 'stylesheet';
  lnk.href = 'https://fonts.googleapis.com/css2?family=Patrick+Hand&family=Plus+Jakarta+Sans:wght@400;600;700;800;900&display=swap';
  document.head.appendChild(lnk);
}
if (typeof document !== 'undefined' && !document.getElementById('canvas-study-styles')) {
  const sty = document.createElement('style');
  sty.id = 'canvas-study-styles';
  sty.textContent = [
    '@keyframes ncvCardIn{from{opacity:0;transform:translateY(18px) scale(0.975)}to{opacity:1;transform:translateY(0) scale(1)}}',
    '@keyframes ncvLightboxBackdropIn{from{opacity:0}to{opacity:1}}',
    '@keyframes ncvLightboxPanelIn{from{opacity:0;transform:translateY(12px) scale(0.985)}to{opacity:1;transform:translateY(0) scale(1)}}',
    '.ncv-enter{opacity:0!important}',
    '.ncv-entered{animation:ncvCardIn 0.48s cubic-bezier(0.22,1,0.36,1) both}',
    '.ncv-lightbox-backdrop{animation:ncvLightboxBackdropIn 0.18s cubic-bezier(0.22,1,0.36,1) both}',
    '.ncv-lightbox-panel{animation:ncvLightboxPanelIn 0.22s cubic-bezier(0.22,1,0.36,1) both}',
    '.focus-canvas .ncv-item{transition:opacity 0.2s ease,transform 0.2s ease,box-shadow 0.2s ease;opacity:0.3}',
    '.focus-canvas .ncv-item:hover{opacity:1!important;transform:translateY(-3px) scale(1.014);z-index:12;position:relative}',
    '@media (prefers-reduced-motion: reduce){.ncv-entered,.ncv-lightbox-backdrop,.ncv-lightbox-panel{animation:none!important}.focus-canvas .ncv-item{transition:none!important}}',
  ].join('');
  document.head.appendChild(sty);
}

const noteCanvasUi = {
  highlight:
    'break-words rounded-[3px] px-1 font-semibold not-italic text-slate-700 dark:text-white',
  boldTerm: 'break-words font-bold text-blue-700 dark:text-[#ff8a80]',
  editInput:
    "block w-full rounded-[5px] border border-transparent bg-transparent px-0.5 py-px font-['Patrick_Hand',cursive] text-[inherit] leading-[inherit] text-[inherit] shadow-none outline-none transition placeholder:opacity-45 hover:border-indigo-500/10 hover:bg-white/20 focus:border-indigo-500/25 focus:bg-white/28 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.08)] dark:hover:border-indigo-300/10 dark:hover:bg-white/[0.025] dark:focus:border-indigo-300/20 dark:focus:bg-white/[0.045]",
  editArea:
    "block min-h-0 w-full resize-none rounded-[7px] border border-transparent bg-transparent px-0.5 py-px font-['Patrick_Hand',cursive] text-[inherit] leading-[1.6] text-[inherit] shadow-none outline-none transition placeholder:opacity-45 hover:border-indigo-500/10 hover:bg-white/20 focus:border-indigo-500/25 focus:bg-white/28 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.08)] dark:hover:border-indigo-300/10 dark:hover:bg-white/[0.025] dark:focus:border-indigo-300/20 dark:focus:bg-white/[0.045]",
  editHint:
    "mb-1 pl-0.5 font-['Plus_Jakarta_Sans',sans-serif] text-[9.5px] tracking-[0.2px] opacity-45",
  bullets: 'm-0 mb-2 flex list-none flex-col gap-[5px] p-0',
  bullet:
    "min-w-0 flex items-start gap-2 break-words font-['Patrick_Hand',cursive] text-[14.5px] leading-[1.58] text-slate-700 dark:text-[#c8d4f0] max-[520px]:text-[15px]",
  subBullet: 'pl-[18px] text-[13.5px] opacity-90 dark:opacity-100 dark:text-[#b8caf0] max-[520px]:text-[14px]',
  subArrow: 'mt-0.5 shrink-0 text-xs opacity-75 dark:opacity-100',
  bulletDot: 'mt-[5px] size-[7px] shrink-0 rounded-full dark:shadow-[0_0_6px_currentColor]',
  summaryFrags: 'flex flex-wrap items-center gap-2',
  summaryFrag:
    "min-w-0 max-w-full break-words rounded-md border border-blue-700/15 bg-blue-700/[0.08] px-2.5 py-1 font-['Patrick_Hand',cursive] text-[13px] leading-[1.5] text-[#1e3a5f] dark:border-white/10 dark:bg-white/[0.06] dark:text-[rgba(220,230,255,0.92)]",
  wrapOuter: 'relative',
  canvas:
    "relative mx-auto w-full max-w-[1120px] overflow-hidden rounded-[22px] border border-[#eadfce] bg-[#fffdf8] bg-[radial-gradient(circle,rgba(87,69,39,0.055)_1.2px,transparent_1.2px)] bg-[length:22px_22px] font-['Patrick_Hand',cursive] text-[#3b465f] shadow-[0_14px_38px_rgba(91,64,35,0.10),0_2px_8px_rgba(15,23,42,0.04)] dark:border-white/10 dark:bg-[#0d0f1a] dark:bg-[radial-gradient(circle,rgba(255,255,255,0.055)_1.2px,transparent_1.2px)] dark:text-[#dce6ff] dark:shadow-[0_8px_40px_rgba(0,0,0,0.55),0_2px_8px_rgba(0,0,0,0.35),0_0_0_1px_rgba(255,255,255,0.05)] max-[640px]:max-w-none max-[640px]:rounded-none max-[640px]:border-0 max-[640px]:shadow-none max-[640px]:dark:shadow-none print:max-w-full print:rounded-none print:shadow-none",
  editable: '!overflow-visible',
  overviewWrap: 'relative z-[4] flex justify-center',
  overviewBadge:
    "rounded-b-xl bg-[#d9c7ee] px-7 py-1 font-['Plus_Jakarta_Sans',sans-serif] text-[12px] font-extrabold uppercase tracking-[0.08em] text-[#4b2d71] shadow-[0_2px_8px_rgba(76,45,113,0.10)] dark:bg-violet-400/25 dark:text-violet-100",
  header:
    'relative z-[3] mx-5 mb-2 mt-4 min-w-0 overflow-hidden rounded-[20px] border border-[#eadfce] bg-[radial-gradient(circle_at_100%_0%,rgba(59,130,246,0.10),transparent_34%),radial-gradient(circle_at_0%_100%,rgba(16,185,129,0.10),transparent_38%),radial-gradient(circle,rgba(87,69,39,0.045)_1px,transparent_1px),rgba(255,255,255,0.82)] bg-[length:auto,auto,18px_18px,auto] px-5 py-4 shadow-[0_10px_30px_rgba(91,64,35,0.09),0_2px_8px_rgba(15,23,42,0.04)] backdrop-blur-sm dark:border-white/10 dark:bg-[radial-gradient(circle_at_100%_0%,rgba(96,165,250,0.14),transparent_34%),radial-gradient(circle_at_0%_100%,rgba(52,211,153,0.10),transparent_38%),radial-gradient(circle,rgba(255,255,255,0.055)_1px,transparent_1px),rgba(255,255,255,0.055)] max-[520px]:mx-2 max-[520px]:px-2.5 max-[520px]:py-3',
  headerInner: 'relative flex items-center justify-between gap-4 max-[720px]:items-start max-[720px]:flex-col',
  titleCluster: 'min-w-0 flex-1',
  titleRow: 'flex min-w-0 flex-wrap items-center gap-2.5',
  leafMark:
    'inline-flex size-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-100/75 text-[25px] shadow-[0_8px_18px_rgba(16,185,129,0.12)] dark:border-emerald-300/20 dark:bg-emerald-300/10',
  title:
    "m-0 min-w-0 flex-1 break-words font-['Patrick_Hand',cursive] text-[38px] font-bold leading-[1.05] text-slate-700 dark:text-[#f0f4ff] dark:[text-shadow:0_0_26px_rgba(160,180,255,0.16)] max-[520px]:w-full max-[520px]:text-[30px]",
  titleReadOnly:
    "flex w-full items-center justify-center bg-transparent px-0 py-0 text-center font-['Patrick_Hand',cursive] text-[42px] font-bold leading-[1.02] text-slate-700 shadow-none dark:text-[#f5f8ff] max-[520px]:text-[34px]",
  titleMedicalIcon:
    'flex size-12 shrink-0 items-center justify-center rounded-2xl border border-sky-300/22 bg-sky-300/10 text-sky-200 shadow-[0_0_18px_rgba(96,165,250,0.18)] max-[520px]:size-9 max-[520px]:rounded-xl [&_svg]:size-7 max-[520px]:[&_svg]:size-5',
  subtitle:
    "m-0 inline-flex max-w-full rounded-lg border border-emerald-500/20 bg-emerald-100/70 px-3 py-1 font-['Plus_Jakarta_Sans',sans-serif] text-[12px] font-bold leading-snug text-emerald-800 dark:border-emerald-300/20 dark:bg-emerald-300/10 dark:text-emerald-100 max-[520px]:w-full max-[520px]:break-words",
  metaStack:
    "flex min-w-0 flex-col items-end gap-1.5 font-['Plus_Jakarta_Sans',sans-serif] text-[12px] font-semibold text-slate-700 dark:text-slate-200 max-[720px]:w-full max-[720px]:items-start",
  metaItem: 'flex min-w-0 items-center gap-2',
  metaIcon: 'inline-flex size-5 items-center justify-center rounded-md border border-slate-300/70 bg-white/70 text-[11px] dark:border-white/10 dark:bg-white/[0.06]',
  tagRow: 'flex flex-wrap gap-1.5',
  tag:
    'rounded-full border border-blue-500/15 bg-blue-50/80 px-2 py-0.5 text-[11px] font-bold text-blue-700 dark:border-blue-300/15 dark:bg-blue-300/10 dark:text-blue-100',
  sectionGrid: 'grid min-w-0 grid-cols-2 gap-0.5 px-5 py-2 max-[640px]:grid-cols-1 max-[520px]:px-2',
  sectionGridOne: '!grid-cols-1 [&>*]:col-span-1',
  section:
    'group/canvas-card relative min-w-0 break-inside-avoid overflow-hidden rounded-[14px] border border-[#eadfce] bg-white/[0.72] shadow-[0_2px_10px_rgba(91,64,35,0.055)] hover:-translate-y-[3px] hover:shadow-[0_8px_24px_rgba(91,64,35,0.12),0_2px_8px_rgba(15,23,42,0.04)] transition-[transform,box-shadow] duration-200 dark:border-white/10 dark:bg-white/[0.045] dark:shadow-[0_2px_12px_rgba(2,6,12,0.35)] dark:hover:shadow-[0_8px_32px_rgba(2,6,12,0.58),0_2px_8px_rgba(2,6,12,0.28)] dark:backdrop-blur',
  cardMedicalIcon:
    'pointer-events-none absolute right-2.5 top-2.5 z-[4] flex size-7 items-center justify-center rounded-full border bg-white/42 opacity-65 shadow-[0_4px_12px_rgba(15,23,42,0.08)] dark:bg-slate-950/20 max-[520px]:right-2 max-[520px]:top-2 max-[520px]:size-6 [&_svg]:size-[16px] max-[520px]:[&_svg]:size-[14px]',
  imageSection: '',
  imageFull: 'col-span-full',
  imageExplained: 'overflow-visible',
  sectionActions:
    'absolute right-2 top-2 z-20 flex items-center justify-between gap-1 rounded-xl border border-black/10 bg-white/72 px-1.5 py-1 opacity-0 shadow-[0_8px_22px_rgba(15,23,42,0.10)] backdrop-blur-md transition group-hover/canvas-card:opacity-100 focus-within:opacity-100 dark:border-white/10 dark:bg-slate-950/62',
  sectionButton:
    'inline-flex size-6 cursor-pointer items-center justify-center rounded-md border border-black/10 bg-white/78 p-0 text-[11px] font-semibold text-ink-medium transition disabled:cursor-default disabled:opacity-35 hover:not-disabled:bg-[color-mix(in_srgb,var(--color-primary)_10%,#fff)] hover:not-disabled:text-primary dark:border-white/10 dark:bg-white/[0.08] dark:text-white/70',
  sectionButtonOn:
    '!border-[color-mix(in_srgb,var(--color-primary,#2563eb)_28%,transparent)] !bg-[color-mix(in_srgb,var(--color-primary,#2563eb)_14%,#fff)] !text-primary',
  sectionDeleteButton: '!border-red-500/25 !bg-red-50 !text-red-500 hover:!bg-red-100',
  colorSwatchButton: '!size-6 !rounded-md !border-2 !border-black/15',
  fontColorButton:
    '!relative !size-6 !overflow-hidden !rounded-md !border !border-black/10 !bg-white !text-[13px] !font-extrabold',
  resizeHandle:
    'absolute inset-x-0 bottom-0 flex h-3 cursor-ns-resize select-none items-center justify-center rounded-b-md bg-[linear-gradient(to_top,rgba(99,102,241,0.14),transparent)] opacity-0 touch-none transition group-hover/canvas-card:opacity-100 hover:bg-[linear-gradient(to_top,rgba(99,102,241,0.38),transparent)] [&_span]:block [&_span]:h-[3px] [&_span]:w-8 [&_span]:rounded-sm [&_span]:bg-white/70',
  imageOpenButton:
    'group/image relative block w-full cursor-zoom-in overflow-hidden border-0 bg-transparent p-0 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500',
  imageExpandHint:
    'pointer-events-none absolute right-2 top-2 z-10 inline-flex size-8 items-center justify-center rounded-full border border-white/25 bg-slate-950/50 text-white/92 opacity-80 shadow-[0_6px_18px_rgba(0,0,0,0.22)] backdrop-blur-md transition group-hover/image:scale-105 group-hover/image:opacity-100 dark:border-white/18 dark:bg-slate-950/62 max-[520px]:size-7 [&_svg]:size-4 max-[520px]:[&_svg]:size-3.5',
  imageOpenHint:
    'pointer-events-none absolute left-2 top-2 z-10 inline-flex translate-y-1 items-center gap-1 rounded-full border border-white/20 bg-slate-950/54 px-2 py-1 font-sans text-[10px] font-extrabold uppercase tracking-[0.05em] text-white opacity-0 shadow-sm backdrop-blur-md transition group-hover/image:translate-y-0 group-hover/image:opacity-100 group-focus-visible/image:translate-y-0 group-focus-visible/image:opacity-100',
  imageFitBar:
    'mx-2.5 mt-2 flex flex-wrap items-center justify-between gap-2 font-sans',
  imageFitOverlay:
    'absolute bottom-2 left-2 z-20 m-0 max-w-[calc(100%-92px)] rounded-xl border border-white/20 bg-slate-950/58 p-1 shadow-sm backdrop-blur-md opacity-0 transition group-hover/canvas-card:opacity-100 focus-within:opacity-100',
  imageFitLabel:
    'text-[10px] font-extrabold uppercase tracking-[0.08em] text-ink-muted',
  imageFitLabelOverlay:
    'sr-only',
  imageFitToggle:
    'inline-flex overflow-hidden rounded-lg border border-line-soft bg-surface-glass p-0.5 dark:border-white/10 dark:bg-white/[0.04]',
  imageFitToggleOverlay:
    'border-white/15 bg-white/10',
  imageFitButton:
    'min-h-[26px] cursor-pointer rounded-md px-2.5 font-sans text-[10.5px] font-extrabold text-ink-muted transition hover:bg-surface-raised hover:text-ink-strong active:scale-[0.97] dark:hover:bg-white/[0.08] dark:hover:text-white',
  imageFitButtonOverlay:
    'min-h-[24px] px-2 text-white/74 hover:bg-white/12 hover:text-white',
  imageFitButtonOn:
    '!bg-primary !text-white shadow-sm dark:!bg-sky-400 dark:!text-slate-700',
  imagePlaceholder:
    'flex cursor-pointer flex-col items-center justify-center gap-2.5 rounded-md border-2 border-dashed border-indigo-500/30 bg-[color-mix(in_srgb,var(--color-primary,#2563eb)_5%,var(--surface-2,#f8fafc))] font-sans text-[13px] text-ink-muted transition hover:bg-[color-mix(in_srgb,var(--color-primary,#2563eb)_10%,var(--surface-2,#f8fafc))]',
  imageCaption: 'mx-2.5 mb-2 mt-1.5 text-center font-sans text-xs italic text-ink-muted',
  imageSizePill:
    'absolute bottom-2 right-2 z-10 rounded-full border border-black/10 bg-white/90 px-2 py-0.5 font-sans text-[10px] font-extrabold text-slate-600 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-950/75 dark:text-slate-200',
  imgExplainedBody: 'flex flex-col gap-2.5 px-3.5 pb-3.5 pt-3',
  imgExplainedHead: 'flex flex-wrap items-center gap-2',
  imgFigureTag:
    'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 pl-1.5 font-sans text-[10px] font-bold uppercase tracking-[0.06em]',
  imgExplainedCaption: 'font-sans text-[13px] font-semibold text-ink-strong',
  imgExplanation: 'flex flex-col gap-1.5 [&_p]:m-0 [&_p]:font-sans [&_p]:text-[13.5px] [&_p]:leading-[1.65] [&_p]:text-ink-base',
  imgExplanationEdit:
    'box-border w-full resize-y rounded-md border border-dashed border-indigo-500/35 bg-indigo-500/[0.05] px-2.5 py-2 font-sans text-[13px] leading-[1.6] text-ink-base outline-none placeholder:text-ink-muted placeholder:opacity-60 focus:border-indigo-500/60 focus:bg-indigo-500/[0.07] dark:border-violet-500/30 dark:bg-violet-500/[0.07]',
  sectionImageWrap: 'relative my-2 mb-1 min-w-0 rounded-lg border border-black/[0.06] bg-white/50 p-1 dark:border-white/10 dark:bg-white/[0.04]',
  sectionImageWrapInline: 'm-0 flex-[0_0_42%] max-[640px]:w-full max-[640px]:flex-none',
  imageControlsBar: 'mt-[5px] flex flex-wrap items-center gap-1.5',
  imagePosButtons: 'flex flex-wrap gap-[3px]',
  imagePosButton:
    'cursor-pointer whitespace-nowrap rounded-[5px] border-[1.5px] border-line-soft bg-transparent px-[7px] py-0.5 font-sans text-[10.5px] font-semibold text-ink-muted transition hover:bg-surface-raised hover:text-ink-strong',
  imagePosButtonOn:
    'border-[color-mix(in_srgb,var(--color-primary,#2563eb)_45%,transparent)] bg-[color-mix(in_srgb,var(--color-primary,#2563eb)_12%,transparent)] text-primary',
  imageSmallButton:
    'cursor-pointer rounded-[5px] border-[1.5px] border-line-soft bg-surface-raised px-2 py-0.5 font-sans text-[11px] font-semibold text-ink-muted transition hover:bg-surface-glass-strong hover:text-ink-strong',
  imageDeleteButton: 'border-red-600/30 text-red-600 hover:bg-red-600/[0.08]',
  sectionBody: 'px-3.5 pb-3 pt-2 max-[520px]:px-2.5',
  sectionBodySplit: 'flex items-start gap-3 p-0',
  sectionBodyLeft: 'flex items-start gap-3 p-0 max-[640px]:flex-col',
  sectionBodyRight: 'flex items-start gap-3 p-0 max-[640px]:flex-col',
  sectionTextCol: 'min-w-0 flex-1 py-2',
  sectionHeading: 'flex items-center gap-2.5 px-3.5 pb-0 pt-3 max-[520px]:px-2.5',
  diagramIcon: 'size-[46px] shrink-0 drop-shadow-[0_0_6px_rgba(160,200,255,0.25)] [&_svg]:size-full',
  headingText:
    "m-0 inline-flex w-fit max-w-full break-words rounded-md px-2.5 py-0.5 font-['Plus_Jakarta_Sans',sans-serif] text-[11px] font-extrabold uppercase tracking-[0.06em] text-slate-700 dark:text-[#f0f4ff]",
  sectionExtras: 'mt-1 flex flex-col gap-1.5',
  callout:
    "flex min-w-0 items-start gap-2 break-words rounded-lg border border-black/[0.05] bg-amber-50/70 px-3 py-2 font-['Patrick_Hand',cursive] text-[14.5px] leading-[1.52] text-slate-700 dark:!border-[rgba(180,200,255,0.18)] dark:bg-white/[0.055] dark:text-[#c8d8ff] max-[520px]:text-[15px]",
  calloutArrow: 'shrink-0 text-sm',
  examTrapPill:
    "inline-flex shrink-0 items-center rounded-full border border-red-400/25 bg-red-400/14 px-2 py-0.5 font-['Plus_Jakarta_Sans',sans-serif] text-[9.5px] font-extrabold uppercase tracking-[0.08em] text-red-600 dark:border-red-300/22 dark:bg-red-300/12 dark:text-red-200",
  mnemonic:
    'rotate-[-0.6deg] rounded-lg border-[1.5px] border-[rgba(180,130,0,0.3)] bg-[rgba(220,160,0,0.08)] px-3 py-2.5 dark:border-[rgba(255,210,0,0.35)] dark:bg-[rgba(100,70,0,0.35)] dark:shadow-[0_0_14px_rgba(255,210,0,0.08)]',
  mnemonicLabel: 'mb-[5px] text-[10px] font-extrabold uppercase tracking-[1.2px] text-amber-800 dark:text-[#ffe57a]',
  mnemonicText:
    "whitespace-pre-line font-['Patrick_Hand',cursive] text-[13px] leading-[1.55] text-amber-900 dark:text-[#fff0b0]",
  sticky:
    'relative rounded-lg border border-black/[0.05] px-3 py-2 opacity-95 shadow-[0_3px_10px_rgba(91,64,35,0.06)] dark:!border-[rgba(180,200,255,0.18)] dark:bg-white/[0.055] dark:shadow-none',
  stickyPin:
    'absolute left-1/2 top-[-5px] size-2.5 -translate-x-1/2 rounded-full bg-white/30 shadow-[0_0_6px_rgba(255,255,255,0.2)]',
  stickyText:
    "m-0 font-['Patrick_Hand',cursive] text-[14.5px] font-semibold leading-[1.52] text-slate-700 dark:font-semibold dark:text-[#c8d8ff] max-[520px]:text-[15px]",
  keyPoints:
    'relative mx-5 mb-3 mt-1 overflow-hidden rounded-[14px] border border-[#f3c77f]/70 px-4 py-3.5 shadow-[0_2px_10px_rgba(91,64,35,0.055)] dark:border-white/[0.07] dark:shadow-[0_2px_12px_rgba(0,0,0,0.3)] max-[520px]:mx-2 max-[520px]:px-3',
  keyPointsLabel:
    "mb-2.5 flex items-center gap-1.5 font-['Patrick_Hand',cursive] text-[13px] font-bold uppercase tracking-[0.8px] text-slate-600 dark:text-[rgba(200,220,255,0.7)]",
  keyPointsList: 'flex flex-wrap gap-2',
  keyChip:
    "max-w-full break-words rounded-lg border border-black/[0.05] px-3 py-1.5 font-['Patrick_Hand',cursive] text-[14px] font-bold text-slate-700 shadow-[0_1px_4px_rgba(91,64,35,0.08)] dark:text-[#e5ecff] dark:shadow-[0_2px_8px_rgba(0,0,0,0.28),0_0_0_1px_rgba(255,255,255,0.05)] max-[520px]:text-[14.5px]",
  keyChipEdit: 'cursor-text focus:outline focus:outline-2 focus:outline-white/50',
  summary:
    'relative mx-5 mb-5 overflow-hidden rounded-[14px] border border-cyan-600/20 px-5 py-4 shadow-[0_2px_10px_rgba(91,64,35,0.055)] dark:border-white/10 dark:shadow-[0_4px_20px_rgba(0,0,0,0.4)] max-[520px]:mx-2 max-[520px]:px-3',
  summaryLabel:
    "mb-2 flex items-center gap-1.5 font-['Patrick_Hand',cursive] text-xs font-bold uppercase tracking-[0.8px] text-blue-700/65 dark:text-[rgba(150,180,255,0.7)]",
  footer:
    'border-t border-black/[0.06] px-[22px] py-2.5 text-right text-[10px] tracking-[0.3px] text-slate-500/55 dark:border-t-white/[0.06] dark:text-white/20',
  toolbar:
    'absolute right-3 top-3 z-[60] flex max-w-[760px] flex-wrap items-center gap-1.5 rounded-xl border border-line-soft bg-white/78 px-3 py-2 shadow-[0_12px_30px_rgba(15,23,42,0.10)] backdrop-blur-[14px] dark:border-[rgba(145,170,255,0.16)] dark:bg-[rgba(8,12,24,0.82)] dark:shadow-[0_16px_36px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.06)] max-[820px]:left-3',
  toolbarLabel: 'whitespace-nowrap text-[10px] font-extrabold uppercase tracking-[0.1em] text-ink-muted dark:text-sky-100/58',
  toolbarDivider: 'h-[18px] w-px shrink-0 bg-line-soft dark:bg-white/10',
  toolbarButton: '!flex !items-center !gap-[5px] !whitespace-nowrap !px-2.5 !py-1 !text-xs dark:!border-[rgba(145,170,255,0.16)] dark:!bg-white/[0.06] dark:!text-slate-200 dark:hover:!border-sky-300/28 dark:hover:!bg-sky-300/12 dark:hover:!text-white',
  bgSwatch: 'inline-block size-3.5 shrink-0 rounded border-[1.5px] border-black/20',
  layoutToggle: 'flex items-center gap-[3px]',
  layoutButton:
    'flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-[7px] border-[1.5px] border-line-soft bg-transparent px-[9px] py-1 font-sans text-[11px] font-semibold text-ink-muted transition hover:bg-surface-raised hover:text-ink-strong active:scale-[0.97] dark:border-[rgba(145,170,255,0.16)] dark:bg-white/[0.04] dark:text-slate-300 dark:hover:border-sky-300/26 dark:hover:bg-sky-300/10 dark:hover:text-white',
  layoutButtonOn:
    'border-[color-mix(in_srgb,var(--color-primary,#2563eb)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-primary,#2563eb)_12%,transparent)] text-primary dark:!border-sky-300/36 dark:!bg-sky-300/14 dark:!text-sky-100',
  popup:
    'absolute left-0 top-[calc(100%+6px)] z-[300] rounded-[14px] border border-line-soft bg-surface-1 p-2.5 shadow-[0_8px_28px_rgba(0,0,0,0.13)] dark:border-white/[0.08] dark:bg-[#374151]',
  stickerPicker: 'grid w-[228px] grid-cols-6 gap-[5px]',
  stickerButton:
    'flex size-[34px] cursor-pointer items-center justify-center rounded-lg border border-line-soft bg-surface-2 text-lg transition hover:scale-110 hover:bg-[color-mix(in_srgb,var(--color-primary)_10%,var(--surface-2))]',
  colorPicker: 'grid w-[180px] grid-cols-5 gap-1.5',
  colorSwatch:
    'size-[26px] cursor-pointer rounded-[7px] border-[1.5px] border-black/10 p-0 transition hover:scale-110',
  colorSwatchSelected: 'border-[2.5px] !border-blue-700 shadow-[0_0_0_2px_rgba(37,99,235,0.28)]',
  colorCustom:
    'relative flex items-center justify-center overflow-hidden !bg-surface-2 text-sm',
  userSticker:
    'absolute z-[15] flex select-none items-center justify-center drop-shadow-[0_2px_5px_rgba(0,0,0,0.18)] touch-none transition-[filter]',
  userStickerSelected:
    'z-[25] rounded outline outline-2 outline-offset-4 outline-dashed outline-indigo-500/60 drop-shadow-[0_3px_8px_rgba(0,0,0,0.2)]',
  stickerControls:
    'absolute left-1/2 top-[calc(100%+6px)] z-30 flex -translate-x-1/2 items-center gap-[3px] whitespace-nowrap rounded-[10px] border border-line-soft bg-surface-1 px-1.5 py-1 shadow-[0_4px_16px_rgba(0,0,0,0.14)] [transform:translateX(-50%)_rotate(calc(-1*var(--rot,0deg)))] dark:border-white/10 dark:bg-slate-800',
  stickerControlButton:
    'flex size-[26px] cursor-pointer items-center justify-center rounded-[7px] border border-black/10 bg-surface-2 p-0 text-xs font-bold text-ink-medium transition hover:bg-[color-mix(in_srgb,var(--color-primary,#2563eb)_10%,var(--surface-2,#f8fafc))]',
  stickerDeleteButton: '!border-red-500/20 !bg-red-50 !text-red-500 hover:!bg-red-100',
  compressToast:
    'my-1.5 flex items-center gap-[7px] self-start rounded-full border border-line-soft bg-surface-glass px-3.5 py-1.5 font-sans text-xs text-ink-muted',
  compressSpin: 'animate-[spin_0.9s_linear_infinite]',
  smartArrangeFab:
    'absolute bottom-4 right-4 z-[55] inline-flex items-center gap-1.5 rounded-full border border-violet-500/20 bg-white/90 px-3.5 py-2 font-sans text-[11px] font-extrabold text-violet-700 shadow-[0_10px_28px_rgba(88,28,135,0.14)] backdrop-blur-md transition hover:-translate-y-0.5 hover:bg-violet-50 dark:border-violet-300/20 dark:bg-slate-950/85 dark:text-violet-100 dark:hover:bg-violet-500/15',
  focusBtn:
    "inline-flex items-center gap-1.5 rounded-lg border border-slate-300/60 bg-white/60 px-2.5 py-1 font-['Plus_Jakarta_Sans',sans-serif] text-[11px] font-semibold text-slate-600 backdrop-blur-sm transition hover:bg-white hover:text-slate-700 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white",
  focusBtnOn:
    '!border-violet-400/50 !bg-violet-100/90 !text-violet-700 dark:!border-violet-400/30 dark:!bg-violet-500/15 dark:!text-violet-200',
  lightboxBackdrop:
    'ncv-lightbox-backdrop fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/86 p-3 backdrop-blur-xl touch-none',
  lightboxPanel:
    'ncv-lightbox-panel flex h-full max-h-[96dvh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/12 bg-slate-950/82 shadow-[0_30px_90px_rgba(0,0,0,0.48)]',
  lightboxTopbar:
    'flex min-h-[58px] items-center justify-between gap-3 border-b border-white/10 px-3.5 py-2.5 font-sans text-white max-[640px]:flex-col max-[640px]:items-stretch',
  lightboxTitle:
    'min-w-0 flex-1',
  lightboxCaption:
    'truncate text-[13px] font-extrabold leading-snug',
  lightboxMeta:
    'mt-0.5 text-[11px] font-semibold text-white/56',
  lightboxActions:
    'flex shrink-0 flex-wrap items-center justify-end gap-1.5 max-[640px]:justify-start',
  lightboxButton:
    'inline-flex min-h-[36px] cursor-pointer items-center justify-center rounded-lg border border-white/12 bg-white/[0.065] px-3 font-sans text-[12px] font-extrabold text-white/86 transition hover:bg-white/[0.12] hover:text-white active:scale-[0.97]',
  lightboxIconButton:
    'inline-flex size-9 cursor-pointer items-center justify-center rounded-lg border border-white/12 bg-white/[0.065] p-0 font-sans text-[17px] font-extrabold text-white/86 transition hover:bg-white/[0.12] hover:text-white active:scale-[0.97]',
  lightboxViewport:
    'relative flex min-h-0 flex-1 cursor-grab items-center justify-center overflow-hidden bg-slate-950 p-4 touch-none active:cursor-grabbing',
  lightboxImage:
    'max-h-full max-w-full select-none rounded-lg object-contain shadow-[0_18px_60px_rgba(0,0,0,0.38)] transition-transform duration-200 ease-out',
};

const DEFAULT_HIGHLIGHT_COLORS = ['#FBBF24', '#60A5FA', '#34D399', '#F472B6', '#A78BFA', '#22D3EE', '#FB7185', '#FDBA74'];
const IMAGE_FIT_OPTIONS = [
  { key: 'contain', label: 'Fit' },
  { key: 'cover', label: 'Crop' },
];

function isHexColor(value) {
  return /^#[0-9a-f]{6}$/i.test(String(value || '').trim());
}

function colorWithAlpha(color, alpha) {
  return isHexColor(color) ? `${color}${alpha}` : color;
}

function getHighlightPalette(colors, accentColor) {
  const palette = [
    accentColor,
    ...(Array.isArray(colors) ? colors : []),
    ...DEFAULT_HIGHLIGHT_COLORS,
  ].filter(isHexColor);
  return Array.from(new Set(palette.map(color => color.toUpperCase())));
}

function highlightMarkStyle(color, theme) {
  const isDark = theme === 'dark';
  return {
    backgroundColor: colorWithAlpha(color, isDark ? '56' : '3A'),
    color: isDark ? '#f8fbff' : '#334155',
    boxShadow: 'none',
    textDecoration: 'none',
    textShadow: isDark ? '0 1px 0 rgba(0,0,0,0.24)' : 'none',
  };
}

function ExpandImageIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M7.5 3.5H3.5v4M12.5 3.5h4v4M7.5 16.5H3.5v-4M12.5 16.5h4v-4" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M8 8L4 4M12 8l4-4M8 12l-4 4M12 12l4 4" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round"/>
    </svg>
  );
}

function splitExamTrap(text) {
  const raw = String(text || '').trim();
  const match = raw.match(/^\[?\s*(exam\s*trap|trap|warning)\s*\]?\s*[:\-]?\s*/i);
  if (!match) return { isExamTrap: false, text: raw };
  return { isExamTrap: true, text: raw.slice(match[0].length).trim() };
}

function CalloutContent({ text, accentColor, highlightColors, highlightIndex }) {
  const parsed = splitExamTrap(text);
  return (
    <span className="min-w-0">
      {parsed.isExamTrap && <span className={noteCanvasUi.examTrapPill}>Exam Trap</span>}
      {parsed.isExamTrap && parsed.text ? ' ' : null}
      <RichText text={parsed.text || text} accentColor={accentColor} highlightColors={highlightColors} highlightIndex={highlightIndex}/>
    </span>
  );
}

function MedicalIconSvg({ type = 0 }) {
  const variant = Math.abs(Number(type) || 0) % 6;
  if (variant === 0) {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 12h3l2-5 4 10 2-5h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M5.5 6.5C7.7 4.2 10.6 4.8 12 7c1.4-2.2 4.3-2.8 6.5-.5 2.3 2.4 1.4 6.4-6.5 11.1-7.9-4.7-8.8-8.7-6.5-11.1z" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" opacity="0.48"/>
      </svg>
    );
  }
  if (variant === 1) {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="17" cy="17" r="3" stroke="currentColor" strokeWidth="1.7"/>
        <path d="M5 4v6a6 6 0 0 0 12 0V4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
        <path d="M4 4h3M17 4h3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
      </svg>
    );
  }
  if (variant === 2) {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <rect x="4" y="4" width="16" height="16" rx="5" stroke="currentColor" strokeWidth="1.4" opacity="0.48"/>
      </svg>
    );
  }
  if (variant === 3) {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="4" y="10" width="16" height="7" rx="3.5" transform="rotate(-35 4 10)" stroke="currentColor" strokeWidth="1.7"/>
        <path d="M11.5 7.2l4.1 5.8" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" opacity="0.55"/>
      </svg>
    );
  }
  if (variant === 4) {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M9 4h6M12 4v5l5 8.5A2.3 2.3 0 0 1 15 21H9a2.3 2.3 0 0 1-2-3.5L12 9V4z" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M8.4 16h7.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.52"/>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8 18h8M12 15v3M9 15h6l1.5-7h-9L9 15z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M10 8V5h4v3M8 21h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function MedicalMiniIcon({ index = 0, color = '#60A5FA', theme }) {
  return (
    <span
      className={noteCanvasUi.cardMedicalIcon}
      style={{
        color,
        borderColor: colorWithAlpha(color, '55'),
        background: theme === 'dark' ? colorWithAlpha(color, '16') : colorWithAlpha(color, '12'),
      }}
    >
      <MedicalIconSvg type={index} />
    </span>
  );
}

function normalizeImageFit(value) {
  return value === 'cover' ? 'cover' : 'contain';
}

function imageSurfaceStyle(theme) {
  return {
    background: theme === 'dark'
      ? 'linear-gradient(135deg, rgba(255,255,255,0.055), rgba(255,255,255,0.02))'
      : 'linear-gradient(135deg, rgba(248,250,252,0.96), rgba(239,246,255,0.62))',
  };
}

function imageAspectRatio(source) {
  const imageWidth = Number(source?.imageWidth) || 0;
  const imageHeight = Number(source?.imageHeight) || 0;
  return imageWidth > 0 && imageHeight > 0 ? `${imageWidth} / ${imageHeight}` : undefined;
}

function responsiveImageStyle(source, requestedHeight, editable, imageFit, borderRadius) {
  return {
    display: 'block',
    width: '100%',
    height: editable ? Math.max(80, Number(requestedHeight) || 200) : 'auto',
    aspectRatio: editable ? undefined : imageAspectRatio(source),
    objectFit: editable ? imageFit : 'contain',
    borderRadius,
  };
}

function ImageFitControls({ value, onChange, floating = false }) {
  const current = normalizeImageFit(value);
  return (
    <div className={cx(noteCanvasUi.imageFitBar, floating && noteCanvasUi.imageFitOverlay)}>
      <span className={cx(noteCanvasUi.imageFitLabel, floating && noteCanvasUi.imageFitLabelOverlay)}>Image display</span>
      <div className={cx(noteCanvasUi.imageFitToggle, floating && noteCanvasUi.imageFitToggleOverlay)} role="group" aria-label="Image display mode">
        {IMAGE_FIT_OPTIONS.map(option => (
          <button
            key={option.key}
            type="button"
            className={cx(noteCanvasUi.imageFitButton, floating && noteCanvasUi.imageFitButtonOverlay, current === option.key && noteCanvasUi.imageFitButtonOn)}
            onClick={() => onChange(option.key)}
            aria-pressed={current === option.key}
            title={option.key === 'contain' ? 'Show the whole image' : 'Crop image to fill the block'}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ImageLightbox({ image, onClose }) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const pointersRef = useRef(new Map());
  const panRef = useRef(null);
  const pinchRef = useRef(null);

  function applyScale(updater) {
    setScale(current => {
      const next = typeof updater === 'function' ? updater(current) : updater;
      const clamped = Math.max(1, Math.min(4, Number(next.toFixed?.(2) ?? next)));
      if (clamped === 1) setOffset({ x: 0, y: 0 });
      return clamped;
    });
  }

  function pointerDistance(points) {
    const [a, b] = points;
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  }

  function onPointerDown(event) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointersRef.current.set(event.pointerId, event);
    const points = Array.from(pointersRef.current.values());
    if (points.length === 2) {
      pinchRef.current = { distance: pointerDistance(points), scale };
      panRef.current = null;
      return;
    }
    if (scale > 1) {
      panRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        offsetX: offset.x,
        offsetY: offset.y,
      };
    }
  }

  function onPointerMove(event) {
    if (!pointersRef.current.has(event.pointerId)) return;
    event.preventDefault();
    pointersRef.current.set(event.pointerId, event);
    const points = Array.from(pointersRef.current.values());
    if (points.length === 2 && pinchRef.current) {
      const nextScale = pinchRef.current.scale * (pointerDistance(points) / Math.max(1, pinchRef.current.distance));
      applyScale(nextScale);
      return;
    }
    if (panRef.current?.pointerId === event.pointerId && scale > 1) {
      setOffset({
        x: panRef.current.offsetX + event.clientX - panRef.current.startX,
        y: panRef.current.offsetY + event.clientY - panRef.current.startY,
      });
    }
  }

  function onPointerEnd(event) {
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (panRef.current?.pointerId === event.pointerId) panRef.current = null;
  }

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape') onClose();
      if (event.key === '+' || event.key === '=') applyScale(current => current + 0.25);
      if (event.key === '-') applyScale(current => current - 0.25);
      if (event.key === '0') applyScale(1);
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  if (!image?.src || typeof document === 'undefined') return null;

  const caption = image.caption || 'Lesson image';
  const meta = scale > 1 ? `${Math.round(scale * 100)}% zoom` : 'Fit to screen';

  return createPortal(
    <div
      className={noteCanvasUi.lightboxBackdrop}
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
      onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className={noteCanvasUi.lightboxPanel}>
        <div className={noteCanvasUi.lightboxTopbar}>
          <div className={noteCanvasUi.lightboxTitle}>
            <div className={noteCanvasUi.lightboxCaption}>{caption}</div>
            <div className={noteCanvasUi.lightboxMeta}>{meta}</div>
          </div>
          <div className={noteCanvasUi.lightboxActions}>
            <button type="button" className={noteCanvasUi.lightboxButton} onClick={() => applyScale(current => current - 0.25)}>
              Zoom out
            </button>
            <button type="button" className={noteCanvasUi.lightboxButton} onClick={() => applyScale(1)}>
              Reset
            </button>
            <button type="button" className={noteCanvasUi.lightboxButton} onClick={() => applyScale(current => current + 0.25)}>
              Zoom in
            </button>
            <button type="button" className={noteCanvasUi.lightboxIconButton} onClick={onClose} aria-label="Close image viewer">
              ×
            </button>
          </div>
        </div>
        <div
          className={noteCanvasUi.lightboxViewport}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onDoubleClick={event => {
            event.preventDefault();
            applyScale(scale > 1 ? 1 : 2.25);
          }}
        >
          <img
            src={image.src}
            alt={caption}
            className={noteCanvasUi.lightboxImage}
            style={{
              transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`,
              maxWidth: '100%',
              maxHeight: '100%',
              transformOrigin: 'center',
            }}
            draggable={false}
          />
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ══════════════════════════════════════════════════════════════
   RICH TEXT — ==highlight== and **bold**
══════════════════════════════════════════════════════════════ */
function RichText({ text, highlightColors, accentColor, highlightIndex = 0 }) {
  const theme = useThemeStore(s => s.theme);
  if (!text) return null;
  const markColors = getHighlightPalette(highlightColors, accentColor);
  const parts = [];
  let s = String(text), k = 0, markIndex = 0;
  while (s.length) {
    const hi = s.indexOf('=='), bd = s.indexOf('**');
    const next = Math.min(hi === -1 ? Infinity : hi, bd === -1 ? Infinity : bd);
    if (next === Infinity) { parts.push(s); break; }
    if (next > 0) { parts.push(s.slice(0, next)); s = s.slice(next); k++; }
    if (s.startsWith('==')) {
      const e = s.indexOf('==', 2); if (e === -1) { parts.push(s); break; }
      const color = markColors[(highlightIndex + markIndex) % markColors.length];
      markIndex += 1;
      parts.push(<mark key={k++} className={noteCanvasUi.highlight} style={highlightMarkStyle(color, theme)}>{s.slice(2, e)}</mark>); s = s.slice(e + 2);
    } else {
      const e = s.indexOf('**', 2); if (e === -1) { parts.push(s); break; }
      parts.push(<strong key={k++} className={noteCanvasUi.boldTerm}>{s.slice(2, e)}</strong>); s = s.slice(e + 2);
    }
  }
  return <>{parts}</>;
}

/* ══════════════════════════════════════════════════════════════
   INLINE EDIT FIELDS
══════════════════════════════════════════════════════════════ */
function stopCanvasInputGesture(event) {
  event.stopPropagation();
}

let scribbleAudioContext = null;
let lastScribbleSoundAt = 0;

function getScribbleAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  scribbleAudioContext ||= new AudioContextClass();
  return scribbleAudioContext;
}

function unlockScribbleAudio() {
  if (typeof window === 'undefined') return;
  playNativeScribbleSound(0.55, true);
  try {
    const context = getScribbleAudioContext();
    if (!context) return;
    if (context.state === 'suspended') {
      context.resume().catch(() => {});
    }
  } catch {
    // Audio is optional; editing should continue normally if unavailable.
  }
}

function playNativeScribbleSound(volume = 0.9, force = false) {
  if (typeof window === 'undefined') return false;
  const handler = window.webkit?.messageHandlers?.lmsScribbleAudio;
  if (!handler || typeof handler.postMessage !== 'function') return false;

  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (!force && now - lastScribbleSoundAt < 58) return true;
  lastScribbleSoundAt = now;

  try {
    handler.postMessage({ volume });
    return true;
  } catch {
    return false;
  }
}

function playScribbleSound(force = false) {
  if (typeof window === 'undefined') return;

  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (!force && now - lastScribbleSoundAt < 58) return;
  if (playNativeScribbleSound(1, force)) return;

  try {
    const context = getScribbleAudioContext();
    if (!context) return;
    if (context.state === 'suspended') {
      context.resume().then(() => playScribbleSound(true)).catch(() => {});
      return;
    }

    lastScribbleSoundAt = now;
    const duration = 0.055;
    const sampleCount = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, sampleCount, context.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i += 1) {
      const progress = i / sampleCount;
      const fade = Math.sin(Math.PI * progress) * (1 - progress * 0.25);
      channel[i] = (Math.random() * 2 - 1) * fade;
    }

    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = buffer;
    source.playbackRate.value = 0.82 + Math.random() * 0.55;
    filter.type = 'bandpass';
    filter.frequency.value = 1700 + Math.random() * 1300;
    filter.Q.value = 6;
    gain.gain.setValueAtTime(0.001, context.currentTime);
    gain.gain.linearRampToValueAtTime(0.055, context.currentTime + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);
    source.start();
    source.stop(context.currentTime + duration);
  } catch {
    // Writing sound is decorative; never block editing if audio is unavailable.
  }
}

function EField({ value, onChange, placeholder, className, style, onPointerDown, onTouchStart, onFocus, onKeyDown, onInput, onBeforeInput, onCompositionUpdate, ...props }) {
  return (
    <input className={cx(noteCanvasUi.editInput, className)} type="text" value={value || ''} onChange={e => { playScribbleSound(); onChange(e.target.value); }}
      placeholder={placeholder}
      data-lms-canvas-input="true"
      onPointerDown={event => {
        stopCanvasInputGesture(event);
        unlockScribbleAudio();
        onPointerDown?.(event);
      }}
      onTouchStart={event => {
        stopCanvasInputGesture(event);
        unlockScribbleAudio();
        onTouchStart?.(event);
      }}
      onPointerMove={event => {
        if (event.pressure > 0 || event.pointerType === 'pen') playScribbleSound();
      }}
      onTouchMove={() => playScribbleSound()}
      onFocus={event => {
        unlockScribbleAudio();
        onFocus?.(event);
      }}
      onKeyDown={event => {
        playScribbleSound();
        onKeyDown?.(event);
      }}
      onInput={event => {
        playScribbleSound();
        onInput?.(event);
      }}
      onBeforeInput={event => {
        playScribbleSound();
        onBeforeInput?.(event);
      }}
      onCompositionUpdate={event => {
        playScribbleSound();
        onCompositionUpdate?.(event);
      }}
      style={{ touchAction: 'manipulation', WebkitUserSelect: 'text', userSelect: 'text', ...style }}
      {...props}/>
  );
}
function EArea({ value, onChange, placeholder, className, style, minRows = 2, onPointerDown, onTouchStart, onFocus, onKeyDown, onInput, onBeforeInput, onCompositionUpdate, ...props }) {
  const rows = Math.max(minRows, (value || '').split('\n').length + 1);
  return (
    <textarea className={cx(noteCanvasUi.editArea, className)} value={value || ''} onChange={e => { playScribbleSound(); onChange(e.target.value); }}
      placeholder={placeholder}
      rows={rows}
      data-lms-canvas-input="true"
      onPointerDown={event => {
        stopCanvasInputGesture(event);
        unlockScribbleAudio();
        onPointerDown?.(event);
      }}
      onTouchStart={event => {
        stopCanvasInputGesture(event);
        unlockScribbleAudio();
        onTouchStart?.(event);
      }}
      onPointerMove={event => {
        if (event.pressure > 0 || event.pointerType === 'pen') playScribbleSound();
      }}
      onTouchMove={() => playScribbleSound()}
      onFocus={event => {
        unlockScribbleAudio();
        onFocus?.(event);
      }}
      onKeyDown={event => {
        playScribbleSound();
        onKeyDown?.(event);
      }}
      onInput={event => {
        playScribbleSound();
        onInput?.(event);
      }}
      onBeforeInput={event => {
        playScribbleSound();
        onBeforeInput?.(event);
      }}
      onCompositionUpdate={event => {
        playScribbleSound();
        onCompositionUpdate?.(event);
      }}
      style={{ touchAction: 'manipulation', WebkitUserSelect: 'text', userSelect: 'text', ...style }}
      {...props}/>
  );
}

/* ══════════════════════════════════════════════════════════════
   BULLET LIST
══════════════════════════════════════════════════════════════ */
function BulletList({ bullets, accentColor, highlightColors }) {
  return (
    <ul className={noteCanvasUi.bullets}>
      {bullets.map((b, i) => {
        const sub = b.startsWith('→ ') || b.startsWith('→');
        return (
          <li key={i} className={cx(noteCanvasUi.bullet, sub && noteCanvasUi.subBullet)}>
            {sub
              ? <span className={noteCanvasUi.subArrow} style={{ color: accentColor }}>↳</span>
              : <span className={noteCanvasUi.bulletDot} style={{ background: accentColor }}/>}
            <span className="min-w-0 break-words"><RichText text={sub ? b.replace(/^→\s*/, '') : b} accentColor={accentColor} highlightColors={highlightColors} highlightIndex={i}/></span>
          </li>
        );
      })}
    </ul>
  );
}

/* ── Checkable bullets: click to mark as studied (read mode) ── */
function CheckableBullet({ bulletKey, text, isSub, accentColor, highlightColors, highlightIndex = 0, done, onToggle }) {
  return (
    <li
      className={cx(noteCanvasUi.bullet, isSub && noteCanvasUi.subBullet)}
      style={{ cursor: 'pointer', userSelect: 'none' }}
      onClick={() => onToggle(bulletKey)}
      title={done ? 'Click to unmark' : 'Click to mark as studied'}
    >
      {isSub
        ? <span className={noteCanvasUi.subArrow} style={{ color: done ? '#10b981' : accentColor, transition: 'color 0.2s' }}>↳</span>
        : <span
            className={noteCanvasUi.bulletDot}
            style={{
              background: done ? '#10b981' : accentColor,
              boxShadow: done ? '0 0 0 3px rgba(16,185,129,0.22)' : undefined,
              transition: 'background 0.2s, box-shadow 0.2s',
            }}
          />}
      <span style={{ minWidth: 0, overflowWrap: 'anywhere', textDecoration: done ? 'line-through' : 'none', opacity: done ? 0.42 : 1, transition: 'opacity 0.2s, text-decoration 0.1s' }}>
        <RichText text={text} accentColor={accentColor} highlightColors={highlightColors} highlightIndex={highlightIndex}/>
      </span>
      {done && <span style={{ marginLeft: 5, fontSize: 11, color: '#10b981', flexShrink: 0, lineHeight: 1 }}>✓</span>}
    </li>
  );
}

function CheckableBulletList({ bullets, accentColor, highlightColors, sectionKey }) {
  const [doneSet, setDoneSet] = useState(() => new Set());
  function toggle(key) {
    setDoneSet(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }
  const total   = bullets.length;
  const checked = doneSet.size;
  return (
    <>
      {checked > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <div style={{ flex: 1, height: 4, borderRadius: 99, background: 'rgba(0,0,0,0.07)', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 99, background: '#10b981', width: `${Math.round((checked / total) * 100)}%`, transition: 'width 0.4s ease', boxShadow: '0 0 8px rgba(16,185,129,0.35)' }}/>
          </div>
          <span style={{ fontSize: 10, fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, color: '#059669', whiteSpace: 'nowrap', lineHeight: 1 }}>
            {checked}/{total}
          </span>
          {checked === total && <span style={{ fontSize: 11, lineHeight: 1 }}>🎉</span>}
        </div>
      )}
      <ul className={noteCanvasUi.bullets}>
        {bullets.map((b, i) => {
          const isSub = b.startsWith('→ ') || b.startsWith('→');
          const text  = isSub ? b.replace(/^→\s*/, '') : b;
          const key   = `${sectionKey}-${i}`;
          return (
            <CheckableBullet
              key={i}
              bulletKey={key}
              text={text}
              isSub={isSub}
              accentColor={accentColor}
              highlightColors={highlightColors}
              highlightIndex={i}
              done={doneSet.has(key)}
              onToggle={toggle}
            />
          );
        })}
      </ul>
    </>
  );
}

function BulletEditor({ bullets = [], accentColor, onChange }) {
  const rows = bullets.length ? bullets : [''];

  function updateRow(index, value) {
    const next = [...rows];
    next[index] = value;
    onChange(next);
  }

  function addRow(index) {
    const next = [...rows];
    next.splice(index + 1, 0, '');
    onChange(next);
  }

  function removeRow(index) {
    const next = rows.filter((_, i) => i !== index);
    onChange(next.length ? next : ['']);
  }

  return (
    <ul className={noteCanvasUi.bullets}>
      {rows.map((b, i) => {
        const sub = b.startsWith('→ ') || b.startsWith('→');
        return (
          <li key={i} className={cx(noteCanvasUi.bullet, sub && noteCanvasUi.subBullet)}>
            {sub
              ? <span className={noteCanvasUi.subArrow} style={{ color: accentColor }}>↳</span>
              : <span className={noteCanvasUi.bulletDot} style={{ background: accentColor }}/>}
            <EField
              value={sub ? b.replace(/^→\s*/, '') : b}
              onChange={value => updateRow(i, sub ? `→ ${value}` : value)}
              placeholder="Add note..."
              style={{ width:'100%' }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addRow(i);
                }
                if (e.key === 'Backspace' && !e.currentTarget.value && rows.length > 1) {
                  e.preventDefault();
                  removeRow(i);
                }
              }}
            />
            <button className={noteCanvasUi.sectionButton}
              type="button"
              onClick={() => addRow(i)}
              title="Add line"
              style={{ opacity:0.42, width:20, height:20, flexShrink:0 }}
            >
              +
            </button>
            {rows.length > 1 && (
              <button className={cx(noteCanvasUi.sectionButton, noteCanvasUi.sectionDeleteButton)}
                type="button"
                onClick={() => removeRow(i)}
                title="Remove line"
                style={{ opacity:0.42, width:20, height:20, flexShrink:0 }}
              >
                ×
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function canvasCardBackground(accentColor, theme) {
  const surface = theme === 'dark' ? 'rgba(10,16,30,0.76)' : 'rgba(255,255,255,0.76)';
  const topFade = theme === 'dark' ? '24' : '10';
  const cornerFade = theme === 'dark' ? '30' : '14';
  return [
    `radial-gradient(circle at 100% 100%, ${accentColor}${cornerFade} 0%, transparent 42%)`,
    theme === 'dark' ? 'radial-gradient(circle at 0% 0%, rgba(125,170,255,0.08) 0%, transparent 42%)' : '',
    `linear-gradient(135deg, ${accentColor}${topFade} 0%, transparent 58%)`,
    surface,
  ].filter(Boolean).join(', ');
}

function dottedCardBackground(accentColor, theme, surface) {
  const topFade = theme === 'dark' ? '24' : '10';
  const cornerFade = theme === 'dark' ? '30' : '14';
  const dotColor = theme === 'dark' ? 'rgba(190,210,255,0.06)' : 'rgba(87,69,39,0.045)';
  return [
    `radial-gradient(circle at 100% 100%, ${accentColor}${cornerFade} 0%, transparent 42%)`,
    `linear-gradient(135deg, ${accentColor}${topFade} 0%, transparent 58%)`,
    `radial-gradient(circle, ${dotColor} 1px, transparent 1px)`,
    surface,
  ].join(', ');
}

/* ══════════════════════════════════════════════════════════════
   SUMMARY FRAGMENTS
══════════════════════════════════════════════════════════════ */
function SummaryFragments({ text, highlightColors, accentColor }) {
  if (!text) return null;
  const frags = text.split(/\s*[·|]\s*|\s*→\s+/).filter(Boolean);
  if (frags.length <= 1) return <RichText text={text} highlightColors={highlightColors} accentColor={accentColor}/>;
  return (
    <div className={noteCanvasUi.summaryFrags}>
      {frags.map((f, i) => <span key={i} className={noteCanvasUi.summaryFrag}><RichText text={f.trim()} highlightColors={highlightColors} accentColor={accentColor} highlightIndex={i}/></span>)}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   COLORS
══════════════════════════════════════════════════════════════ */
const DARK_COLORS  = ['#7EB8FF','#FFE082','#FF8A80','#80CBC4','#CE93D8','#FFCC80'];
const LIGHT_COLORS = ['#2563EB','#D97706','#DC2626','#0EA5E9','#7C3AED','#60A5FA'];

function normalizeVisualStyleColors(raw) {
  return Array.isArray(raw)
    ? Array.from(new Set(raw.map(color => String(color || '').trim().toUpperCase()).filter(isHexColor))).slice(0, 8)
    : [];
}

const PALETTE = [
  '#2563EB','#DC2626','#0EA5E9','#D97706','#7C3AED','#60A5FA',
  '#DB2777','#EA580C','#16A34A','#CA8A04',
  '#A7D8FF','#FFE082','#FF8A80','#80CBC4','#CE93D8',
  '#FFCC80','#F48FB1','#80DEEA','#A5D6A7','#FFE0B2',
];

const LAYOUT_PATTERNS = [
  {
    id: 'two-cards',
    label: '2 Cards',
    title: 'Two equal cards on each row',
    columns: '2col',
    spans: ['half', 'half'],
  },
  {
    id: 'big-small',
    label: 'Big + Small',
    title: 'One big card across two columns and one small card beside it',
    columns: '3col',
    spans: ['wide', 'half'],
  },
  {
    id: 'three-small',
    label: '3 Small',
    title: 'Three small cards on each row',
    columns: '3col',
    spans: ['half', 'half', 'half'],
  },
  {
    id: 'mixed-combo',
    label: 'Mixed',
    title: 'Mix rows using Big + Small, 2 Cards, and 3 Small combinations',
    columns: '3col',
    spans: ['wide', 'half', 'half', 'half', 'half', 'half', 'wide', 'half'],
  },
];

function estimateSectionWeight(section) {
  if (section.type === 'image-explained') return 9;
  if (section.type === 'image') return section.src ? 7 : 4;

  const heading = String(section.heading || '').toLowerCase();
  const bullets = Array.isArray(section.bullets) ? section.bullets.filter(Boolean) : [];
  const textLength = bullets.join(' ').length + String(section.callout || '').length + String(section.sticky_note || '').length;

  let score = Math.min(8, Math.ceil(textLength / 110));
  if (/main|content|overview|definition|pathway|mechanism|diagram|visual/.test(heading)) score += 3;
  if (/summary|review|recap|key point|takeaway|example|case|tip/.test(heading)) score -= 1;
  if (section.sectionImage?.src) score += 2;
  if (bullets.length >= 6) score += 2;
  if (section.callout || section.mnemonic || section.sticky_note) score += 1;
  return Math.max(1, Math.min(10, score));
}

function estimateSectionHeight(section) {
  if (section.type === 'image-explained') {
    return (section.height || 220) + Math.ceil(String(section.explanation || '').length / 55) * 18 + 72;
  }
  if (section.type === 'image') return (section.height || 200) + (section.caption ? 32 : 12);

  const bullets = Array.isArray(section.bullets) ? section.bullets.filter(Boolean) : [];
  const bulletLines = bullets.reduce((sum, line) => sum + Math.max(1, Math.ceil(String(line).length / 42)), 0);
  let height = 58 + bulletLines * 24;
  if (section.sectionImage?.src) height += (section.sectionImage.height || 180) + 18;
  if (section.callout) height += 46;
  if (section.mnemonic) height += 58;
  if (section.sticky_note) height += 64;
  return height;
}

function spanUnits(span) {
  if (span === 'full') return 3;
  if (span === 'wide') return 2;
  return 1;
}

function normalizeSmartRow(row) {
  const total = row.reduce((sum, item) => sum + spanUnits(item.span), 0);
  if (total === 3) return row;

  const byWeight = [...row].sort((a, b) => b.weight - a.weight);

  if (row.length === 1) {
    return [{ ...row[0], span: 'full' }];
  }

  if (row.length === 2) {
    const wideIndex = row.findIndex(item => item === byWeight[0]);
    return row.map((item, index) => ({
      ...item,
      span: index === wideIndex ? 'wide' : 'half',
    }));
  }

  return row.map(item => ({ ...item, span: 'half' }));
}

function packSmartRows(items) {
  const rows = [];
  let row = [];
  let used = 0;

  function flush() {
    if (!row.length) return;
    rows.push(normalizeSmartRow(row));
    row = [];
    used = 0;
  }

  for (const item of items) {
    const units = spanUnits(item.span);

    if (item.span === 'full') {
      flush();
      rows.push([{ ...item, span: 'full' }]);
      continue;
    }

    if (used + units > 3) flush();

    row.push(item);
    used += units;

    if (used === 3) flush();
  }

  flush();
  return rows.flat();
}

function smartArrangeSections(sections) {
  const decorated = sections.map((section, index) => ({
    section,
    index,
    weight: estimateSectionWeight(section),
    height: estimateSectionHeight(section),
  }));

  const hero = decorated.find(item => item.section.type === 'image-explained' && item.height > 340)
    || decorated.find(item => item.weight >= 9 && item.height > 320);
  const pool = decorated.filter(item => item !== hero);
  const wide = pool
    .filter(item => item.weight >= 7 || item.height > 245 || item.section.type === 'image')
    .sort((a, b) => b.height - a.height);
  const small = pool
    .filter(item => !wide.includes(item))
    .sort((a, b) => a.height - b.height);

  const arranged = [];
  if (hero) arranged.push({ ...hero, span: 'full' });

  while (wide.length) {
    const main = wide.shift();
    arranged.push({ ...main, span: 'wide' });

    if (small.length) {
      arranged.push({ ...small.shift(), span: 'half' });
    } else if (wide.length) {
      const fallback = wide.shift();
      arranged.push({ ...fallback, span: 'half' });
    }
  }

  while (small.length) {
    const batch = small.splice(0, 3);
    if (batch.length === 1) arranged.push({ ...batch[0], span: 'full' });
    else if (batch.length === 2) {
      const [taller, shorter] = [...batch].sort((a, b) => b.height - a.height);
      arranged.push({ ...taller, span: 'wide' }, { ...shorter, span: 'half' });
    } else {
      arranged.push(...batch.map(item => ({ ...item, span: 'half' })));
    }
  }

  return packSmartRows(arranged).map(item => ({ ...item.section, span: item.span }));
}

/* ══════════════════════════════════════════════════════════════
   IMAGE COMPRESSION  (browser Canvas API — no extra deps)
   Resizes to max 1400px, converts to WebP @ 0.88 quality.
   Falls back to JPEG if the browser doesn't support WebP output.
══════════════════════════════════════════════════════════════ */
function compressImage(file, { maxWidth = 1400, quality = 0.88 } = {}) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let w = img.naturalWidth, h = img.naturalHeight;
      if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
      const cvs = document.createElement('canvas');
      cvs.width = w; cvs.height = h;
      cvs.getContext('2d').drawImage(img, 0, 0, w, h);
      const webp = cvs.toDataURL('image/webp', quality);
      resolve({
        src: webp.startsWith('data:image/webp') ? webp : cvs.toDataURL('image/jpeg', quality),
        imageWidth: w,
        imageHeight: h,
      });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
    img.src = url;
  });
}

function readFileAsImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Image read failed'));
    reader.onload = ev => {
      const src = ev.target.result;
      const img = new Image();
      img.onload = () => resolve({ src, imageWidth: img.naturalWidth, imageHeight: img.naturalHeight });
      img.onerror = () => resolve({ src });
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}

function imageSizeLabel(source, fallbackHeight) {
  if (source?.imageWidth && source?.imageHeight) return `${source.imageWidth}x${source.imageHeight} px`;
  if (fallbackHeight) return `${fallbackHeight}px high`;
  return '';
}

function useElementWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const update = () => setWidth(Math.round(el.getBoundingClientRect().width));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, width];
}

function useViewportWidth() {
  const [width, setWidth] = useState(() => (
    typeof window === 'undefined' ? 1024 : window.innerWidth
  ));

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    let frame = 0;
    const update = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => setWidth(window.innerWidth));
    };
    update();
    window.addEventListener('resize', update, { passive: true });
    window.addEventListener('orientationchange', update);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return width;
}

/* ══════════════════════════════════════════════════════════════
   STICKERS
══════════════════════════════════════════════════════════════ */
const STICKER_TYPES = [
  { id:'star',     emoji:'⭐' },{ id:'fire',     emoji:'🔥' },
  { id:'bulb',     emoji:'💡' },{ id:'trophy',   emoji:'🏆' },
  { id:'check',    emoji:'✅' },{ id:'warn',     emoji:'⚠️' },
  { id:'heart',    emoji:'❤️' },{ id:'thumbs',   emoji:'👍' },
  { id:'brain',    emoji:'🧠' },{ id:'book',     emoji:'📚' },
  { id:'pin',      emoji:'📌' },{ id:'bang',     emoji:'❗' },
  { id:'question', emoji:'❓' },{ id:'rocket',   emoji:'🚀' },
  { id:'pencil',   emoji:'✏️' },{ id:'sparkle',  emoji:'✨' },
  { id:'clock',    emoji:'⏰' },{ id:'flag',     emoji:'🚩' },
  { id:'target',   emoji:'🎯' },{ id:'pill',     emoji:'💊' },
  { id:'dna',      emoji:'🧬' },{ id:'micro',    emoji:'🔬' },
  { id:'steth',    emoji:'🩺' },{ id:'chart',    emoji:'📊' },
];

/* ── Sticker element: draggable + click-to-select ──────────── */
function UserSticker({ sticker, editable, selected, onSelect, onUpdate, onDelete, canvasRef }) {
  const ref  = useRef(null);
  const drag = useRef(null);
  const emoji = STICKER_TYPES.find(t => t.id === sticker.type)?.emoji || '⭐';

  function onPointerDown(e) {
    if (!editable) return;
    e.stopPropagation(); e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    drag.current = { moved: false, sx: e.clientX, sy: e.clientY, ox: sticker.x, oy: sticker.y, rect };
    ref.current?.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e) {
    if (!drag.current) return;
    e.stopPropagation();
    e.preventDefault();
    const { sx, sy, ox, oy, rect } = drag.current;
    drag.current.moved = true;
    const nx = Math.max(0, Math.min(rect.width  - sticker.size, ox + e.clientX - sx));
    const ny = Math.max(0, Math.min(rect.height - sticker.size, oy + e.clientY - sy));
    onUpdate({ ...sticker, x: nx, y: ny });
  }
  function onPointerUp(e) {
    e?.stopPropagation?.();
    e?.preventDefault?.();
    if (e?.pointerId != null) ref.current?.releasePointerCapture?.(e.pointerId);
    if (drag.current && !drag.current.moved) onSelect(sticker.id);
    drag.current = null;
  }

  return (
    <div
      ref={ref}
      data-lms-canvas-sticker="true"
      className={cx(noteCanvasUi.userSticker, selected && editable && noteCanvasUi.userStickerSelected)}
      style={{ left: sticker.x, top: sticker.y, width: sticker.size, height: sticker.size,
               fontSize: sticker.size * 0.72, transform: `rotate(${sticker.rotation || 0}deg)`,
               cursor: editable ? 'grab' : 'default',
               touchAction: 'none',
               WebkitUserSelect: 'none',
               userSelect: 'none' }}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
    >
      {emoji}
      {selected && editable && (
        <div className={noteCanvasUi.stickerControls} onClick={e => e.stopPropagation()}>
          <button className={noteCanvasUi.stickerControlButton} onClick={() => onUpdate({ ...sticker, size: Math.max(24, sticker.size - 8) })} title="Smaller">−</button>
          <button className={noteCanvasUi.stickerControlButton} onClick={() => onUpdate({ ...sticker, size: Math.min(120, sticker.size + 8) })} title="Larger">+</button>
          <button className={noteCanvasUi.stickerControlButton} onClick={() => onUpdate({ ...sticker, rotation: ((sticker.rotation || 0) - 15 + 360) % 360 })} title="Rotate left">↺</button>
          <button className={noteCanvasUi.stickerControlButton} onClick={() => onUpdate({ ...sticker, rotation: ((sticker.rotation || 0) + 15) % 360 })} title="Rotate right">↻</button>
          <button className={cx(noteCanvasUi.stickerControlButton, noteCanvasUi.stickerDeleteButton)} onClick={() => onDelete(sticker.id)} title="Remove">✕</button>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   COLOR PICKER POPUP
══════════════════════════════════════════════════════════════ */
function ColorPickerPopup({ current, onSelect, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    function h(e) { if (ref.current && !ref.current.contains(e.target)) onClose(); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);
  return (
    <div ref={ref} className={cx(noteCanvasUi.popup, noteCanvasUi.colorPicker)}>
      {PALETTE.map(c => (
        <button key={c} className={cx(noteCanvasUi.colorSwatch, current === c && noteCanvasUi.colorSwatchSelected)}
          style={{ background: c }} onClick={() => { onSelect(c); onClose(); }}/>
      ))}
      <label className={cx(noteCanvasUi.colorSwatch, noteCanvasUi.colorCustom)} title="Custom">
        🎨
        <input className="shrink-0" type="color" value={current || '#2563EB'} onChange={e => onSelect(e.target.value)}
          style={{ position:'absolute', inset:0, opacity:0, cursor:'pointer', width:'100%', height:'100%' }}/>
      </label>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   IMAGE SECTION CARD  (plain image — lives in the grid)
══════════════════════════════════════════════════════════════ */
function ImageSectionCard({ section, index, totalSections, editable, onSectionChange, onMoveUp, onMoveDown, onDelete, onReplaceRequest, onOpenImage, theme }) {
  const resizeDrag = useRef(null);
  const [cardRef, cardWidth] = useElementWidth();

  function onResizeDown(e) {
    e.preventDefault(); e.stopPropagation();
    resizeDrag.current = { sy: e.clientY, sh: section.height || 200 };
    document.addEventListener('pointermove', onResizeMove);
    document.addEventListener('pointerup', onResizeUp);
  }
  function onResizeMove(e) {
    if (!resizeDrag.current) return;
    const newH = Math.max(80, resizeDrag.current.sh + (e.clientY - resizeDrag.current.sy));
    onSectionChange('height', Math.round(newH));
  }
  function onResizeUp() {
    resizeDrag.current = null;
    document.removeEventListener('pointermove', onResizeMove);
    document.removeEventListener('pointerup', onResizeUp);
  }

  const span = section.span === 'single' ? 'half' : section.span || 'half';
  const isFullWidth = span === 'full';
  const imgHeight   = section.height || 200;
  const sizeLabel   = imageSizeLabel(section, imgHeight);
  const layoutSizeLabel = cardWidth ? `${cardWidth}x${imgHeight} px` : `${imgHeight}px high`;
  const imageFit = normalizeImageFit(section.imageFit);
  const imageRadius = editable ? 0 : 8;

  return (
    <div
      ref={cardRef}
      data-canvas-card
      className={cx(noteCanvasUi.section, noteCanvasUi.imageSection, isFullWidth && noteCanvasUi.imageFull)}
      style={{
        background: canvasCardBackground('#2563eb', theme),
      }}
    >
      {!editable && <MedicalMiniIcon index={index} color="#60A5FA" theme={theme} />}
      {editable && (
        <div className={noteCanvasUi.sectionActions}>
          <div style={{ display:'flex', gap:3 }}>
            <button className={noteCanvasUi.sectionButton} onClick={onMoveUp}  disabled={index === 0} title="Move up">↑</button>
            <button className={noteCanvasUi.sectionButton} onClick={onMoveDown} disabled={index === totalSections - 1} title="Move down">↓</button>
          </div>
          <div style={{ display:'flex', gap:3 }}>
            <button className={cx(noteCanvasUi.sectionButton, !isFullWidth && noteCanvasUi.sectionButtonOn)}
              style={{ fontSize:9, width:32 }} onClick={() => onSectionChange('span', 'half')} title="Half width">½</button>
            <button className={cx(noteCanvasUi.sectionButton, span === 'wide' && noteCanvasUi.sectionButtonOn)}
              style={{ fontSize:9, width:32 }} onClick={() => onSectionChange('span', 'wide')} title="Wide card">⅔</button>
            <button className={cx(noteCanvasUi.sectionButton, isFullWidth && noteCanvasUi.sectionButtonOn)}
              style={{ fontSize:9, width:32 }} onClick={() => onSectionChange('span', 'full')} title="Full width">⬛</button>
            <button className={noteCanvasUi.sectionButton} style={{ fontSize:10, width:32 }}
              onClick={() => onReplaceRequest(index)} title="Replace image">↺</button>
          </div>
          <button className={cx(noteCanvasUi.sectionButton, noteCanvasUi.sectionDeleteButton)} onClick={onDelete} title="Delete">✕</button>
        </div>
      )}

      {section.src ? (
        <div style={{ position:'relative', overflow:'hidden' }}>
          <button
            type="button"
            className={noteCanvasUi.imageOpenButton}
            onClick={() => onOpenImage?.({ src: section.src, caption: section.caption, sizeLabel: editable ? sizeLabel : '' })}
            title="Open image"
            style={{ borderRadius: imageRadius, ...imageSurfaceStyle(theme) }}
          >
            <img src={section.src} alt={section.caption || ''}
              width={section.imageWidth || undefined}
              height={section.imageHeight || undefined}
              style={responsiveImageStyle(section, imgHeight, editable, imageFit, imageRadius)}
              loading="lazy"
              decoding="async"
              draggable={false}/>
            {!editable && <span className={noteCanvasUi.imageExpandHint}><ExpandImageIcon /></span>}
            {editable && sizeLabel && <span className={noteCanvasUi.imageSizePill}>{sizeLabel}</span>}
          </button>
          {editable && (
            <>
              <ImageFitControls value={section.imageFit} onChange={v => onSectionChange('imageFit', v)} floating />
              <div className={noteCanvasUi.resizeHandle} onPointerDown={onResizeDown} title="Drag to resize height"><span/></div>
            </>
          )}
        </div>
      ) : (
        <div className={noteCanvasUi.imagePlaceholder} style={{ height: imgHeight }}
          onClick={() => editable && onReplaceRequest(index)}>
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <rect x="2" y="6" width="36" height="28" rx="4" stroke="currentColor" strokeWidth="1.8"/>
            <circle cx="13" cy="16" r="3.5" fill="currentColor" opacity="0.4"/>
            <path d="M2 30l10-10 7 7 6-8 13 14" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
          </svg>
          {editable && <span>Click to add image</span>}
          <span className="font-sans text-[10px] font-bold opacity-55">Layout: {layoutSizeLabel}</span>
        </div>
      )}

      {editable ? (
        <>
          <EField value={section.caption} onChange={v => onSectionChange('caption', v)}
            placeholder="Caption (optional)…"
            style={{ margin:'6px 10px', fontSize:12, color:'var(--ink-muted)', fontFamily:'inherit' }}/>
        </>
      ) : (
        section.caption && <p className={noteCanvasUi.imageCaption}>{section.caption}</p>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   IMAGE + EXPLANATION SECTION CARD
   Full-width block: image on top, detailed explanation below.
══════════════════════════════════════════════════════════════ */
function ImageExplainedSectionCard({ section, index, totalSections, editable, onSectionChange, onMoveUp, onMoveDown, onDelete, onReplaceRequest, onOpenImage, theme }) {
  const resizeDrag  = useRef(null);
  const [colorOpen, setColorOpen] = useState(false);
  const [cardRef, cardWidth] = useElementWidth();

  function onResizeDown(e) {
    e.preventDefault(); e.stopPropagation();
    resizeDrag.current = { sy: e.clientY, sh: section.height || 220 };
    document.addEventListener('pointermove', onResizeMove);
    document.addEventListener('pointerup', onResizeUp);
  }
  function onResizeMove(e) {
    if (!resizeDrag.current) return;
    const newH = Math.max(80, resizeDrag.current.sh + (e.clientY - resizeDrag.current.sy));
    onSectionChange('height', Math.round(newH));
  }
  function onResizeUp() {
    resizeDrag.current = null;
    document.removeEventListener('pointermove', onResizeMove);
    document.removeEventListener('pointerup', onResizeUp);
  }

  const span = section.span === 'single' ? 'half' : section.span || 'full';
  const isFullWidth  = span === 'full';
  const imgHeight    = section.height || 220;
  const accentColor  = section.accentColor || '#2563EB';
  const sizeLabel    = imageSizeLabel(section, imgHeight);
  const layoutSizeLabel = cardWidth ? `${cardWidth}x${imgHeight} px` : `${imgHeight}px high`;
  const imageFit = normalizeImageFit(section.imageFit);
  const imageRadius = editable ? 0 : '6px 6px 0 0';

  return (
    <div
      ref={cardRef}
      className={cx(noteCanvasUi.section, noteCanvasUi.imageSection, noteCanvasUi.imageExplained, isFullWidth && noteCanvasUi.imageFull)}
      data-canvas-card
      style={{
        background: canvasCardBackground(accentColor, theme),
      }}
    >

      {!editable && <MedicalMiniIcon index={index + 2} color={accentColor} theme={theme} />}
      {editable && (
        <div className={noteCanvasUi.sectionActions}>
          <div style={{ display:'flex', gap:3 }}>
            <button className={noteCanvasUi.sectionButton} onClick={onMoveUp}  disabled={index === 0} title="Move up">↑</button>
            <button className={noteCanvasUi.sectionButton} onClick={onMoveDown} disabled={index === totalSections - 1} title="Move down">↓</button>
          </div>
          <div style={{ display:'flex', gap:3, position:'relative' }}>
            <button className={cx(noteCanvasUi.sectionButton, isFullWidth && noteCanvasUi.sectionButtonOn)}
              style={{ fontSize:9, width:32 }} onClick={() => onSectionChange('span', 'full')} title="Full width">⬛</button>
            <button className={cx(noteCanvasUi.sectionButton, span === 'wide' && noteCanvasUi.sectionButtonOn)}
              style={{ fontSize:9, width:32 }} onClick={() => onSectionChange('span', 'wide')} title="Wide card">⅔</button>
            <button className={cx(noteCanvasUi.sectionButton, !isFullWidth && noteCanvasUi.sectionButtonOn)}
              style={{ fontSize:9, width:32 }} onClick={() => onSectionChange('span', 'half')} title="Half width">½</button>
            <button className={noteCanvasUi.sectionButton} style={{ fontSize:10, width:32 }}
              onClick={() => onReplaceRequest(index)} title="Replace image">↺</button>
            {/* Accent color */}
            <div style={{ position:'relative' }}>
              <button className={cx(noteCanvasUi.sectionButton, noteCanvasUi.colorSwatchButton)} style={{ background: accentColor }}
                onClick={() => setColorOpen(v => !v)} title="Block color"/>
              {colorOpen && (
                <ColorPickerPopup current={section.accentColor} onSelect={c => onSectionChange('accentColor', c)} onClose={() => setColorOpen(false)}/>
              )}
            </div>
          </div>
          <button className={cx(noteCanvasUi.sectionButton, noteCanvasUi.sectionDeleteButton)} onClick={onDelete} title="Delete">✕</button>
        </div>
      )}

      {/* ── Image ── */}
      {section.src ? (
        <div style={{ position:'relative', overflow:'hidden' }}>
          <button
            type="button"
            className={noteCanvasUi.imageOpenButton}
            onClick={() => onOpenImage?.({ src: section.src, caption: section.caption || 'Figure', sizeLabel: editable ? sizeLabel : '' })}
            title="Open image"
            style={{ borderRadius: imageRadius, ...imageSurfaceStyle(theme) }}
          >
            <img src={section.src} alt={section.caption || 'Figure'}
              width={section.imageWidth || undefined}
              height={section.imageHeight || undefined}
              style={responsiveImageStyle(section, imgHeight, editable, imageFit, imageRadius)}
              loading="lazy"
              decoding="async"
              draggable={false}/>
            {!editable && <span className={noteCanvasUi.imageExpandHint}><ExpandImageIcon /></span>}
            {editable && sizeLabel && <span className={noteCanvasUi.imageSizePill}>{sizeLabel}</span>}
          </button>
          {editable && (
            <>
              <ImageFitControls value={section.imageFit} onChange={v => onSectionChange('imageFit', v)} floating />
              <div className={noteCanvasUi.resizeHandle} onPointerDown={onResizeDown} title="Drag to resize height"><span/></div>
            </>
          )}
        </div>
      ) : (
        <div className={noteCanvasUi.imagePlaceholder} style={{ height: imgHeight, borderRadius: editable ? 0 : '6px 6px 0 0' }}
          onClick={() => editable && onReplaceRequest(index)}>
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <rect x="2" y="6" width="36" height="28" rx="4" stroke="currentColor" strokeWidth="1.8"/>
            <circle cx="13" cy="16" r="3.5" fill="currentColor" opacity="0.4"/>
            <path d="M2 30l10-10 7 7 6-8 13 14" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
          </svg>
          {editable && <span>Click to add image</span>}
          <span className="font-sans text-[10px] font-bold opacity-55">Layout: {layoutSizeLabel}</span>
        </div>
      )}

      {/* ── Explanation body ── */}
      <div className={noteCanvasUi.imgExplainedBody} style={{ borderTop: `2px solid ${accentColor}22` }}>
        {/* Figure label + caption */}
        <div className={noteCanvasUi.imgExplainedHead}>
          <span className={noteCanvasUi.imgFigureTag} style={{ background: accentColor + '22', color: accentColor }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink:0 }}>
              <rect x="1" y="1.5" width="10" height="7.5" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M1 7l3-2.5 2.5 2.5L9 4.5l2 3" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/>
              <circle cx="3.5" cy="4" r="1" fill="currentColor" opacity="0.6"/>
            </svg>
            Figure
          </span>
          {editable ? (
            <EField value={section.caption} onChange={v => onSectionChange('caption', v)}
              placeholder="Figure title / caption…"
              style={{ flex:1, fontSize:13, fontWeight:600, color:'var(--ink-strong)' }}/>
          ) : (
            section.caption && <span className={noteCanvasUi.imgExplainedCaption}>{section.caption}</span>
          )}
        </div>

        {/* Explanation paragraph */}
        {editable ? (
          <EArea
            value={section.explanation || ''}
            onChange={v => onSectionChange('explanation', v)}
            placeholder={`Explain what this image shows…\nUse ==highlight== for key terms and **bold** for emphasis.\ne.g. This diagram illustrates the renin-angiotensin-aldosterone pathway…`}
            className={noteCanvasUi.imgExplanationEdit}
            minRows={3}
          />
        ) : (
          section.explanation && (
            <div className={noteCanvasUi.imgExplanation}>
              {section.explanation.split('\n').filter(Boolean).map((line, i) => (
                <p key={i}><RichText text={line}/></p>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   INLINE IMAGE inside a text section
══════════════════════════════════════════════════════════════ */
const IMG_POSITIONS = [
  { key:'top',    label:'Top',   icon:'↑' },
  { key:'bottom', label:'Bottom',icon:'↓' },
  { key:'left',   label:'Left',  icon:'←' },
  { key:'right',  label:'Right', icon:'→' },
];

function SectionInlineImage({ image, editable, onChange, onAddRequest, onOpenImage, inline, theme }) {
  const resizeDrag = useRef(null);

  function onResizeDown(e) {
    e.preventDefault(); e.stopPropagation();
    resizeDrag.current = { sy: e.clientY, sh: image?.height || 180 };
    document.addEventListener('pointermove', onResizeMove);
    document.addEventListener('pointerup', onResizeUp);
  }
  function onResizeMove(e) {
    if (!resizeDrag.current) return;
    const newH = Math.max(60, resizeDrag.current.sh + (e.clientY - resizeDrag.current.sy));
    onChange({ ...image, height: Math.round(newH) });
  }
  function onResizeUp() {
    resizeDrag.current = null;
    document.removeEventListener('pointermove', onResizeMove);
    document.removeEventListener('pointerup', onResizeUp);
  }

  const h   = image?.height || 180;
  const pos = image?.position || 'bottom';
  const sizeLabel = imageSizeLabel(image, h);
  const imageFit = normalizeImageFit(image?.imageFit);
  const imageRadius = 8;

  if (!image?.src) return null;

  return (
    <div
      className={cx(noteCanvasUi.sectionImageWrap, inline && noteCanvasUi.sectionImageWrapInline)}
    >
      <div style={{ position:'relative', overflow:'hidden', borderRadius:imageRadius }}>
        <button
          type="button"
          className={noteCanvasUi.imageOpenButton}
          onClick={() => onOpenImage?.({ src: image.src, caption: image.caption, sizeLabel: editable ? sizeLabel : '' })}
          title="Open image"
          style={{ borderRadius:imageRadius, ...imageSurfaceStyle(theme) }}
        >
          <img
            src={image.src}
            alt={image.caption || ''}
            width={image.imageWidth || undefined}
            height={image.imageHeight || undefined}
            style={responsiveImageStyle(image, h, editable, imageFit, imageRadius)}
            loading="lazy"
            decoding="async"
            draggable={false}
          />
          {!editable && <span className={noteCanvasUi.imageExpandHint}><ExpandImageIcon /></span>}
          {editable && sizeLabel && <span className={noteCanvasUi.imageSizePill}>{sizeLabel}</span>}
        </button>
        {editable && (
          <>
            <ImageFitControls value={image.imageFit} onChange={v => onChange({ ...image, imageFit: v })} floating />
            <div className={noteCanvasUi.resizeHandle} onPointerDown={onResizeDown} title="Drag to resize height"><span/></div>
          </>
        )}
      </div>

      {editable ? (
        <>
          {/* Position controls + Replace/Remove */}
          <div className={noteCanvasUi.imageControlsBar}>
            <div className={noteCanvasUi.imagePosButtons}>
              {IMG_POSITIONS.map(p => (
                <button className={cx(noteCanvasUi.imagePosButton, pos === p.key && noteCanvasUi.imagePosButtonOn)}
                  key={p.key}
                 
                  onClick={() => onChange({ ...image, position: p.key })}
                  title={`Image ${p.label}`}
                >{p.icon} {p.label}</button>
              ))}
            </div>
            <div style={{ display:'flex', gap:4 }}>
              <button className={noteCanvasUi.imageSmallButton} onClick={onAddRequest} title="Replace image">↺</button>
              <button className={cx(noteCanvasUi.imageSmallButton, noteCanvasUi.imageDeleteButton)} onClick={() => onChange(null)} title="Remove image">✕</button>
            </div>
          </div>
          <EField
            value={image.caption}
            onChange={v => onChange({ ...image, caption: v })}
            placeholder="Caption…"
            style={{ marginTop:4, fontSize:11, color:'var(--ink-muted)' }}
          />
        </>
      ) : (
        image.caption && <p className={noteCanvasUi.imageCaption}>{image.caption}</p>
      )}
    </div>
  );
}

function MasonryItem({ children, span = 'half', columns = 2, editable = false, dragEnabled = editable, index, draggingIndex, onDragStart, onDragOver, onDrop, onDragEnd }) {
  const ref = useRef(null);
  const [rowSpan, setRowSpan] = useState(1);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;

    const update = () => {
      const height = el.getBoundingClientRect().height;
      const styles = window.getComputedStyle(el.parentElement || el);
      const rowGap = Number.parseFloat(styles.rowGap || styles.gap || '0') || 0;
      const rowHeight = 8;
      setRowSpan(Math.max(1, Math.ceil((height + rowGap) / (rowHeight + rowGap))));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [children]);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    el.classList.add('ncv-enter');
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        el.style.animationDelay = `${Math.min(index * 55, 330)}ms`;
        el.classList.remove('ncv-enter');
        el.classList.add('ncv-entered');
        obs.disconnect();
      },
      { threshold: 0.06, rootMargin: '0px 0px -20px 0px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [index]);

  const normalizedSpan = span === 'single' ? 'half' : span;
  const colSpan = normalizedSpan === 'full'
    ? '1 / -1'
    : normalizedSpan === 'wide'
      ? `span ${Math.min(2, columns)}`
      : 'span 1';

  return (
    <div
      ref={ref}
      className="ncv-item"
      draggable={dragEnabled}
      onDragStart={dragEnabled ? e => onDragStart?.(e, index) : undefined}
      onDragOver={dragEnabled ? e => onDragOver?.(e, index) : undefined}
      onDrop={dragEnabled ? e => onDrop?.(e, index) : undefined}
      onDragEnd={dragEnabled ? onDragEnd : undefined}
      title={dragEnabled ? 'Drag card to move it' : undefined}
      style={{
        gridColumn: colSpan,
        gridRowEnd: `span ${rowSpan}`,
        alignSelf: 'start',
        minWidth: 0,
        cursor: dragEnabled ? 'grab' : undefined,
        opacity: draggingIndex === index ? 0.45 : undefined,
        touchAction: editable && !dragEnabled ? 'manipulation' : undefined,
      }}
    >
      {children}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   TEXT SECTION CARD
══════════════════════════════════════════════════════════════ */
function SectionCard({ section, colorIndex, totalSections, colors, highlightColors, editable, onSectionChange, onMoveUp, onMoveDown, onDelete, onAddImageRequest, onOpenImage, theme }) {
  const [colorOpen, setColorOpen] = useState(false);
  const resizeDrag = useRef(null);
  const baseColor    = colors[colorIndex % colors.length] || '#A7D8FF';
  const accentColor  = section.accentColor || baseColor;
  const richColors    = highlightColors?.length ? highlightColors : colors;
  const headingColor = section.headingColor;
  const cardHeight = Number(section.height) || null;
  const span = section.span === 'single' ? 'half' : section.span || 'half';

  function onResizeDown(e) {
    e.preventDefault();
    e.stopPropagation();
    const card = e.currentTarget.closest('[data-canvas-card]');
    resizeDrag.current = { sy: e.clientY, sh: card?.offsetHeight || cardHeight || 180 };
    document.addEventListener('pointermove', onResizeMove);
    document.addEventListener('pointerup', onResizeUp);
  }
  function onResizeMove(e) {
    if (!resizeDrag.current) return;
    const nextHeight = Math.max(110, resizeDrag.current.sh + (e.clientY - resizeDrag.current.sy));
    onSectionChange('height', Math.round(nextHeight));
  }
  function onResizeUp() {
    resizeDrag.current = null;
    document.removeEventListener('pointermove', onResizeMove);
    document.removeEventListener('pointerup', onResizeUp);
  }

  return (
    <div
      data-canvas-card
      className={noteCanvasUi.section}
      style={{
        minHeight: cardHeight || undefined,
        background: canvasCardBackground(accentColor, theme),
      }}
    >
      {!editable && <MedicalMiniIcon index={colorIndex + 1} color={accentColor} theme={theme} />}
      {editable && (
        <div className={noteCanvasUi.sectionActions}>
          <div style={{ display:'flex', gap:3 }}>
            <button className={noteCanvasUi.sectionButton} onClick={onMoveUp}  disabled={colorIndex === 0}>↑</button>
            <button className={noteCanvasUi.sectionButton} onClick={onMoveDown} disabled={colorIndex === totalSections - 1}>↓</button>
          </div>
          <div style={{ display:'flex', gap:3, position:'relative' }}>
            <div style={{ position:'relative' }}>
              <button className={cx(noteCanvasUi.sectionButton, noteCanvasUi.colorSwatchButton)} style={{ background: accentColor }}
                onClick={() => setColorOpen(v => !v)} title="Section color"/>
              {colorOpen && (
                <ColorPickerPopup current={section.accentColor} onSelect={c => onSectionChange('accentColor', c)} onClose={() => setColorOpen(false)}/>
              )}
            </div>
            <label className={cx(noteCanvasUi.sectionButton, noteCanvasUi.fontColorButton)} title="Heading text color">
              <span style={{ fontWeight:800, color: headingColor || 'var(--ink-strong)' }}>A</span>
              <input className="shrink-0" type="color" value={headingColor || '#334155'} onChange={e => onSectionChange('headingColor', e.target.value)}
                style={{ position:'absolute', inset:0, opacity:0, cursor:'pointer', width:'100%', height:'100%' }}/>
            </label>
            <button className={cx(noteCanvasUi.sectionButton, span === 'half' && noteCanvasUi.sectionButtonOn)}
              style={{ fontSize:9, width:32 }} onClick={() => onSectionChange('span', 'half')} title="Small card">⅓</button>
            <button className={cx(noteCanvasUi.sectionButton, span === 'wide' && noteCanvasUi.sectionButtonOn)}
              style={{ fontSize:9, width:32 }} onClick={() => onSectionChange('span', 'wide')} title="Wide card">⅔</button>
            <button className={cx(noteCanvasUi.sectionButton, span === 'full' && noteCanvasUi.sectionButtonOn)}
              style={{ fontSize:9, width:32 }} onClick={() => onSectionChange('span', 'full')} title="Full width">⬛</button>
          </div>
          {/* Add / toggle inline image */}
          <button className={cx(noteCanvasUi.sectionButton, section.sectionImage?.src && noteCanvasUi.sectionButtonOn)}
           
            onClick={onAddImageRequest}
            title={section.sectionImage?.src ? 'Replace section image' : 'Add image to this block'}
            style={{ fontSize:13 }}
          >📷</button>
          <button className={cx(noteCanvasUi.sectionButton, noteCanvasUi.sectionDeleteButton)} onClick={onDelete}>✕</button>
        </div>
      )}

      <div className={noteCanvasUi.sectionHeading}>
        {editable
          ? <EField value={section.heading} onChange={v => onSectionChange('heading', v)}
              placeholder="Section heading" className={noteCanvasUi.headingText}
              style={{
                color: headingColor || accentColor,
                background: accentColor + '18',
                border: `1px solid ${accentColor}38`,
              }}/>
          : <h3
              className={noteCanvasUi.headingText}
              style={{
                color: headingColor || accentColor,
                background: accentColor + '18',
                border: `1px solid ${accentColor}38`,
              }}
            >
              {section.heading}
            </h3>}
      </div>

      {(() => {
        const imgPos  = section.sectionImage?.position || 'bottom';
        const hasImg  = !!section.sectionImage?.src;
        const isLR    = hasImg && (imgPos === 'left' || imgPos === 'right');

        const imgEl = (
          <SectionInlineImage
            image={section.sectionImage}
            editable={editable}
            onChange={img => onSectionChange('sectionImage', img)}
            onAddRequest={onAddImageRequest}
            onOpenImage={onOpenImage}
            inline={isLR}
            theme={theme}
          />
        );

        const textEl = (
          <div className={isLR ? noteCanvasUi.sectionTextCol : 'min-w-0'}>
            {editable ? (
              <BulletEditor
                bullets={section.bullets}
                accentColor={accentColor}
                onChange={next => onSectionChange('bullets', next)}
              />
            ) : (
              section.bullets?.length > 0 && <CheckableBulletList bullets={section.bullets} accentColor={accentColor} highlightColors={richColors} sectionKey={colorIndex}/>
            )}
            <div className={noteCanvasUi.sectionExtras}>
              {section.callout && (
                <div className={noteCanvasUi.callout} style={{ borderColor: accentColor + 'cc' }}>
                  <span className={noteCanvasUi.calloutArrow}>⚡</span>
                  {editable
                    ? <EField value={section.callout} onChange={v => onSectionChange('callout', v)} placeholder="Callout / EXAM TRAP…" style={{ flex:1 }}/>
                    : <CalloutContent text={section.callout} accentColor={accentColor} highlightColors={richColors} highlightIndex={colorIndex}/>}
                </div>
              )}
              {section.mnemonic && (
                <div className={noteCanvasUi.mnemonic}>
                  <div className={noteCanvasUi.mnemonicLabel}>MNEMONIC</div>
                  {editable
                    ? <EField value={section.mnemonic} onChange={v => onSectionChange('mnemonic', v)} placeholder="Mnemonic or acronym…" className={noteCanvasUi.mnemonicText}/>
                    : <div className={noteCanvasUi.mnemonicText}>{section.mnemonic}</div>}
                </div>
              )}
              {section.sticky_note && (
                <div
                  className={noteCanvasUi.sticky}
                  style={{
                    borderColor: accentColor + (theme === 'dark' ? '66' : 'cc'),
                    background: theme === 'dark' ? 'rgba(255,255,255,0.055)' : accentColor + '14',
                  }}
                >
                  <div className={noteCanvasUi.stickyPin}/>
                  {editable
                    ? <EArea value={section.sticky_note} onChange={v => onSectionChange('sticky_note', v)} placeholder="Sticky note…" className={noteCanvasUi.stickyText} style={{ background:'transparent' }}/>
                    : <p className={noteCanvasUi.stickyText}><RichText text={section.sticky_note} accentColor={accentColor} highlightColors={richColors} highlightIndex={colorIndex + 2}/></p>}
                </div>
              )}
            </div>
          </div>
        );

        if (isLR) {
          return (
            <div className={cx(noteCanvasUi.sectionBody, imgPos === 'left' ? noteCanvasUi.sectionBodyLeft : noteCanvasUi.sectionBodyRight)}>
              {imgPos === 'left' ? imgEl : null}
              {textEl}
              {imgPos === 'right' ? imgEl : null}
            </div>
          );
        }
        return (
          <div className={noteCanvasUi.sectionBody}>
            {imgPos === 'top' && imgEl}
            {textEl}
            {(!hasImg || imgPos === 'bottom') && imgEl}
          </div>
        );
      })()}
      {editable && (
        <div className={noteCanvasUi.resizeHandle} onPointerDown={onResizeDown} title="Drag to resize card height"><span/></div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   STICKER PICKER POPUP
══════════════════════════════════════════════════════════════ */
function StickerPicker({ onAdd, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    function h(e) { if (ref.current && !ref.current.contains(e.target)) onClose(); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);
  return (
    <div ref={ref} className={cx(noteCanvasUi.popup, noteCanvasUi.stickerPicker)}>
      {STICKER_TYPES.map(s => (
        <button key={s.id} className={noteCanvasUi.stickerButton} onClick={() => { onAdd(s.id); onClose(); }}>{s.emoji}</button>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   CANVAS TOOLBAR
══════════════════════════════════════════════════════════════ */
function CanvasToolbar({ data, onPatch, onAddTextSection, onAddImageSection, onAddImageExplained, onBgChange, onLayoutChange, onApplyLayoutPattern, onSmartArrange }) {
  const [stickerOpen,  setStickerOpen]  = useState(false);
  const [bgPickerOpen, setBgPickerOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!stickerOpen) return;
    function h(e) { if (ref.current && !ref.current.contains(e.target)) setStickerOpen(false); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [stickerOpen]);

  function addSticker(type) {
    const s = {
      id: `s-${Date.now()}`,
      type,
      x: 50 + Math.random() * 180,
      y: 40 + Math.random() * 100,
      size: 52,
      rotation: Math.round(Math.random() * 30 - 15),
    };
    onPatch({ canvasStickers: [...(data.canvasStickers || []), s] });
  }

  return (
    <div ref={ref} className={noteCanvasUi.toolbar}>
      <span className={noteCanvasUi.toolbarLabel}>Lesson Tools</span>
      <div className={noteCanvasUi.toolbarDivider}/>

      <button className={cx(ui.secondaryButton, noteCanvasUi.toolbarButton)} onClick={onAddTextSection}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
        Text Block
      </button>

      <button className={cx(ui.secondaryButton, noteCanvasUi.toolbarButton)} onClick={onAddImageSection}>
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <rect x="1" y="2" width="11" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
          <circle cx="4.5" cy="5.5" r="1.25" fill="currentColor" opacity="0.55"/>
          <path d="M1 10l3.5-3.5L7 9l2.5-3L12 10" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
        </svg>
        Image Block
      </button>

      {/* New: image + explanation block */}
      <button className={cx(ui.secondaryButton, noteCanvasUi.toolbarButton)} onClick={onAddImageExplained}>
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <rect x="1" y="1.5" width="11" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
          <circle cx="4" cy="4.5" r="1.1" fill="currentColor" opacity="0.55"/>
          <path d="M1 7l3-2.5 2 2 2.5-3L12 7" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/>
          <path d="M1.5 10h5M1.5 11.5h8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
        </svg>
        Image + Note
      </button>

      <button className={cx(ui.primaryButton, noteCanvasUi.toolbarButton)} onClick={onSmartArrange} title="AI-style layout based on card type and content">
        ✨ Smart Arrange
      </button>

      <div style={{ position:'relative' }}>
        <button className={cx(ui.secondaryButton, noteCanvasUi.toolbarButton)} onClick={() => setStickerOpen(v => !v)}>
          ✨ Sticker
        </button>
        {stickerOpen && <StickerPicker onAdd={addSticker} onClose={() => setStickerOpen(false)}/>}
      </div>

      <div style={{ position:'relative' }}>
        <button className={cx(ui.secondaryButton, noteCanvasUi.toolbarButton)} onClick={() => setBgPickerOpen(v => !v)}>
          <span className={noteCanvasUi.bgSwatch} style={{ background: data.canvasBg || '#FAFAF8' }}/>
          Background
        </button>
        {bgPickerOpen && (
          <ColorPickerPopup current={data.canvasBg} onSelect={c => { onBgChange(c); }} onClose={() => setBgPickerOpen(false)}/>
        )}
      </div>

      <div className={noteCanvasUi.toolbarDivider}/>

      {/* Layout toggle */}
      <div className={noteCanvasUi.layoutToggle}>
        <button className={cx(noteCanvasUi.layoutButton, (data.layout || '2col') === '1col' && noteCanvasUi.layoutButtonOn)}
         
          onClick={() => onLayoutChange('1col')}
          title="Single column"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="2" width="12" height="3.5" rx="1" fill="currentColor" opacity="0.85"/>
            <rect x="2" y="7" width="12" height="3.5" rx="1" fill="currentColor" opacity="0.85"/>
            <rect x="2" y="11.5" width="12" height="2.5" rx="1" fill="currentColor" opacity="0.55"/>
          </svg>
          1 Col
        </button>
        <button className={cx(noteCanvasUi.layoutButton, (data.layout || '2col') === '2col' && noteCanvasUi.layoutButtonOn)}
         
          onClick={() => onLayoutChange('2col')}
          title="Two columns"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="1"  y="2" width="6" height="12" rx="1.2" fill="currentColor" opacity="0.85"/>
            <rect x="9"  y="2" width="6" height="12" rx="1.2" fill="currentColor" opacity="0.85"/>
          </svg>
          2 Col
        </button>
        <button className={cx(noteCanvasUi.layoutButton, (data.layout || '2col') === '3col' && noteCanvasUi.layoutButtonOn)}
          onClick={() => onLayoutChange('3col')}
          title="Three columns"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="1" y="2" width="3.6" height="12" rx="1" fill="currentColor" opacity="0.85"/>
            <rect x="6.2" y="2" width="3.6" height="12" rx="1" fill="currentColor" opacity="0.85"/>
            <rect x="11.4" y="2" width="3.6" height="12" rx="1" fill="currentColor" opacity="0.85"/>
          </svg>
          3 Col
        </button>
      </div>

      <div className={noteCanvasUi.toolbarDivider}/>

      <div className={noteCanvasUi.layoutToggle}>
        {LAYOUT_PATTERNS.map(pattern => (
          <button className={cx(noteCanvasUi.layoutButton, data.layoutPattern === pattern.id && noteCanvasUi.layoutButtonOn)}
            key={pattern.id}
            onClick={() => onApplyLayoutPattern(pattern.id)}
            title={pattern.title}
          >
            {pattern.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   FIXED DECORATIVE STICKERS
══════════════════════════════════════════════════════════════ */
const DECO = [
  { id:'star',    svg:<svg viewBox="0 0 60 60" fill="none" width="52" height="52"><path d="M30 5l5.5 16H52l-13.5 9.8 5.2 16L30 37.5l-13.7 9.3 5.2-16L8 21h16.5L30 5z" fill="#FFE082" stroke="#F9A825" strokeWidth="1.5"/></svg>, style:{top:10,right:10,rotate:'18deg',opacity:0.8} },
  { id:'heart1',  svg:<svg viewBox="0 0 40 36" fill="none" width="36" height="32"><path d="M20 33S4 22 4 11a9 9 0 0 1 16-5.6A9 9 0 0 1 36 11C36 22 20 33 20 33z" fill="#FFCDD2" stroke="#E53935" strokeWidth="1.5"/></svg>, style:{top:105,left:6,rotate:'-15deg',opacity:0.85} },
  { id:'heart2',  svg:<svg viewBox="0 0 40 36" fill="none" width="30" height="26"><path d="M20 33S4 22 4 11a9 9 0 0 1 16-5.6A9 9 0 0 1 36 11C36 22 20 33 20 33z" fill="#FFCDD2" stroke="#E53935" strokeWidth="1.5"/></svg>, style:{bottom:110,right:6,rotate:'12deg',opacity:0.75} },
  { id:'pencil',  svg:<svg viewBox="0 0 60 60" fill="none" width="42" height="42"><rect x="12" y="10" width="12" height="36" rx="3" transform="rotate(-30 12 10)" fill="#FFF9C4" stroke="#F9A825" strokeWidth="1.5"/><path d="M10 44l-4 8 8-2-4-6z" fill="#F9A825"/><rect x="10" y="10" width="12" height="6" rx="2" transform="rotate(-30 10 10)" fill="#FFCC02"/></svg>, style:{bottom:85,left:6,rotate:'25deg',opacity:0.65} },
  { id:'sparkle', svg:<svg viewBox="0 0 40 40" fill="none" width="34" height="34"><path d="M20 4l2.5 13.5L36 20l-13.5 2.5L20 36l-2.5-13.5L4 20l13.5-2.5L20 4z" fill="#B3E5FC" stroke="#0288D1" strokeWidth="1.2"/></svg>, style:{top:95,right:4,rotate:'-8deg',opacity:0.7} },
];
function DecoStickers() {
  return (
    <>
      {DECO.map(s => (
        <div key={s.id} style={{ position:'absolute', ...s.style, transform:`rotate(${s.style.rotate})`, pointerEvents:'none', zIndex:2, filter:'drop-shadow(0 2px 4px rgba(0,0,0,0.12))' }}>
          {s.svg}
        </div>
      ))}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN CANVAS
══════════════════════════════════════════════════════════════ */
export const NoteCanvas = memo(forwardRef(function NoteCanvas({ data, editable = false, onDataChange }, ref) {
  const theme    = useThemeStore(s => s.theme);
  const colors   = theme === 'dark' ? DARK_COLORS : LIGHT_COLORS;
  const highlightColors = normalizeVisualStyleColors(data?.visual_style?.colors);
  const sections = data.sections || [];
  const layout = data.layout || '2col';
  const firstTextSectionIndex = sections.findIndex(section => section.type !== 'image' && section.type !== 'image-explained');
  const viewportWidth = useViewportWidth();
  const isMobileCanvas = viewportWidth <= 700;
  const columnCount = isMobileCanvas ? 1 : layout === '1col' ? 1 : layout === '3col' ? 3 : 2;

  const [selectedSticker, setSelectedSticker] = useState(null);
  const [compressing,     setCompressing]     = useState(false);
  const [draggingIndex,   setDraggingIndex]   = useState(null);
  const [focusMode,       setFocusMode]       = useState(false);
  const [lightboxImage,   setLightboxImage]   = useState(null);

  /* Hidden file inputs */
  const addImgRef      = useRef(null);
  const replaceImgRef  = useRef(null);
  const sectImgRef     = useRef(null); // for inline-image inside a text section
  const replaceIdxRef  = useRef(null);
  const sectImgIdxRef  = useRef(null); // which text section gets the inline image
  const addImgTypeRef  = useRef('image'); // 'image' | 'image-explained'
  const canvasRef      = useRef(null);
  const subjectLabel = data.subject || data.subtitle || '';
  const rawTags = Array.isArray(data.tags)
    ? data.tags
    : Array.isArray(data.keywords)
      ? data.keywords
      : subjectLabel
        ? [subjectLabel]
        : [];
  const canvasTags = rawTags.map(tag => String(tag).replace(/^#/, '').trim()).filter(Boolean).slice(0, 3);

  function setRefs(el) {
    canvasRef.current = el;
    if (typeof ref === 'function') ref(el);
    else if (ref) ref.current = el;
  }

  function handleCanvasClick() {
    if (editable) setSelectedSticker(null);
  }

  /* ── patch helpers ─────────────────────────────────────── */
  function patch(updates) { onDataChange?.({ ...data, ...updates }); }

  function patchSection(idx, field, value) {
    patch({ sections: sections.map((s, i) => i === idx ? { ...s, [field]: value } : s) });
  }

  function patchKeyPoint(idx, value) {
    const kp = [...(data.key_points || [])]; kp[idx] = value; patch({ key_points: kp });
  }

  function openImageLightbox(image) {
    if (!image?.src) return;
    setLightboxImage(image);
  }

  /* ── section management ────────────────────────────────── */
  function addTextSection() {
    patch({ sections: [...sections, { heading:'New Section', bullets:['Enter your content here'], callout:'', mnemonic:'', sticky_note:'' }] });
  }

  function addImageSection(src = '', meta = {}) {
    patch({ sections: [...sections, { type:'image', src, caption:'', span:'half', height:200, imageFit:'contain', ...meta }] });
  }

  function addImageExplainedSection(src = '', meta = {}) {
    patch({ sections: [...sections, { type:'image-explained', src, caption:'', explanation:'', span:'full', height:220, accentColor:'', imageFit:'contain', ...meta }] });
  }

  function deleteSection(idx) {
    patch({ sections: sections.filter((_, i) => i !== idx) });
  }

  function moveSection(idx, dir) {
    const a = [...sections], swap = idx + dir;
    if (swap < 0 || swap >= a.length) return;
    [a[idx], a[swap]] = [a[swap], a[idx]];
    patch({ sections: a });
  }

  function reorderSection(from, to) {
    if (from == null || to == null || from === to) return;
    const next = [...sections];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    patch({ sections: next });
  }

  function applyLayoutPattern(patternId) {
    const pattern = LAYOUT_PATTERNS.find(item => item.id === patternId);
    if (!pattern) return;
    let nextSections = sections.map((section, index) => ({
      ...section,
      span: pattern.spans[index % pattern.spans.length],
    }));

    if (pattern.columns === '2col' && nextSections.length % 2 === 1) {
      nextSections = nextSections.map((section, index) => (
        index === nextSections.length - 1 ? { ...section, span: 'wide' } : section
      ));
    }

    if (pattern.columns === '3col') {
      nextSections = packSmartRows(nextSections.map(section => ({
        section,
        span: section.span,
        weight: estimateSectionWeight(section),
      }))).map(item => ({ ...item.section, span: item.span }));
    }

    patch({
      layout: pattern.columns,
      layoutPattern: pattern.id,
      sections: nextSections,
    });
  }

  function smartArrangeCanvas() {
    patch({
      layout: '3col',
      layoutPattern: 'smart',
      sections: smartArrangeSections(sections),
    });
  }

  function handleCardDragStart(e, idx) {
    if (!editable) return;
    if (e.target?.closest?.('input, textarea, button, label, select')) {
      e.preventDefault();
      return;
    }
    setDraggingIndex(idx);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(idx));
  }

  function handleCardDragOver(e) {
    if (draggingIndex == null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function handleCardDrop(e, idx) {
    e.preventDefault();
    const from = Number(e.dataTransfer.getData('text/plain'));
    reorderSection(Number.isFinite(from) ? from : draggingIndex, idx);
    setDraggingIndex(null);
  }

  /* ── image file handling (with compression) ────────────── */
  async function handleAddImage(e) {
    const file = e.target.files?.[0]; if (!file) return;
    e.target.value = '';
    setCompressing(true);
    try {
      const image = await compressImage(file);
      if (addImgTypeRef.current === 'image-explained') {
        addImageExplainedSection(image.src, { imageWidth: image.imageWidth, imageHeight: image.imageHeight });
      } else {
        addImageSection(image.src, { imageWidth: image.imageWidth, imageHeight: image.imageHeight });
      }
    } catch {
      /* fall back to raw data URL if compression fails */
      const image = await readFileAsImage(file);
      if (addImgTypeRef.current === 'image-explained') addImageExplainedSection(image.src, { imageWidth: image.imageWidth, imageHeight: image.imageHeight });
      else addImageSection(image.src, { imageWidth: image.imageWidth, imageHeight: image.imageHeight });
    } finally {
      setCompressing(false);
    }
  }

  async function handleReplaceImage(e) {
    const file = e.target.files?.[0]; if (!file) return;
    const idx = replaceIdxRef.current;
    e.target.value = '';
    setCompressing(true);
    try {
      const image = await compressImage(file);
      patch({ sections: sections.map((s, i) => i === idx ? { ...s, src: image.src, imageWidth: image.imageWidth, imageHeight: image.imageHeight } : s) });
    } catch {
      const image = await readFileAsImage(file);
      patch({ sections: sections.map((s, i) => i === idx ? { ...s, src: image.src, imageWidth: image.imageWidth, imageHeight: image.imageHeight } : s) });
    } finally {
      replaceIdxRef.current = null;
      setCompressing(false);
    }
  }

  function requestReplace(idx) {
    replaceIdxRef.current = idx;
    replaceImgRef.current?.click();
  }

  /* ── section inline image ──────────────────────────────── */
  async function handleSectionImage(e) {
    const file = e.target.files?.[0]; if (!file) return;
    const idx = sectImgIdxRef.current;
    e.target.value = '';
    setCompressing(true);
    try {
      const image = await compressImage(file);
      patchSection(idx, 'sectionImage', { src: image.src, imageWidth: image.imageWidth, imageHeight: image.imageHeight, caption: sections[idx]?.sectionImage?.caption || '', height: sections[idx]?.sectionImage?.height || 180, imageFit: sections[idx]?.sectionImage?.imageFit || 'contain' });
    } catch {
      const image = await readFileAsImage(file);
      patchSection(idx, 'sectionImage', { src: image.src, imageWidth: image.imageWidth, imageHeight: image.imageHeight, caption: '', height: 180, imageFit: 'contain' });
    } finally {
      sectImgIdxRef.current = null;
      setCompressing(false);
    }
  }

  function requestSectionImage(idx) {
    sectImgIdxRef.current = idx;
    sectImgRef.current?.click();
  }

  /* ── sticker management ────────────────────────────────── */
  function updateSticker(updated) {
    patch({ canvasStickers: (data.canvasStickers || []).map(s => s.id === updated.id ? updated : s) });
  }
  function deleteSticker(id) {
    setSelectedSticker(null);
    patch({ canvasStickers: (data.canvasStickers || []).filter(s => s.id !== id) });
  }

  /* ── canvas background ─────────────────────────────────── */
  const canvasStyle = data.canvasBg ? {
    backgroundColor: data.canvasBg,
    backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.045) 1.5px, transparent 1.5px)',
    backgroundSize: '22px 22px',
  } : {};

  return (
    <div className={cx(noteCanvasUi.wrapOuter, 'lms-ai-canvas-editor', editable && 'is-editable')}>

      <input className="shrink-0" ref={addImgRef}     type="file" accept="image/*" style={{ display:'none' }} onChange={handleAddImage}/>
      <input className="shrink-0" ref={replaceImgRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handleReplaceImage}/>
      <input className="shrink-0" ref={sectImgRef}    type="file" accept="image/*" style={{ display:'none' }} onChange={handleSectionImage}/>

      {editable && (
        <CanvasToolbar
          data={data}
          onPatch={patch}
          onAddTextSection={addTextSection}
          onAddImageSection={() => addImageSection('')}
          onAddImageExplained={() => addImageExplainedSection('')}
          onBgChange={c => patch({ canvasBg: c })}
          onLayoutChange={col => patch({ layout: col })}
          onApplyLayoutPattern={applyLayoutPattern}
          onSmartArrange={smartArrangeCanvas}
        />
      )}

      {compressing && (
        <div className={noteCanvasUi.compressToast}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className={noteCanvasUi.compressSpin}>
            <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="22 12"/>
          </svg>
          Compressing image…
        </div>
      )}

      <div
        ref={setRefs}
        className={cx(noteCanvasUi.canvas, 'lms-ai-canvas-surface', editable && noteCanvasUi.editable, focusMode && 'focus-canvas')}
        data-lms-note-canvas="true"
        style={canvasStyle}
        onClick={handleCanvasClick}
      >
        <DecoStickers/>

        {(data.canvasStickers || []).map(sticker => (
          <UserSticker
            key={sticker.id}
            sticker={sticker}
            editable={editable}
            selected={selectedSticker === sticker.id}
            onSelect={id => setSelectedSticker(id)}
            onUpdate={updateSticker}
            onDelete={deleteSticker}
            canvasRef={canvasRef}
          />
        ))}

        {editable && (
          <button className={noteCanvasUi.smartArrangeFab} type="button" onClick={smartArrangeCanvas} title="Re-arrange cards after adding text or images">
            ✨ Smart Arrange
          </button>
        )}

        <div className={noteCanvasUi.header}>
          <div className={noteCanvasUi.headerInner}>
            <div className={noteCanvasUi.titleCluster}>
              <div className={noteCanvasUi.titleRow}>
                {editable && <span className={noteCanvasUi.leafMark}>🍃</span>}
                {editable
                  ? <EField value={data.title} onChange={v => patch({ title:v })} placeholder="Lesson title…" className={noteCanvasUi.title}/>
                  : (
                    <h1 className={cx(noteCanvasUi.title, noteCanvasUi.titleReadOnly)}>
                      <span>{data.title}</span>
                    </h1>
                  )}
                {editable
                  ? <EField
                      value={data.subtitle}
                      onChange={v => patch({ subtitle:v })}
                      placeholder="Subject…"
                      className={noteCanvasUi.subtitle}
                      style={{ width:'auto', minWidth:110 }}
                    />
                  : null}
              </div>
            </div>

            {editable && canvasTags.length > 0 && (
              <div className={noteCanvasUi.metaStack}>
                <div className={noteCanvasUi.metaItem}>
                  <span className={noteCanvasUi.metaIcon}>🏷</span>
                  <div className={noteCanvasUi.tagRow}>
                    {canvasTags.map(tag => <span key={tag} className={noteCanvasUi.tag}>#{tag}</span>)}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {sections.length > 0 && (
          <div
            className={cx(noteCanvasUi.sectionGrid, layout === '1col' && noteCanvasUi.sectionGridOne)}
            style={{
              gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
              gap: isMobileCanvas ? 10 : undefined,
              gridAutoRows: '8px',
              gridAutoFlow: 'dense',
              alignItems: 'start',
            }}
          >
            {sections.map((section, i) => {
              if (section.type === 'image') {
                return (
                  <MasonryItem
                    key={i}
                    span={section.span || 'half'}
                    columns={columnCount}
                    editable={editable}
                    dragEnabled={editable && !isMobileCanvas}
                    index={i}
                    draggingIndex={draggingIndex}
                    onDragStart={handleCardDragStart}
                    onDragOver={handleCardDragOver}
                    onDrop={handleCardDrop}
                    onDragEnd={() => setDraggingIndex(null)}
                  >
                    <ImageSectionCard
                      section={section}
                      index={i}
                      totalSections={sections.length}
                      editable={editable}
                      onSectionChange={(field, val) => patchSection(i, field, val)}
                      onMoveUp={() => moveSection(i, -1)}
                      onMoveDown={() => moveSection(i, 1)}
                      onDelete={() => deleteSection(i)}
                      onReplaceRequest={requestReplace}
                      onOpenImage={openImageLightbox}
                      theme={theme}
                    />
                  </MasonryItem>
                );
              }
              if (section.type === 'image-explained') {
                return (
                  <MasonryItem
                    key={i}
                    span={section.span || 'full'}
                    columns={columnCount}
                    editable={editable}
                    dragEnabled={editable && !isMobileCanvas}
                    index={i}
                    draggingIndex={draggingIndex}
                    onDragStart={handleCardDragStart}
                    onDragOver={handleCardDragOver}
                    onDrop={handleCardDrop}
                    onDragEnd={() => setDraggingIndex(null)}
                  >
                    <ImageExplainedSectionCard
                      section={section}
                      index={i}
                      totalSections={sections.length}
                      editable={editable}
                      onSectionChange={(field, val) => patchSection(i, field, val)}
                      onMoveUp={() => moveSection(i, -1)}
                      onMoveDown={() => moveSection(i, 1)}
                      onDelete={() => deleteSection(i)}
                      onReplaceRequest={requestReplace}
                      onOpenImage={openImageLightbox}
                      theme={theme}
                    />
                  </MasonryItem>
                );
              }
              return (
                <MasonryItem
                  key={i}
                  span={!editable && i === firstTextSectionIndex ? 'full' : section.span || 'half'}
                  columns={columnCount}
                  editable={editable}
                  dragEnabled={editable && !isMobileCanvas}
                  index={i}
                  draggingIndex={draggingIndex}
                  onDragStart={handleCardDragStart}
                  onDragOver={handleCardDragOver}
                  onDrop={handleCardDrop}
                  onDragEnd={() => setDraggingIndex(null)}
                >
                  <SectionCard
                    section={section}
                    colorIndex={i}
                    totalSections={sections.length}
                    colors={colors}
                    highlightColors={highlightColors}
                    editable={editable}
                    onSectionChange={(field, val) => patchSection(i, field, val)}
                    onMoveUp={() => moveSection(i, -1)}
                    onMoveDown={() => moveSection(i, 1)}
                    onDelete={() => deleteSection(i)}
                    onAddImageRequest={() => requestSectionImage(i)}
                    onOpenImage={openImageLightbox}
                    theme={theme}
                  />
                </MasonryItem>
              );
            })}
          </div>
        )}

        {data.key_points?.length > 0 && (
          <div
            className={noteCanvasUi.keyPoints}
            style={{
              background: dottedCardBackground('#f59e0b', theme, theme === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(255,247,230,0.82)'),
              backgroundSize: 'auto, auto, 18px 18px, auto',
            }}
          >
            {!editable && <MedicalMiniIcon index={sections.length + 3} color="#f59e0b" theme={theme} />}
            <div className={noteCanvasUi.keyPointsLabel}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1L8.5 5H13L9.5 7.5L11 12L7 9.5L3 12L4.5 7.5L1 5H5.5L7 1Z" fill="currentColor"/>
              </svg>
              Key Exam Points
            </div>
            <div className={noteCanvasUi.keyPointsList}>
              {data.key_points.map((pt, i) => (
                editable ? (
                  <EField key={i} value={pt} onChange={v => patchKeyPoint(i, v)}
                    className={cx(noteCanvasUi.keyChip, noteCanvasUi.keyChipEdit)}
                    style={{ background: `${colors[i % colors.length]}${theme === 'dark' ? '30' : '24'}` }}/>
                ) : (
                  <div key={i} className={noteCanvasUi.keyChip} style={{ background: `${colors[i % colors.length]}${theme === 'dark' ? '30' : '24'}` }}>
                    <RichText text={pt} highlightColors={highlightColors} accentColor={colors[i % colors.length]} highlightIndex={i}/>
                  </div>
                )
              ))}
            </div>
          </div>
        )}

        {(data.summary_box || editable) && (
          <div
            className={noteCanvasUi.summary}
            style={{
              background: dottedCardBackground('#0891b2', theme, theme === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(236,254,255,0.82)'),
              backgroundSize: 'auto, auto, 18px 18px, auto',
            }}
          >
            {!editable && <MedicalMiniIcon index={sections.length + 5} color="#0891b2" theme={theme} />}
            <div className={noteCanvasUi.summaryLabel}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <rect x="1" y="1" width="11" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M3.5 4.5h6M3.5 6.5h4.5M3.5 8.5h5.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
              </svg>
              Summary
            </div>
            {editable
              ? <EArea value={data.summary_box} onChange={v => patch({ summary_box:v })} placeholder="Summary (use · or | to separate fragments)…"/>
              : <SummaryFragments text={data.summary_box} highlightColors={highlightColors} accentColor="#0891b2"/>}
          </div>
        )}

      </div>

      {lightboxImage && <ImageLightbox image={lightboxImage} onClose={() => setLightboxImage(null)} />}
    </div>
  );
}));
