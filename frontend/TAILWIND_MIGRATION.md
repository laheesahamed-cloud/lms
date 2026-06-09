# Tailwind Migration Notes

Status: **migration baseline is current**.

Use this file as guidance for future styling work. Historical completed checklist items have been removed.

## Current Structure

- `src/styles/index.css` is the Tailwind/shared stylesheet entrypoint.
- `src/styles/99-legacy/app.css` contains the legacy mixed stylesheet while rules are migrated into the numbered style layers.
- `shared/theme.css` owns design tokens, brand tokens, dark mode variables, and accent theme variables.
- `shared/foundation.css` owns document/root reset, root/body sizing, text selection, scrollbar pseudo-elements, browser view-transition hooks, and PWA display-mode hooks.
- `src/styles/tailwindClasses.js` owns reusable Tailwind utility class maps for common UI patterns.

## Styling Rules

- Prefer Tailwind utilities or `src/styles/tailwindClasses.js` for ordinary component styling.
- Put shared CSS in the matching numbered layer: tokens, base, layout, components, pages, platforms, then utilities.
- Add shared CSS only for document roots, browser pseudo-elements/media hooks, third-party/browser overrides, generated markup that cannot receive React classes, or cross-component state hooks.
- Native controls should use explicit classes such as `ui.primaryAction`, `ui.secondaryAction`, `ui.iconButton`, `ui.formLabel`, `ui.input`, `ui.textarea`, `ui.checkboxRow`, `ui.inlineCheck`, or page-local equivalents.
- Generated annotation markup may keep embedded utility classes because it is rendered from strings.

## Verification

Run these checks after styling or route changes:

```bash
npm run build
```
