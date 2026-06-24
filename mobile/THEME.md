# XYNDROME app — Theme

How light/dark theming works in the Flutter student app, and the design rules behind it. **Everything is global** — driven by tokens + a few shared widgets, never per‑page patches. Touch a token here and the whole app follows.

## 1. Theme mode (light / dark / system)

- Source of truth: `lib/state/theme_mode.dart` → `themeModeProvider` (Riverpod `Notifier<ThemeMode>`).
- Persisted in `SharedPreferences` under key `themeMode` (`light` | `dark` | `system`). **Default = dark.**
- Applied once at the top in `lib/main.dart`: `MaterialApp.router(themeMode: ref.watch(themeModeProvider))`.
- Student switches it in **Profile → Appearance** (`_ThemeCard` in `lib/features/profile/profile_page.dart`), a System/Light/Dark `SegmentedButton`.

Because it's set at the `MaterialApp` level, switching flips **every screen instantly** — including the AI‑notes canvas — with no reload.

## 2. How colors resolve

- All colors live in `lib/theme/tokens.dart` as two `AppColors` constants: `AppColors.dark` and `AppColors.light`.
- Widgets read them via `context.c` (extension in `tokens.dart`), which returns the right set based on `Theme.of(context).brightness`.
- `lib/theme/app_theme.dart` maps tokens into `ThemeData` (`scaffoldBackgroundColor: c.page`, `colorScheme.surface: c.card`, etc.). **So the page background and surfaces are global** — no screen sets its own background.

> Rule: never hardcode a surface/text color in a screen. Add or reuse a token, or read `context.c`.

## 3. Light mode = Apple HIG "grouped"

The light theme follows Apple's grouped‑content model so cards never blend into the background:

| Token | Value | Role (Apple analogue) |
|---|---|---|
| `page` | `#F2F2F7` | systemGroupedBackground — the **gray page** |
| `card` / `cardElevated` / `surface1` | `#FFFFFF` | **white cards** raised off the page |
| `surface2` | `#EAEAEF` | grouped inset / chip gray |
| `line` | `#E5E5EA` | separator |
| `lineMedium` | `#D1D1D6` | |
| `lineStrong` | `#C6C6C8` | opaque separator |
| `inkStrong` | `#1C1C1E` | primary label |
| `inkMedium` | `#3A3A3C` | |
| `inkSoft` | `#6C6C70` | secondary label |
| `inkMuted` | `#8E8E93` | tertiary label / placeholder |
| `primary` | `#2563EB` | **XYNDROME brand blue (kept, not Apple blue)** |

**Cards (`lib/widgets/glass_card.dart`):** in light mode cards are **solid white** (not glass) and separate from the gray page with a **soft neutral shadow** (`#1A000000`, blur 20, spread ‑2, y+6). Dark mode keeps the frosted‑glass card (backdrop blur + cool gradient + deep shadow).

The earlier "cards blend into the background" bug was because the old light `page` (`#F7F9FC`) and `card` (`#FBFCFF`) were nearly the same value. The gray‑page / white‑card / soft‑shadow split fixes it globally.

## 4. Dark mode

Unchanged. Layered near‑blacks (`page #0A0A0F` → `card #16181F` → `cardElevated #1C1F27`), light slate ink, translucent hairlines, brand blue `#60A5FA`. Cards are frosted glass.

## 5. AI‑notes highlighter (theme‑aware blend)

The freehand highlighter (`lib/features/ai_notes/note_canvas_page.dart`, `_InkPainter`) must keep the **text color 100% unchanged** in both themes — the GoodNotes trick. It blends the whole highlighter layer onto the note:

- **Light note (dark text):** `BlendMode.multiply` → `dark × color = dark`, so dark text stays crisp and the paper takes the color.
- **Dark note (white text):** `BlendMode.screen` (multiply's mirror) → white survives (`1 ∨ x = 1`), so white text stays white and the dark paper takes the color.

Strokes are drawn opaque into one `saveLayer`, then that layer is blended onto the note once — so overlapping passes stay one uniform tone (no darkening). The highlighter layer is intentionally **not** wrapped in a `RepaintBoundary`, because the blend must see the note painted beneath it.

Highlighter/pen tool state (3 editable color favourites + 3 size presets per tool) persists in `SharedPreferences` under `lms.inktools.v4`; ink strokes per lesson under `lms.ink.<lessonId>`.

## 6. Typography

**Font:** Plus Jakarta Sans (`google_fonts`), set globally in `app_theme.dart` as body + display.

The type scale was bumped up one step (2026-06-22) because body text sat at iOS *footnote* size. Sizes are applied **inline** at call sites (no central text theme), but they follow this scale — keep new code on it:

| Role | Size | Was | iOS HIG | Material 3 |
|---|---|---|---|---|
| Hero / onboarding | 32–48 | same | Large Title 34 | Display 36 |
| Page title | 28 | same | Title1 28 | Headline 28 |
| Sub‑heading | 20–22 | same | Title2/3 20–22 | Headline 24 |
| Section / card title | 17 | 16–17 | Headline 17 | Title 16 |
| Emphasised body | 16 | 15–15.5 | Callout 16 | Body 16 |
| **Body (primary)** | **15.5** | 14–14.5 | Body 17 | Body 16 |
| Secondary text | 14 | 13–13.5 | Subhead 15 | Body 14 |
| Meta / dense | 13 | 12–12.5 | Footnote 13 | Body 12 |
| Labels / captions / chips | 12 | 11–11.5 | Caption 12 | Label 12 |

**Floor: 12** (was 9.5). Nothing below 12 for content; the old 9.5/10/10.5 sizes were retired to 11→ now 12 range. Headings (20–48) were already standard and were left unchanged.

> Rule: new text should use a size from this table. Don't introduce sizes below 12 for readable content.

## 7. Adding/Changing theme colors — checklist

1. Edit the token in `AppColors.dark` **and** `AppColors.light` in `tokens.dart`.
2. If it's a new role, add the field to the `AppColors` constructor.
3. Read it via `context.c.<token>` in widgets — never inline a hex.
4. If it's a surface, confirm `app_theme.dart` maps it (scaffold/colorScheme) so it's global.
5. Verify in **both** themes (Profile → Appearance) before shipping.
