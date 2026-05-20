/* ============================================================
   ERPM Medical LMS — Design Composition Library
   Pre-composed Tailwind class strings for consistent UI
   ============================================================ */

// ── Base compositions ────────────────────────────────────────

const secondaryButtonBase =
  'inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-full border border-line-medium bg-[var(--btn-secondary-bg)] px-[18px] text-sm font-extrabold text-ink-medium no-underline shadow-none transition-[background,border-color,color,opacity,transform] duration-150 ease-[var(--ease-out)] hover:border-brand-primary/28 hover:bg-[var(--color-primary-light)] hover:text-brand-primary active:scale-[0.98] active:opacity-85 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-primary/18 disabled:cursor-not-allowed disabled:scale-100 disabled:opacity-50 disabled:shadow-none max-[520px]:w-full';

const cardBase =
  'glass-card relative w-full max-w-full overflow-hidden text-ink-strong';

const interactiveCard =
  `${cardBase} transition-[background,border-color,box-shadow] duration-150 ease-[var(--ease-out)] hover:border-brand-primary/20 hover:shadow-sm active:shadow-none`;

// ── Exports ──────────────────────────────────────────────────

export const ui = {

  // ── Layout ────────────────────────────────────────────────
  screenShell:
    'lms-route-page page page-wrapper page-content app-content w-full max-w-full min-w-0 overflow-x-hidden px-page-x pb-page-y pt-page-y text-ink-strong max-[520px]:px-3.5 max-[520px]:pb-[var(--lms-mobile-content-bottom)] max-[520px]:pt-3.5',
  studentScreenShell:
    'student-route-page min-h-dvh w-full max-w-full min-w-0 overflow-x-hidden text-ink-strong',
  managementLayout:
    'management-layout mx-auto grid w-full max-w-page min-w-0 gap-section max-[520px]:gap-4',
  studentManagementLayout:
    'study-hub-shell management-layout grid grid-cols-1 min-w-0 gap-section max-[520px]:gap-4',
  managementGrid:
    'grid gap-section',
  routeScene:
    'relative isolate min-h-dvh overflow-x-hidden animate-routeFade',
  authRouteScene:
    'auth-route-scene animate-authRouteFade',
  panelRouteScene:
    'min-h-full overflow-x-hidden',
  fadePop:
    'animate-fadePop',
  aiGeneratorGrid:
    'grid gap-section [grid-template-columns:minmax(0,1fr)_minmax(320px,440px)] items-start max-[900px]:grid-cols-1',

  // ── Typography ────────────────────────────────────────────
  eyebrow:
    'inline-block text-[10.5px] font-extrabold uppercase tracking-[0.13em] text-brand-primary opacity-90',
  sectionTitle:
    'm-0 text-[17px] font-extrabold leading-tight text-ink-strong',
  panelTitle:
    'm-0 text-[16px] font-extrabold text-ink-strong',
  panelText:
    'm-0 text-[13px] leading-relaxed text-ink-soft',
  dashboardCardTitle:
    'my-1 mb-2 font-display text-[17px] font-extrabold leading-snug tracking-[-0.01em] text-ink-strong',
  dashboardCardText:
    'm-0 mb-4 text-[13px] leading-relaxed text-ink-soft',
  placeholderKicker:
    'mb-3.5 inline-block rounded-full border border-brand-primary/14 bg-[var(--color-primary-light)] px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-brand-primary',
  placeholderTitle:
    'm-0 mb-3 font-display text-[clamp(26px,4vw,46px)] font-extrabold leading-[1.08] tracking-[-0.02em] text-ink-strong',
  placeholderText:
    'm-0 text-[15px] leading-relaxed text-ink-soft',

  // ── Dashboard grids ───────────────────────────────────────
  dashboardGrid:
    'grid grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] gap-ui-3 max-[520px]:gap-3',
  dashboardCardGrid:
    'grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-ui-3 max-[520px]:gap-3',
  dashboardCardStack:
    'flex flex-col gap-3',
  dashboardMetricStrip:
    'my-1',
  dashboardMetricGrid:
    'grid grid-cols-[repeat(auto-fit,minmax(min(100%,190px),1fr))] gap-4 max-[520px]:gap-3',
  dashboardMetricGridFour:
    'grid-cols-4 max-[760px]:grid-cols-2 max-[440px]:grid-cols-1',

  // ── Cards ─────────────────────────────────────────────────
  dashboardCard:
    `${interactiveCard} p-ui-3 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:rounded-t-2xl before:bg-[linear-gradient(90deg,transparent_0%,color-mix(in_srgb,var(--color-primary)_32%,transparent)_40%,color-mix(in_srgb,var(--color-secondary)_20%,transparent)_80%,transparent_100%)] before:opacity-55 before:content-[""]`,
  dashboardCardPremium:
    'relative border-brand-primary/14 bg-[linear-gradient(160deg,color-mix(in_srgb,var(--color-primary)_4.5%,var(--surface-card)),var(--surface-card))]',
  metricCard:
    `${interactiveCard} p-[18px_20px_16px] overflow-hidden`,
  metricCardPremium:
    'p-[20px_22px_18px]',
  metricCardBlue:
    'border-l-[3px] border-l-brand-primary bg-[linear-gradient(150deg,rgba(37,99,235,0.055)_0%,transparent_50%),var(--surface-card)]',
  metricCardTeal:
    'border-l-[3px] border-l-sky-500 bg-[linear-gradient(150deg,rgba(14,165,233,0.055)_0%,transparent_50%),var(--surface-card)]',
  metricCardSlate:
    'border-l-[3px] border-l-brand-indigo bg-[linear-gradient(150deg,rgba(67,56,202,0.055)_0%,transparent_50%),var(--surface-card)]',
  metricCardViolet:
    'border-l-[3px] border-l-brand-violet bg-[linear-gradient(150deg,rgba(124,58,237,0.055)_0%,transparent_50%),var(--surface-card)]',
  glassCard:
    'glass-card w-[min(720px,100%)] p-9 max-[520px]:p-4',
  pageCard:
    `${cardBase} mx-auto max-w-[800px] p-ui-5 max-[640px]:p-ui-3`,
  panelCard:
    `${cardBase} p-card`,
  compactPanelCard:
    `${cardBase} p-ui-2`,
  featureCard:
    `${interactiveCard} p-ui-3 before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:rounded-t-2xl before:bg-[var(--brand-gradient-primary)] before:opacity-45 before:content-[""]`,
  questionCard:
    `${interactiveCard} border-l-[3px] border-l-brand-primary p-ui-3`,
  quizCard:
    `${interactiveCard} border-brand-primary/15 bg-[linear-gradient(160deg,color-mix(in_srgb,var(--color-primary)_4%,var(--surface-card)),var(--surface-card))] p-ui-3`,
  listCard:
    `${cardBase} border-line-soft bg-surface-card p-ui-2`,
  lockedCard:
    `${cardBase} border-brand-secondary/18 bg-[linear-gradient(145deg,color-mix(in_srgb,var(--color-secondary)_4%,var(--surface-card)),var(--surface-card))] p-ui-3 shadow-md`,
  infoCard:
    'rounded-[var(--radius-md)] border border-brand-accent/20 bg-[color-mix(in_srgb,var(--color-accent-light)_64%,var(--surface-card))] p-ui-2 text-[13px] leading-relaxed text-ink-medium shadow-xs',

  // ── Skeleton / loading compositions ───────────────────────
  skeletonLine:
    'skeleton-pulse rounded-md',
  skeletonBlock:
    'skeleton-pulse rounded-xl',
  skeletonCircle:
    'skeleton-pulse rounded-full',
  skeletonCard:
    'glass-card skeleton-pulse overflow-hidden p-5',
  // Dashboard skeleton grid — 4 metric cards
  skeletonMetricGrid:
    'grid grid-cols-4 gap-4 max-[760px]:grid-cols-2',
  // Dashboard skeleton content grid
  skeletonContentGrid:
    'grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-ui-3',

  // ── Panels ────────────────────────────────────────────────
  panelTop:
    'mb-4 flex min-w-0 items-start justify-between gap-3 max-[720px]:flex-col [&_h2]:m-0 [&_h2]:text-[17px] [&_h2]:font-extrabold [&_h2]:text-ink-strong [&_p]:m-0 [&_p]:mt-1 [&_p]:text-[13px] [&_p]:leading-relaxed [&_p]:text-ink-soft',
  compactPanel:
    'p-[var(--card-pad-compact)]',

  // ── Buttons ───────────────────────────────────────────────
  primaryAction:
    'inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-full border border-brand-primary/18 bg-[var(--color-primary-light)] px-[18px] text-sm font-extrabold text-brand-primary no-underline shadow-none transition-[background,border-color,color,opacity,transform] duration-150 ease-[var(--ease-out)] hover:border-brand-primary/32 hover:bg-[color-mix(in_srgb,var(--color-primary)_14%,transparent)] active:scale-[0.98] active:opacity-85 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-primary/22 disabled:cursor-not-allowed disabled:scale-100 disabled:opacity-50 disabled:shadow-none max-[520px]:w-full',
  primaryButton:
    'inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-full border border-brand-primary/18 bg-[var(--color-primary-light)] px-[18px] text-sm font-extrabold text-brand-primary no-underline shadow-none transition-[background,border-color,color,opacity,transform] duration-150 ease-[var(--ease-out)] hover:border-brand-primary/32 hover:bg-[color-mix(in_srgb,var(--color-primary)_14%,transparent)] active:scale-[0.98] active:opacity-85 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-primary/22 disabled:cursor-not-allowed disabled:scale-100 disabled:opacity-50 disabled:shadow-none max-[520px]:w-full',
  secondaryAction:
    secondaryButtonBase,
  secondaryButton:
    secondaryButtonBase,
  dangerAction:
    'inline-flex min-h-[var(--control-h)] items-center justify-center gap-2 rounded-full border border-brand-error/22 bg-brand-error/8 px-[18px] text-sm font-extrabold text-brand-error no-underline shadow-xs transition-[transform,box-shadow,background,border-color] duration-150 ease-[var(--ease-out)] hover:-translate-y-px hover:border-brand-error/34 hover:bg-brand-error/12 hover:shadow-[0_8px_18px_rgba(220,38,38,0.12)] active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-error/18 disabled:cursor-not-allowed disabled:translate-y-0 disabled:scale-100 disabled:opacity-50 disabled:shadow-none',
  ghostAction:
    'inline-flex min-h-[var(--control-h)] items-center justify-center gap-2 rounded-full border border-transparent bg-transparent px-[18px] text-sm font-extrabold text-ink-soft no-underline shadow-none transition-[transform,background,color] duration-150 ease-[var(--ease-out)] hover:-translate-y-px hover:bg-surface-2 hover:text-ink-strong active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-primary/18 disabled:cursor-not-allowed disabled:scale-100 disabled:opacity-50',
  successAction:
    'inline-flex min-h-[var(--control-h)] items-center justify-center gap-2 rounded-full border border-brand-success/22 bg-[var(--color-success-light)] px-[18px] text-sm font-extrabold text-brand-success no-underline shadow-xs transition-[transform,box-shadow,background,border-color] duration-150 ease-out hover:-translate-y-px hover:border-brand-success/34 hover:shadow-[0_8px_18px_rgba(5,150,105,0.12)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-success/18 disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-50 disabled:shadow-none',
  premiumAction:
    'inline-flex min-h-[var(--control-h)] items-center justify-center gap-2 rounded-full border border-brand-secondary/22 bg-brand-secondary/10 px-[18px] text-sm font-extrabold text-brand-secondary no-underline shadow-xs transition-[transform,box-shadow,background,border-color] duration-150 ease-out hover:-translate-y-px hover:border-brand-secondary/34 hover:bg-brand-secondary/14 hover:shadow-[0_8px_18px_color-mix(in_srgb,var(--color-secondary)_16%,transparent)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-secondary/18 disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-50 disabled:shadow-none',
  iconButton:
    'inline-flex size-[var(--control-h)] min-h-[var(--control-h)] items-center justify-center rounded-[var(--radius-md)] border border-line-soft bg-surface-glass-subtle p-0 text-ink-medium shadow-xs transition-[transform,background,border-color,color,box-shadow] duration-150 ease-[var(--ease-out)] hover:-translate-y-px hover:bg-surface-3 hover:border-line-medium active:translate-y-0 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-primary/18 [&_svg]:shrink-0',
  dangerIconButton:
    'inline-flex size-[var(--control-h)] min-h-[var(--control-h)] items-center justify-center rounded-[var(--radius-md)] border border-brand-error/18 bg-brand-error/8 p-0 text-brand-error shadow-xs transition-[transform,background,border-color,box-shadow] duration-150 ease-out hover:-translate-y-px hover:border-brand-error/30 hover:bg-brand-error/12 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-error/18 [&_svg]:shrink-0',
  squareIconButton:
    'inline-flex size-9 min-h-9 items-center justify-center rounded-[var(--radius-sm)] border border-line-soft bg-surface-glass-subtle p-0 text-ink-medium shadow-xs transition-[transform,background,border-color,color] duration-150 ease-out hover:-translate-y-px hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-primary/18 [&_svg]:shrink-0',
  squareDangerIconButton:
    'inline-flex size-9 min-h-9 items-center justify-center rounded-[var(--radius-sm)] border border-brand-error/18 bg-brand-error/8 p-0 text-brand-error shadow-xs transition-[transform,background,border-color] duration-150 ease-out hover:-translate-y-px hover:border-brand-error/30 hover:bg-brand-error/12 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-error/18 [&_svg]:shrink-0',
  subtleIconButton:
    'inline-flex size-[var(--control-h)] min-h-[var(--control-h)] items-center justify-center rounded-[var(--radius-md)] border border-transparent bg-transparent p-0 text-ink-soft shadow-none transition-[transform,background,border-color,color] duration-150 ease-out hover:-translate-y-px hover:border-line-soft hover:bg-surface-2 hover:text-ink-medium focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-primary/18 [&_svg]:shrink-0',
  ghostSmall:
    'inline-flex min-h-[30px] items-center gap-1.5 rounded-full border border-line-medium bg-surface-glass-subtle px-[13px] py-[5px] text-xs font-semibold text-ink-medium shadow-none transition-[transform,background,border-color,color,box-shadow] duration-150 ease-out hover:-translate-y-px hover:border-brand-primary/30 hover:bg-[var(--color-primary-light)] hover:text-brand-primary hover:shadow-[0_2px_6px_color-mix(in_srgb,var(--color-primary)_12%,transparent)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-primary/18',
  ghostSmallDanger:
    'inline-flex min-h-[30px] items-center gap-1.5 rounded-full border border-line-medium bg-surface-glass-subtle px-[13px] py-[5px] text-xs font-semibold text-brand-error shadow-none transition-[transform,background,border-color,box-shadow] duration-150 ease-out hover:-translate-y-px hover:border-brand-error hover:bg-brand-error/8 hover:shadow-[0_2px_6px_rgba(220,38,38,0.10)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-error/18',
  brandMark:
    'grid size-11 shrink-0 place-items-center rounded-[var(--radius-sm)] bg-[var(--brand-gradient-primary)] text-sm font-extrabold text-white shadow-[var(--brand-shadow-soft)] max-[640px]:size-10 max-[640px]:text-[13px]',
  panelAddButton:
    'inline-flex min-h-[34px] items-center gap-1.5 rounded-full border border-brand-primary/18 bg-[var(--color-primary-light)] px-3.5 text-[13px] font-bold text-brand-primary shadow-none transition-[transform,background,border-color] duration-150 ease-out hover:-translate-y-px hover:bg-[color-mix(in_srgb,var(--color-primary)_14%,transparent)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-primary/18',

  // ── Forms ─────────────────────────────────────────────────
  stackForm:   'grid min-w-0 gap-4',
  formLabel:   'flex flex-col gap-1.5 text-[13px] font-semibold text-ink-medium',
  formGrid:    'grid min-w-0 grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4',
  filterGrid:  'flex flex-wrap items-end gap-3 [&_label]:min-w-0 [&_label]:flex-[1_1_180px]',
  questionFilterGrid: 'grid items-end gap-3.5 [grid-template-columns:minmax(220px,1.8fr)_repeat(4,minmax(120px,1fr))_auto] max-[900px]:grid-cols-1',
  quizListFilters: 'grid grid-cols-4 gap-3.5 max-[900px]:grid-cols-1 [&_label]:min-w-0',
  filterActions: 'self-end justify-start flex-nowrap',
  input:
    'lms-native-field w-full min-h-[var(--control-h)] rounded-[var(--radius-sm)] border-[1.5px] border-[var(--input-border)] bg-[var(--input-bg)] px-3.5 py-[10px] text-[13.5px] leading-normal text-ink-strong shadow-[inset_0_1px_2px_rgba(11,18,32,0.03)] transition-[border-color,box-shadow,background] duration-150 ease-out [-webkit-appearance:none] placeholder:text-ink-muted [&:hover:not(:focus)]:border-line-strong focus:border-brand-primary focus:bg-surface-card focus:outline-none focus:shadow-[var(--input-focus-shadow),inset_0_1px_2px_rgba(11,18,32,0.03)]',
  textarea:
    'w-full min-h-[90px] resize-y rounded-[var(--radius-sm)] border-[1.5px] border-[var(--input-border)] bg-[var(--input-bg)] px-3.5 py-[10px] text-[13.5px] leading-normal text-ink-strong shadow-[inset_0_1px_2px_rgba(11,18,32,0.03)] transition-[border-color,box-shadow,background] duration-150 ease-out [-webkit-appearance:none] placeholder:text-ink-muted [&:hover:not(:focus)]:border-line-strong focus:border-brand-primary focus:bg-surface-card focus:outline-none focus:shadow-[var(--input-focus-shadow),inset_0_1px_2px_rgba(11,18,32,0.03)]',
  tagInputShell:
    'grid gap-2 rounded-[var(--radius-sm)] border-[1.5px] border-[var(--input-border)] bg-[var(--input-bg)] px-2.5 py-2 focus-within:border-brand-primary focus-within:shadow-[var(--input-focus-shadow)]',
  tagList:   'flex min-h-0 flex-wrap gap-1.5',
  tagChip:
    'inline-flex items-center gap-1 rounded-full border border-brand-primary/18 bg-[var(--color-primary-light)] px-2.5 py-1 text-xs font-bold text-brand-primary [&_button]:size-3.5 [&_button]:min-h-0 [&_button]:rounded-full [&_button]:border-0 [&_button]:bg-transparent [&_button]:p-0 [&_button]:text-sm [&_button]:leading-none [&_button]:text-inherit [&_button]:opacity-60 [&_button]:shadow-none hover:[&_button]:opacity-100 hover:[&_button]:translate-y-0 hover:[&_button]:bg-transparent hover:[&_button]:shadow-none',
  inlineCheck:
    'flex cursor-pointer flex-row items-center gap-2 text-[13px] font-semibold text-ink-medium [&_input[type="checkbox"]]:size-4 [&_input[type="checkbox"]]:shrink-0 [&_input[type="checkbox"]]:cursor-pointer [&_input[type="checkbox"]]:accent-brand-primary [&_input[type="radio"]]:size-4 [&_input[type="radio"]]:shrink-0 [&_input[type="radio"]]:cursor-pointer [&_input[type="radio"]]:accent-brand-primary',
  checkboxLabel:
    'flex cursor-pointer flex-row items-center gap-2 text-[13px] font-semibold text-ink-medium',
  checkboxRow:
    'flex flex-row items-start gap-2.5 text-[13px] font-normal text-ink-soft [&_input[type="checkbox"]]:mt-px [&_input[type="checkbox"]]:size-[18px] [&_input[type="checkbox"]]:shrink-0 [&_input[type="checkbox"]]:cursor-pointer [&_input[type="checkbox"]]:rounded-[5px] [&_input[type="checkbox"]]:border-2 [&_input[type="checkbox"]]:border-line-strong [&_input[type="checkbox"]]:bg-[var(--input-bg)] [&_input[type="checkbox"]]:accent-brand-primary',

  // ── Feedback / alerts ─────────────────────────────────────
  alert:
    'lms-alert rounded-[var(--radius-sm)] border border-line-soft bg-surface-card-elevated px-4 py-3 text-[13px] font-medium leading-normal text-ink-medium shadow-sm',
  warningFeedback:
    'lms-alert lms-alert-warning rounded-[var(--radius-sm)] border border-brand-warning/28 bg-[color-mix(in_srgb,var(--surface-card-elevated)_86%,var(--color-warning-light))] px-4 py-3 text-[13px] font-medium leading-normal text-brand-warning shadow-sm',
  feedbackError:
    'lms-alert lms-alert-error rounded-[var(--radius-sm)] border border-brand-error/28 bg-[color-mix(in_srgb,var(--surface-card-elevated)_86%,var(--color-error-light))] px-4 py-3 text-[13px] font-medium leading-normal text-brand-error shadow-sm',
  feedbackSuccess:
    'lms-alert lms-alert-success rounded-[var(--radius-sm)] border border-brand-success/28 bg-[color-mix(in_srgb,var(--surface-card-elevated)_86%,var(--color-success-light))] px-4 py-3 text-[13px] font-medium leading-normal text-brand-success shadow-sm',

  // ── Empty / loading states ────────────────────────────────
  emptyBox:
    'rounded-[var(--radius-lg)] border-[1.5px] border-dashed border-brand-primary/16 bg-[linear-gradient(160deg,color-mix(in_srgb,var(--color-primary)_4%,var(--surface-card)),var(--surface-card))] px-6 py-8 text-center text-[13px] font-medium leading-relaxed text-ink-soft',
  emptyPage:
    'grid min-h-dvh place-items-center p-6',
  quizLoadingState:
    'grid min-h-[260px] place-items-center gap-3 rounded-[var(--radius-lg)] border border-line-soft bg-surface-glass-subtle p-8 text-center [&_p]:m-0 [&_p]:text-[13px] [&_p]:text-ink-soft',
  quizLoadingSpinner:
    'size-8 rounded-full border-[3px] border-line-soft border-t-brand-primary animate-spin',

  // ── Modals ────────────────────────────────────────────────
  modalForm:    'min-w-0',
  formActions:  'justify-end pt-2',
  modalBackdrop:
    'fixed inset-0 z-[110] grid place-items-center bg-[rgba(2,5,10,0.72)] p-6 backdrop-blur-[10px] max-[640px]:p-3',
  entityModal:
    'w-[min(860px,100%)] max-h-[min(88vh,920px)] overflow-y-auto rounded-[var(--radius-xl)] border border-line-soft bg-surface-card-elevated shadow-2xl animate-scaleIn',
  entityModalTop:
    'sticky top-0 z-[2] flex items-start justify-between gap-4 border-b border-line-soft bg-inherit px-6 py-[20px] pb-[16px] max-[640px]:px-4',
  entityModalTitle:
    'm-0 text-[19px] font-extrabold text-ink-strong',
  entityModalText:
    'm-0 mt-1.5 text-[13px] leading-normal text-ink-soft',
  confirmModal:
    'w-[min(520px,100%)] overflow-hidden rounded-[var(--radius-xl)] border border-line-soft bg-surface-card-elevated shadow-2xl animate-scaleIn',
  confirmModalHead:
    'border-b border-line-soft px-6 py-5 max-[640px]:px-4 [&_h2]:m-0 [&_h2]:text-[19px] [&_h2]:font-extrabold [&_h2]:text-ink-strong [&_p]:m-0 [&_p]:mt-1.5 [&_p]:text-[13px] [&_p]:text-ink-soft',
  confirmModalBody:
    'grid gap-3 px-6 py-5 max-[640px]:px-4',
  modalActions:
    'flex flex-wrap justify-end gap-2.5 border-t border-line-soft px-6 py-4 max-[640px]:px-4',
  lessonEditModal:
    'w-[min(1180px,100%)]',

  // ── Toasts ────────────────────────────────────────────────
  toastContainer:
    'fixed inset-0 z-[140] grid pointer-events-none',
  toastContainerCenter:
    'place-items-center p-6',
  toast:
    'lms-alert inline-flex min-w-[min(420px,calc(100%_-_32px))] max-w-[540px] items-center gap-2.5 rounded-[var(--radius-lg)] border border-line-soft bg-surface-card-elevated px-[18px] py-3.5 text-[13px] font-bold text-ink-strong shadow-xl animate-toastSlideUp',
  toastSuccess:
    'border-brand-success/18 bg-[color-mix(in_srgb,var(--surface-glass-strong)_84%,var(--color-success-light))]',
  toastError:
    'border-brand-error/18 bg-[color-mix(in_srgb,var(--surface-glass-strong)_84%,var(--color-error-light))]',
  toastIcon:
    'inline-grid size-7 place-items-center rounded-full bg-surface-glass-strong text-sm',

  // ── Tables ────────────────────────────────────────────────
  buttonRow:    'flex min-w-0 flex-wrap items-center gap-2.5 max-[520px]:grid max-[520px]:w-full max-[520px]:grid-cols-1 max-[520px]:[&>*]:w-full',
  iconRow:      'flex flex-wrap items-center gap-2',
  questionBankActions: 'flex flex-wrap items-center justify-end gap-2',
  tableShell:   'lms-table-shell relative w-full max-w-full overflow-x-auto overscroll-x-contain rounded-[var(--radius-lg)] border border-line-soft bg-surface-card shadow-sm [scrollbar-width:thin] [-webkit-overflow-scrolling:touch] max-[640px]:rounded-lg',
  modernTable:  'w-full min-w-[760px] border-collapse max-[640px]:min-w-[680px]',
  tableHeadCell:
    'sticky top-0 z-[2] whitespace-nowrap border-b border-line-soft bg-surface-card-elevated px-4 py-3 text-left align-middle text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-ink-muted max-[640px]:px-3 max-[640px]:py-2.5',
  tableCell:
    'max-w-[340px] border-b border-line-soft px-4 py-3 text-left align-middle text-[13px] text-ink-strong max-[640px]:px-3 max-[640px]:py-2.5',
  tableEmpty:
    'rounded-full bg-[var(--color-primary-light)] px-4 py-3.5 text-center text-[11.5px] font-bold tracking-[0.02em] text-brand-primary',
  tableSubtext: 'text-xs text-ink-muted',
  tablePill:
    'inline-flex min-h-[26px] items-center justify-center rounded-full bg-[var(--color-primary-light)] px-2.5 text-[11px] font-extrabold text-brand-primary',

  // ── Course rows ───────────────────────────────────────────
  courseList:    'grid gap-3',
  courseRowCard: `${interactiveCard} flex min-w-0 items-center justify-between gap-4 px-[18px] py-[14px] max-[640px]:grid max-[640px]:gap-3 max-[640px]:px-4`,
  courseRowMain: 'flex min-w-0 flex-auto items-start gap-3',
  courseRowCopy: 'grid min-w-0 gap-1',
  courseRowTitle: 'm-0 text-[14.5px] font-bold leading-snug text-ink-strong',
  courseRowMeta:  'm-0 text-[12px] font-bold tracking-[0.02em] text-ink-soft',
  courseRowText:
    'line-clamp-2 overflow-hidden text-[12.5px] leading-normal text-ink-soft [-webkit-box-orient:vertical] [display:-webkit-box]',
  statusDot:
    'mt-1.5 size-2.5 shrink-0 rounded-full bg-ink-muted shadow-[0_0_0_5px_color-mix(in_srgb,var(--surface-2)_90%,transparent)]',
  lessonSnippet:
    'inline-block max-w-[260px] overflow-hidden text-ellipsis whitespace-nowrap max-[520px]:max-w-full max-[520px]:whitespace-normal',
  lessonNotebookContent:
    'rounded-[var(--radius-lg)] border border-[var(--card-border)] bg-[var(--card-bg)] p-[clamp(18px,3vw,30px)] text-[15px] leading-[1.75] text-ink-strong shadow-[var(--card-shadow)] [&_h1]:text-ink-strong [&_h1]:font-extrabold [&_h1]:leading-tight [&_h2]:text-ink-strong [&_h2]:font-extrabold [&_h2]:leading-tight [&_h3]:text-ink-strong [&_h3]:font-extrabold [&_h3]:leading-tight [&_p]:mb-3 [&_p]:text-ink-medium',

  // ── Quiz builder ──────────────────────────────────────────
  questionBuilder:    'flex flex-col gap-3.5',
  questionBuilderHead: 'flex flex-wrap items-center justify-between gap-3 [&_button]:min-h-[34px] [&_button]:rounded-[var(--radius-sm)] [&_button]:px-3 [&_button]:text-xs',
  optionBuilderCard:  'grid min-w-0 gap-2.5 rounded-[var(--radius-sm)] border border-line-soft bg-surface-card p-3.5',
  optionBuilderTop:   'flex flex-wrap items-center justify-between gap-2.5 [&_strong]:text-[13px] [&_strong]:font-extrabold [&_strong]:text-ink-strong',
  whyIncorrectField:  '[&_textarea]:min-h-[74px]',

  // ── Skeleton ──────────────────────────────────────────────
  shimmer:
    'shimmer rounded-[var(--radius-sm)]',
  routeSkeleton:
    'glass-card mx-auto grid w-full max-w-page gap-4 p-5',
  routeSkeletonTop:
    'grid gap-3 [&_span:nth-child(1)]:h-7 [&_span:nth-child(1)]:w-[min(360px,70%)] [&_span:nth-child(2)]:h-4 [&_span:nth-child(2)]:w-[min(560px,88%)] [&_span:nth-child(3)]:h-10 [&_span:nth-child(3)]:w-[min(440px,76%)]',
  routeSkeletonGrid:
    'grid grid-cols-3 gap-4 max-[900px]:grid-cols-1',
  routeSkeletonCard:
    'grid gap-3 rounded-[var(--radius-md)] border border-line-soft bg-surface-card p-4 [&_span:nth-child(1)]:h-4 [&_span:nth-child(1)]:w-1/2 [&_span:nth-child(2)]:h-20 [&_span:nth-child(2)]:w-full [&_span:nth-child(3)]:h-3 [&_span:nth-child(3)]:w-4/5',
};

// ── Helpers ──────────────────────────────────────────────────

export function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

export function statusPill(tone = '') {
  const base =
    'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-[4px] text-[11px] font-bold capitalize tracking-[0.02em] before:size-[6px] before:shrink-0 before:rounded-full before:bg-current before:content-[""]';
  if (['active', 'pass', 'paid', 'completed'].includes(tone)) {
    return `${base} border-brand-success/22 bg-[var(--color-success-light)] text-brand-success`;
  }
  if (['inactive', 'fail', 'failed', 'cancelled', 'expired'].includes(tone)) {
    return `${base} border-brand-error/18 bg-[var(--color-error-light)] text-brand-error`;
  }
  if (['pending', 'in_progress', 'processing'].includes(tone)) {
    return `${base} border-brand-warning/22 bg-[var(--color-warning-light)] text-brand-warning`;
  }
  return `${base} border-line-medium bg-surface-2 text-ink-medium`;
}
