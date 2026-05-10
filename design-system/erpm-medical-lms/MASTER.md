# ERPM Medical LMS — Design System Master

> **LOGIC:** When building a specific page, first check `design-system/erpm-medical-lms/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

> ⚠️ Auto-generated "Claymorphism / Baloo 2 / Comic Neue" recommendation was rejected.
> Wrong fit for a university-level medical study platform targeting serious students.

---

## Direction: Clinical Authority

A medical LMS for serious students demands authority, not playfulness.
**professional → focused → trustworthy → calm**
Think: premium medical journal, not consumer gamification app.

---

## Color Tokens (from `shared/theme.css`)

| Role | Value | Token |
|------|-------|-------|
| Primary | `#2563EB` (light) / `#3B82F6` (dark) | `--color-primary` |
| Secondary / Violet | `#7C3AED` | `--color-secondary` |
| Accent / Teal | `#0D9488` | `--color-accent` |
| Background | `#F8FAFD` / `#010208` | `--surface-0` |
| Card surface | `#FFFFFF` / dark-glass | `--surface-card` |
| Border soft | `#EDF2F8` / `rgba(148,163,184,0.15)` | `--line-soft` |
| Text strong | `#0B1220` / `rgba(255,255,255,0.90)` | `--ink-strong` |
| Text soft | `#62758A` / `rgba(255,255,255,0.55)` | `--ink-soft` |
| Brand gradient | `135deg, #1D4ED8 → #4338CA → #5B21B6` | `--brand-gradient-primary` |

**Never use raw hex in components.** Always reference CSS tokens or Tailwind color aliases.

---

## Typography

| Role | Family | Weight | Size |
|------|--------|--------|------|
| Display / headings | Plus Jakarta Sans | 700–900 | clamp scale |
| Body | Inter | 400–500 | 13–16px |
| Labels / eyebrows | Inter | 700–800 | 10.5–12px uppercase |

**Scale:** `10.5 → 12 → 13 → 13.5 → 14 → 15 → 16 → 17 → 18 → 21 → 24 → 28 → 32 → 36–62 (clamp)`

Body `line-height: 1.6–1.75`. Heading `line-height: 1.08–1.15`.
Letter spacing on headings: `-0.01em` to `-0.02em`. On eyebrows: `+0.08em` to `+0.14em`.

---

## Spacing (4px grid)

`4 8 12 16 20 22 24 28 32 40 48 52 60 76 96` px
Card padding: `22px`. Section gap: `22px`. Page x-pad: `24px`.

---

## Elevation / Shadows

| Token | Usage |
|-------|-------|
| `--shadow-sm` | Cards, inputs at rest |
| `--shadow-md` | Cards on hover, elevated panels |
| `--shadow-lg` | Dropdowns, popovers |
| `--shadow-xl` | Modals, sidesheets |

No one-off `box-shadow` values outside the token scale.

---

## Radii

`5 → 9 → 13 → 18 → 24 → 32 → 999px` (xs → sm → md → lg → xl → 2xl → full)

---

## Motion

| Type | Duration | Easing |
|------|----------|--------|
| Micro (hover, focus) | 150ms | `ease-out` |
| Standard (state changes) | 180–220ms | `cubic-bezier(0,0,0.2,1)` |
| Page entrance | 280ms | `cubic-bezier(0.16,1,0.3,1)` |
| Spring (cards, modals) | 320ms | `cubic-bezier(0.34,1.56,0.64,1)` |

Always add `motion-reduce:transition-none` / `motion-reduce:animate-none`.

---

## Component Patterns

### Cards
- Base: `glass-card` class (defined in `app.css`)
- Hover: `translateY(-2px)` + `--shadow-md` + `border-brand-primary/20`
- Premium accent: 2px top gradient bar via `::before` with `--brand-gradient-primary`
- Dark-mode glass: `linear-gradient(160deg, rgba(30,41,59,0.22), rgba(8,15,25,0.96))`

### Buttons
- Primary: `--brand-gradient-primary` bg, white text, `--radius-md`, shadow on hover
- Secondary: `border-line-medium`, `--btn-secondary-bg`, `ink-medium` text
- Ghost / outline: `border-white/10 bg-white/[0.08]` (landing dark context)
- Landing CTAs: `rounded-full` pill shape

### Inputs
- Border: `var(--input-border)`, focus ring: `var(--input-focus-shadow)`
- Height: `var(--control-h)` = 42px
- Always pair with a visible `<label>` — never placeholder-only

### Icons
- **SVG only.** No emoji as structural or functional UI elements.
- Consistent stroke width: `1.4–1.6px` at 20–24px size
- Fill only for solid/accent icons; stroke for outline icons
- One visual style per hierarchy level — no mixing filled and outline

---

## Landing Page (Dark Theme)

- Background: deep navy `#02030A → #05070F`, radial blue/violet glows
- Text: `text-white` / `text-white/60` / `text-white/50`
- Cards: dark glass `rgba(255,255,255,0.046)` fill, `border-white/[0.075]`
- ECG animation is a key brand differentiator — preserve and do not dilute
- Parallax: RAF-throttled, desktop-only (`max-width: 1024px` guard)
- Scroll reveal: IntersectionObserver via `data-reveal` / `is-revealed` pattern

---

## Anti-Patterns (Never)

- No Claymorphism, clay shadows, or bubbly-pill-heavy layouts
- No children's typefaces (Baloo, Comic Neue, rounded display fonts)
- No emoji as structural icons — `🔥 ★ ✕ +` are all forbidden as UI elements
- No raw hex values in JSX `style={{}}` when a CSS token exists
- No `text-[11px]` on body content (WCAG failure at normal weights)
- No `text-white/50` on backgrounds darker than `#060606` (contrast < 3:1 fails AA)
- No random `box-shadow` values outside the token scale
- No gradient-hero + three-feature-card generic SaaS pattern

---

## Stack

React 19 + Vite + Tailwind CSS v4 + React Router v7.
No Next.js — do not use `next/image`, `next/font`, or Server Components.
Lazy loading via `React.lazy` + `Suspense` (already implemented in router).
