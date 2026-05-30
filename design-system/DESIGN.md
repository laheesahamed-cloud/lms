# Design System: xyndrome — Medical Study Platform

> Generated for Google Stitch screen generation.
> Single source of truth for all screen prompts.

---

## 1. Visual Theme & Atmosphere

**Density:** 5/10 — Daily App Balanced. The landing page is spacious and editorial; the dashboard and quiz pages are information-dense but never cluttered. White space is a deliberate tool, not an afterthought.

**Variance:** 6/10 — Offset Asymmetric. The Hero is a split two-column composition — copy left, interactive preview cards right. No centered hero layouts. Section transitions use alternating backgrounds (pure dark / dark tinted) to create rhythm without visual fatigue.

**Motion:** 6/10 — Fluid CSS. ECG sweep animations, floating card micro-loops, scroll-reveal stagger, and spring-based button feedback. Animations serve spatial continuity and state communication — never decoration only.

**Overall atmosphere:** A premium, clinical-dark academic interface. The mood is like a well-lit medical research station at midnight — focused, confident, and calm. The darkness is deep blue-black (not grey or pure black), surfaces have subtle depth, and the single accent system anchors all interactive elements. The platform is built for *serious* study sessions, and the UI communicates that without being cold.

---

## 2. Color Palette & Roles

### Dark Mode (Primary / Default Experience)

| Swatch Name | Hex | Role |
|---|---|---|
| **Abyss Black** | `#010205` | Deepest background, page canvas |
| **Deep Void** | `#030711` | Primary surface, app shell |
| **Midnight Blue** | `#060B17` | Secondary surface, sidebar |
| **Navy Depth** | `#0C1220` | Tertiary surface, cards in context |
| **Elevated Navy** | `#131C2C` | Raised cards, dropdowns |
| **Card Surface** | `rgba(5,8,16,0.97)` | Glass card fill (dark) |
| **Clinical Blue** | `#3B82F6` | Primary accent — buttons, links, focus rings, active states |
| **Soft Blue** | `#60A5FA` | Primary hover state, gradient endpoints |
| **Violet Depth** | `#A78BFA` | Secondary accent — subject tags, highlights |
| **Teal Pulse** | `#2DD4BF` | Tertiary accent — success, progress indicators |
| **Emerald Signal** | `#34D399` | Success states, correct answer indicators |
| **Amber Alert** | `#FBBF24` | Warning states, streak indicators |
| **Rose Error** | `#F87171` | Error states, wrong answers |
| **Ink Primary** | `#DDE5F0` | Primary text on dark backgrounds |
| **Ink Secondary** | `#B8C8DB` | Secondary text, descriptions |
| **Ink Muted** | `#7A8FA8` | Tertiary text, metadata, timestamps |
| **Ink Whisper** | `#50647A` | Placeholders, disabled labels |
| **Border Soft** | `rgba(148,163,184,0.13)` | Default card borders, dividers |
| **Border Medium** | `rgba(148,163,184,0.20)` | Hover borders, active separators |
| **Border Strong** | `rgba(191,219,254,0.28)` | Focus borders, selected states |

### Light Mode (Secondary — Dashboard / App Shell)

| Swatch Name | Hex | Role |
|---|---|---|
| **Pearl Canvas** | `#F7F9FC` | Page background |
| **Pure Surface** | `#FFFFFF` | Cards, containers |
| **Cool Wash** | `#F3F6FA` | Alternate row backgrounds, input fill |
| **Border Whisper** | `#E7EDF5` | Card borders, dividers |
| **Ink Deep** | `#0B1220` | Primary text |
| **Ink Mid** | `#2A3B52` | Secondary text |
| **Ink Soft** | `#62758A` | Tertiary / muted text |
| **Clinical Blue** | `#2563EB` | Primary accent (light mode) |

### Color Rules
- **Maximum 1 accent per screen** — Clinical Blue is the single CTA accent.
- Violet, Teal, Emerald, Amber are **subject/state indicators** only — never used for primary CTAs.
- The landing page hero gradient (`linear-gradient(90deg,#60A5FA,#A78BFA,#F472B6)`) is used exclusively on the hero H1 gradient span — never on buttons or cards.
- **Gold CTA exception:** The hero primary CTA uses a warm amber-to-red gradient (`linear-gradient(135deg,#F59E0B,#EF4444)`) to create visual contrast against the blue-dominant palette. Use only for the single most important conversion action on the page.

