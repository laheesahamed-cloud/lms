import { useThemeStore } from '../../../../shared/stores/themeStore.js';
import { cx, ui } from '../../../../shared/styles/tailwindClasses.js';

const themes = [
  {
    key: 'codeforge',
    name: 'Codeforge Blue',
    description: 'A flat Codeforge-style blue accent without gradients.',
    colors: ['#0084D1', '#0084D1', '#0084D1'],
  },
  {
    key: 'erpm',
    name: 'ERPM Original',
    description: 'The previous LMS blue to teal medical workspace palette.',
    colors: ['#2563EB', '#1D4ED8', '#0EA5E9'],
  },
];

export function AdminThemeSettingsPanel() {
  const accentTheme = useThemeStore((state) => state.accentTheme);
  const setAccentTheme = useThemeStore((state) => state.setAccentTheme);

  return (
    <div className="grid grid-cols-2 gap-3.5 max-[900px]:grid-cols-1">
      {themes.map((theme) => {
        const selected = accentTheme === theme.key;

        return (
          <button className={cx(
              'grid w-full cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3.5 rounded-md border border-line-soft bg-[var(--surface-card)] p-3.5 text-left text-ink-strong shadow-none transition hover:-translate-y-px hover:border-brand-primary/30 hover:shadow-sm max-[560px]:grid-cols-1',
              selected && 'border-brand-primary/60 bg-[radial-gradient(circle_at_top_left,color-mix(in_srgb,var(--color-primary)_9%,transparent),transparent_42%),var(--surface-card)] shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-primary)_12%,transparent)]'
            )}
            key={theme.key}
            type="button"
           
            onClick={() => setAccentTheme(theme.key)}
            aria-pressed={selected}
          >
            <span className="inline-flex h-[42px] w-[76px] items-center rounded-md border border-line-soft bg-surface-2 p-1.5" aria-hidden="true">
              {theme.colors.map((color) => (
                <span key={color} className="-ml-1.5 h-full flex-1 rounded-full shadow-[inset_0_0_0_1px_rgba(255,255,255,0.22)] first:ml-0" style={{ background: color }} />
              ))}
            </span>
            <span className="grid min-w-0 gap-1">
              <strong className="text-sm text-ink-strong">{theme.name}</strong>
              <small className="text-xs leading-normal text-ink-soft">{theme.description}</small>
            </span>
            <span className={cx(
              'inline-flex min-h-7 items-center justify-center whitespace-nowrap rounded-full px-2.5 text-[11px] font-extrabold',
              selected ? 'bg-brand-primary/10 text-brand-primary' : 'bg-surface-2 text-ink-soft'
            )} aria-hidden="true">
              {selected ? 'Selected' : 'Use theme'}
            </span>
          </button>
        );
      })}
    </div>
  );
}
