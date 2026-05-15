# Frontend Style Architecture

`index.css` is the only active stylesheet entrypoint imported by React.

Order matters:

1. `00-tokens` for CSS variables and design tokens.
2. `01-base` for reset, document, accessibility, and theme basics.
3. `02-layout` for app shell, page shell, nav, and responsive grids.
4. `99-legacy/app.css` for existing mixed rules that are still being migrated.
5. `03-components` for reusable buttons, cards, forms, tables, modals, tabs, badges, and states.
6. `04-pages` for page-level styling that cannot live in components yet.
7. `05-platforms` for web, PWA, native, tablet, phone, iOS, Android, and desktop runtime selectors.
8. `06-utilities` for small cross-cutting helpers.

`99-legacy/app.css` is imported before the migrated component/page/platform layers so new clean CSS can override old page-specific rules without adding more fixes to the legacy file.

New styling should go into the smallest matching layer. Keep platform-only rules in `05-platforms` using selectors such as `html[data-lms-runtime="native"]` or `html[data-lms-target="native-ios-phone"]`.