---

## 3. Typography Rules

### Font Stack
- **Display / Headings:** `Plus Jakarta Sans` — Track-tight (`letter-spacing: -0.01em` to `-0.02em` at large sizes). Weight-driven hierarchy (400 → 600 → 800 → 900). Not aggressive. Confident and medical-professional.
- **Body / UI:** `Plus Jakarta Sans` — Relaxed leading (`line-height: 1.65`). Max 65 characters per line. Secondary colour (`Ink Secondary`).
- **Monospace / Data:** `JetBrains Mono` or `Geist Mono` — For quiz answer labels (A, B, C, D), medical codes, analytics numbers, timestamps.

### Type Scale (Base 16px)
| Token | Size | Weight | Use |
|---|---|---|---|
| `display-xl` | `clamp(36px,4.5vw,62px)` | 900 | Hero H1 |
| `display-lg` | `clamp(26px,3vw,40px)` | 900 | Section headings |
| `display-md` | `clamp(22px,3vw,36px)` | 800 | CTA headings |
| `title-lg` | `20px` | 700 | Card titles, plan names |
| `title-md` | `16px` | 700 | Widget headings |
| `title-sm` | `15px` | 700 | Feature card h3, table headers |
| `body-lg` | `16px` | 400 | Hero subtext, description paragraphs |
| `body-md` | `15px` | 400 | Feature descriptions, FAQ answers |
| `body-sm` | `13px` | 400 | Card body copy, secondary content |
| `label-lg` | `13.5px` | 700 | Buttons, nav links |
| `label-sm` | `11.5px` | 600 | Tags, eyebrows, trust pills |
| `micro` | `10px–11px` | 700 | Card preview text, data labels |

### Eyebrow / Section Labels
Small all-caps labels precede every section heading: `text-[11.5px] font-extrabold uppercase tracking-[0.1em] text-blue-400`. This anchors section intent before the user reads the title.

### Anti-patterns
- **`Inter` is banned** for premium/display contexts — Plus Jakarta Sans exclusively.
- Generic serif fonts (`Times New Roman`, `Georgia`) banned completely.
- Body text never below 13px in rendered interface.
- No `text-transform: uppercase` on body paragraphs.

---

## 4. Component Stylings

### Buttons

**Primary (Gold CTA — conversion):**
Background: `linear-gradient(135deg,#F59E0B,#EF4444)`. Rounded-full. Shadow: `0 4px 20px rgba(245,158,11,0.35)`. On hover: shadow deepens to `0 8px 28px rgba(245,158,11,0.45)`, `brightness(1.1)`. On active: `scale(0.97)`, shadow collapses. Transition: `160ms cubic-bezier(0.23,1,0.32,1)`.

**Primary (Blue CTA — platform actions):**
Solid `#2563EB` fill. Hover: `#1D4ED8`. On active: `scale(0.97)`. No outer glow.

**Ghost / Secondary:**
`border: 1px solid rgba(255,255,255,0.10)`, `background: rgba(255,255,255,0.08)`. Text: `rgba(255,255,255,0.80)`. Hover: background lifts to `rgba(255,255,255,0.14)`. Active: `scale(0.97)`.

**Shared button rules:**
- All buttons use `border-radius: 999px` (fully rounded pill shape).
- `cursor: pointer` always declared explicitly.
- `transition-property: transform, box-shadow, background-color, border-color, color, opacity, filter`.
- `transition-duration: 160ms`.
- `transition-timing-function: cubic-bezier(0.23,1,0.32,1)`.
- Active state **always** includes `scale(0.97)` — buttons must feel tactile.

### Cards

**Hero Preview Cards (dark glass):**
Background: `linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.025)),#03050D`. Border: `rgba(255,255,255,0.075)`. Shadow: `0 14px 32px rgba(2,6,23,0.2), inset 0 1px 0 rgba(255,255,255,0.08)`. Hover: lift `translateY(-4px)`, shadow deepens. Active: `scale(0.99)`. `border-radius: 16px`.

