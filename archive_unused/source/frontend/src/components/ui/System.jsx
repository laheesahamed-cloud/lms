import { cx, ui } from '../../styles/tailwindClasses.js';

const cardVariants = {
  default: ui.panelCard,
  compact: ui.compactPanelCard,
  dashboard: ui.dashboardCard,
  feature: ui.featureCard,
  question: ui.questionCard,
  quiz: ui.quizCard,
  list: ui.listCard,
  locked: ui.lockedCard,
  info: ui.infoCard,
};

const buttonVariants = {
  primary: ui.primaryAction,
  secondary: ui.secondaryAction,
  ghost: ui.ghostAction,
  danger: ui.dangerAction,
  success: ui.successAction,
  premium: ui.premiumAction,
};

const badgeVariants = {
  default: 'border-line-medium bg-surface-2 text-ink-medium',
  primary: 'border-brand-primary/25 bg-brand-primary-light text-brand-primary',
  accent: 'border-brand-accent/25 bg-brand-accent-light text-brand-accent',
  premium: 'border-brand-secondary/25 bg-brand-secondary-light text-brand-secondary',
  success: 'border-brand-success/25 bg-[var(--color-success-light)] text-brand-success',
  warning: 'border-brand-warning/25 bg-[var(--color-warning-light)] text-brand-warning',
  danger: 'border-brand-error/25 bg-[var(--color-error-light)] text-brand-error',
};

export function PageShell({ className, children, ...props }) {
  return (
    <main className={cx(ui.screenShell, className)} {...props}>
      {children}
    </main>
  );
}

export function PageContent({ className, children, ...props }) {
  return (
    <section className={cx(ui.managementLayout, className)} {...props}>
      {children}
    </section>
  );
}

export function Card({ variant = 'default', className, children, ...props }) {
  return (
    <section className={cx(cardVariants[variant] || cardVariants.default, className)} {...props}>
      {children}
    </section>
  );
}

export function Button({ variant = 'secondary', className, children, ...props }) {
  return (
    <button className={cx(buttonVariants[variant] || buttonVariants.secondary, className)} {...props}>
      {children}
    </button>
  );
}

export function Input({ className, ...props }) {
  return <input className={cx(ui.input, className)} {...props} />;
}

export function Select({ className, children, ...props }) {
  return (
    <select className={cx(ui.input, className)} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...props }) {
  return <textarea className={cx(ui.textarea, className)} {...props} />;
}

export function Badge({ variant = 'default', className, children, ...props }) {
  return (
    <span
      className={cx(
        'inline-flex min-h-7 items-center justify-center rounded-full border px-2.5 text-[11px] font-extrabold tracking-[0.02em]',
        badgeVariants[variant] || badgeVariants.default,
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export function EmptyState({ className, children, ...props }) {
  return (
    <div className={cx(ui.emptyBox, className)} {...props}>
      {children}
    </div>
  );
}

export function ProgressBar({ value = 0, className, barClassName, ...props }) {
  const percent = Math.min(100, Math.max(0, Number(value) || 0));
  return (
    <div className={cx('h-2 overflow-hidden rounded-full bg-surface-3', className)} {...props}>
      <span
        className={cx('block h-full rounded-full bg-[var(--brand-gradient-primary)] transition-[width] duration-500', barClassName)}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

export function TableShell({ className, children, ...props }) {
  return (
    <div className={cx(ui.tableShell, className)} {...props}>
      {children}
    </div>
  );
}