**Feature/Info Cards:**
Same glass surface as preview cards. Icon badge top-left in accent color tint. Tag chip above title. Hover lift with accent-tinted border glow. `border-radius: 16px`.

**Testimonial Cards:**
Identical surface. 5-star rating row top. Quote in italic `text-white/70`. Avatar circle with gradient fill, initial letter.

**Pricing Cards:**
Same glass surface. Featured plan gets: animated indigo border glow (`lpPlanGlow`), blue-indigo gradient top banner "Most Popular", `overflow: hidden` to clip banner to rounded corners.

**Card rules:**
- Use elevation (shadow + subtle border) to communicate hierarchy.
- Tint card shadows to background hue — not generic grey shadows.
- `contain: layout paint` on all preview/feature cards for performance.
- Never stack cards on top of other cards — clean spatial separation always.

### Navigation Bar

Sticky, `position: fixed`, `z-index: 20000`. Starts transparent. On scroll past 50px: `background: rgba(2,3,16,0.95)`, `backdrop-filter: blur`, subtle bottom border, box-shadow. Brand logo: gradient cross icon + site name + subtitle. Desktop links: centered, `text-white/60` → `text-white` on hover. CTA: Ghost + Primary pill buttons. Hamburger (mobile < 860px): `size-9` rounded square button with menu/close icon toggle.

**Mobile Menu Drawer:**
Full-screen overlay, `z-index: 19999`. `background: rgba(2,3,16,0.98)`, heavy `backdrop-filter: blur(24px)`. Full-height flex column. Nav links at 17px bold. Sign In + Get Started buttons at bottom. Body scroll locked while open.

### Trust Pills
`border-radius: 999px`. `border: 1px solid rgba(255,255,255,0.12)`. `background: rgba(255,255,255,0.07)`. Per-category mini SVG icon (13px) in matching accent color before label text. Hover: border and text subtly lighten.

### Quiz Answer Options
Rounded rectangle items. Default: `border: 1px solid rgba(255,255,255,0.07)`. Correct: `border-emerald-400/35`, `bg-emerald-500/10`, `text-emerald-300`. Answer letter badge: small circle, `bg-white/[0.08]` default → `bg-emerald-600 text-white` on correct. Text at 10px monospace label character.

### Stats Strip
Horizontal grid (4-col desktop / 2-col tablet / 1-col mobile). `background: rgba(0,0,0,0.50)`. `border: 1px solid rgba(255,255,255,0.07)`. `border-radius: 16px`. No dividers — `gap: 1px` with `overflow: hidden` creates hairline gaps naturally. Number counts animate on scroll entry (900ms, ease-out cubic).

### FAQ Accordion
Uses native HTML `<details>/<summary>`. Rounded 18px. Border soft. `open:` state: border lifts to `blue-300/20`, background brightens slightly. Chevron icon rotates 180° on open: `transition: transform 200ms ease`. Body text 13.5px, leading 1.7.

### Footer
`border-top: 1px solid rgba(255,255,255,0.06)`. `background: #02030A`. Two-column link list (Platform / Support). Brand logo top-left. Copyright bottom. Link text `text-white/45` → `text-white/80` on hover.

### WhatsApp Float Button
Fixed, bottom-right, `z-index: 9999`. `border-radius: 18px`. Green gradient fill. Box shadow with green tint. Hover: `translateY(-2px)`, `scale(1.04)`, `saturate(1.05)`.

---

## 5. Layout Principles

**Shell Container:** `max-width: 1180px`, `padding: 0 20px`. Centered. All sections share this shell.

**Hero Layout:** Strict 2-column CSS Grid. Left: copy (H1, sub, CTAs, trust pills). Right: interactive preview card grid (2×2 + full-width analytics strip). Below 860px: single column, copy first, cards below.

**Section Rhythm:** Alternating backgrounds every other section. Odd: pure dark. Even: `linear-gradient(180deg,rgba(0,0,0,0.2),rgba(0,0,0,0.36))` tint overlay. This creates visual breathing rhythm without explicit dividers.

**Section Padding:** Desktop `py-[76px]`. Tablet `py-[56px]`. Mobile `py-[44px]`.

**Grid System:**
- Features: 3-column → 2-col at 1024px → 1-col at 640px.
- Pricing: 3-column → 1-col at 860px.
- Testimonials: 3-column → 1-col at 860px.
- FAQ: 2-column → 1-col at 860px.
- Subjects: 7-column → 4-col at 1024px → 2-col at 640px.

**Spacing Scale:** 4px base unit. All internal padding uses multiples of 4. Section gaps use multiples of 8.

**Z-Index Layers:**
| Layer | Z-Index | Use |
|---|---|---|
| Overlay / Mobile Menu | 19999 | Mobile nav drawer |
| Sticky Nav | 20000 | Fixed top navigation |
| WhatsApp Float | 9999 | Floating action button |
| Hero cards | 2 | Preview cards above bg |
| Hero bg | 0 | Orbs, ECG, grid |

**Performance containment:** `contain: layout paint style` on the hero section. `content-visibility: auto` + `contain-intrinsic-size` on below-fold sections for deferred rendering.

---

## 6. Motion & Interaction

### Easing Curves (all custom — no native ease-in)
| Token | Curve | Use |
|---|---|---|
| `--ease-out` | `cubic-bezier(0.23,1,0.32,1)` | UI interactions, reveals, button hover |
| `--ease-smooth` | `cubic-bezier(0.16,1,0.3,1)` | Modal entrances, route transitions |
| `--ease-in-out` | `cubic-bezier(0.77,0,0.175,1)` | On-screen movement, drawer |
| `--ease-spring` | `cubic-bezier(0.34,1.56,0.64,1)` | Playful bounces, quiz feedback |

### Scroll Reveal (IntersectionObserver)
Elements enter from `opacity: 0, translateY(6px), scale(0.992)`. Resolve to `opacity: 1, translateY(0), scale(1)`. Duration: `300ms ease-out`. Threshold: `0.05`. Stagger delay: `60ms` between grid children. Hero copy: immediate on mount (no wait for scroll).

### Perpetual Micro-Loops (desktop only, respects `prefers-reduced-motion`)
| Animation | Element | Duration | Curve |
|---|---|---|---|
| `lpFloatA` | Study notes card | 5.8s | `ease-in-out` |
| `lpFloatB` | Quiz card | 6.6s | `ease-in-out` |
| `pulseSoft` | Hero kicker dot | 2s | ease |
| `ecgSweep` | ECG stroke path | 7.8s | linear |
| `lpPlanGlow` | Featured pricing card | 3.2s | `ease-in-out` |
| `lpCtaDriftA/B` | CTA section orbs | 9–11s | `ease-in-out` |
| `scrollBounce` | Scroll cue chevron | 1.8s | `ease-in-out` |

### Parallax Depth (enhanced motion, desktop wide only)
Three hero orbs move at different Y rates on scroll — `--lp-orb-a-y`, `--lp-orb-b-y`, `--lp-orb-c-y`. ECG wave has its own parallax track. All via CSS custom properties updated via `requestAnimationFrame` with RAF throttling.

### Button Interaction
`160ms cubic-bezier(0.23,1,0.32,1)`. Hover: `translateY(-2px)`. Active: `scale(0.97), translateY(0)`. Properties animated: `transform, box-shadow, background-color, border-color, color, opacity, filter` — never `transition: all`.

### Route Transitions
Page enter: `opacity: 0 → 1, translateY(8px → 0)`. Duration: `280ms cubic-bezier(0.16,1,0.3,1)`.

### Counter Animation (stats)
Numbers count up from 0 on intersection: duration 900ms, `ease-out cubic` (`1 - Math.pow(1-t, 3)`).

### Performance Rules
- Animate only `transform` and `opacity` — never `top`, `left`, `width`, `height`, `padding`, `margin`.
- CSS animations for predetermined loops (ECG, float, glow) — GPU off main thread.
- JS animations (`requestAnimationFrame`) only for interactive/interruptible motion (parallax, drag).
- CSS variables on parent elements avoided during scroll-driven animations — update `transform` directly on the target element.

---

## 7. Hero Section Specification

The hero is split-screen asymmetric: 60/40 left-right at desktop.

**Left column (copy):**
- Eyebrow pill: `rounded-full`, `border-blue-400/25`, `bg-blue-500/10`. Pulsing dot left of label.
- H1: `clamp(36px,4.5vw,62px)` / weight 900 / `line-height: 1.08`. Middle line wrapped in `linear-gradient(90deg,#60A5FA,#A78BFA,#F472B6)` gradient clip text.
- Sub-paragraph: `16px` / `text-white/60` / `line-height: 1.65` / max-width 500px.
- CTA row: Gold primary + Ghost secondary, stagger delay 320ms after reveal.
- Trust pills: 4 pills with per-category mini SVG icons (blue stethoscope, violet notes, emerald quiz, amber chart). Stagger delay 410ms.

**Right column (preview cards):**
2×2 grid + full-width analytics strip.
- Study Notes card: dark glass, macOS chrome dots header, illustrated content blocks with left-border colour coding.
- Quiz card: same chrome header, MCQ format with correct answer highlighted in emerald.
- Analytics card: 3-panel layout — weekly average number, bar chart, subject progress bars.
- All cards float on independent Y-animation loops (desktop only).

**Background layers (bottom-to-top):**
1. Radial gradient background (blue at 72%/18%, green at 18%/78%).
2. Fine dot grid (`60px × 60px`) masked with radial gradient.
3. Three blurred orbs (blue 520px right-top, violet 430px left-bottom, emerald 300px left-mid).
4. Three depth dots (blue, violet, emerald, 5–7px).
5. ECG wave SVG — base (low opacity), glow (blurred), animated sweep path.

---

## 8. Anti-Patterns (Banned)

The following patterns are explicitly forbidden in all Stitch-generated screens for this project:

- **No emojis** anywhere in the interface — use SVG icons exclusively.
- **`Inter` font banned** for display/heading use — Plus Jakarta Sans only.
- **No pure black (`#000000`)** — use Abyss Black (`#010205`) or Deep Void (`#030711`).
- **No neon outer glows** — no `box-shadow: 0 0 30px #7C3AED` style purple glows.
- **No oversaturated accents** — saturation below 80% for all accent colors.
- **No gradient text on large headings** except the single designated H1 gradient span — descriptions and body text are always solid.
- **No custom mouse cursors** — `cursor: pointer` is the maximum cursor customisation.
- **No overlapping elements** — every element occupies its own clear spatial zone. No absolute stacking of unrelated content.
- **No 3-equal-column card feature rows** as the primary feature layout — use zig-zag, asymmetric grid, or 2+1 compositions.
- **No centered hero layouts** — the hero is always split-screen or left-aligned asymmetric.
- **No `ease-in` easing** on any UI interaction — elements starting slow feel unresponsive.
- **No `transition: all`** — specify exact properties always.
- **No AI copywriting clichés** — forbidden words: "Elevate", "Seamless", "Unleash", "Next-Gen", "Empower", "Transform", "Revolutionize".
- **No generic placeholder names** — use Sri Lankan names (Ayesha, Nadun, Perera) and real medical terminology.
- **No fake round statistics** — no "99.99% uptime", "50% faster", "10,000+ students".
- **No circular spinner loaders** — use skeletal shimmer loaders matching layout dimensions.
- **No `h-screen` viewport units** — use `min-h-[100dvh]` to prevent iOS Safari jump.
- **No scroll cue arrows/chevrons in Stitch-generated screens** — the content itself should pull users forward.
- **No broken image placeholders** — use SVG avatars, gradient fills, or `picsum.photos` for realistic imagery.
- **No hover-only interactive states** — all interactions must also work via keyboard focus and touch tap.
- **No `margin: auto` centering on hero sections** — explicit grid/flex with controlled asymmetry.

---

## 9. Subject Color Map

Used for subject-specific tinting across cards, icons, and progress bars:

| Subject | Color | Hex |
|---|---|---|
| Medicine | Clinical Blue | `#3B82F6` |
| Surgery | Violet Depth | `#8B5CF6` |
| OBS & GYN | Pink Signal | `#EC4899` |
| Paediatrics | Cyan Calm | `#06B6D4` |
| Psychiatry | Amber Warm | `#F59E0B` |
| Forensic Medicine | Rose Edge | `#EF4444` |
| Community Medicine | Emerald Signal | `#10B981` |

These colors are applied as: icon fill, card border-left accent, tag background tint (`color-mix(in srgb, subject-color 12%, transparent)`), hover border tint.

---

*xyndrome Design System · Generated 2026-05-08 · Version 1.0*
