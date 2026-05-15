# Frontend Style Architecture

`index.css` is the only active stylesheet entrypoint imported by React.

Order matters:

1. `00-tokens` for CSS variables and design tokens.
2. `01-base` for reset, document, accessibility, and theme basics.
3. `02-layout` for app shell, page shell, nav, and responsive grids.
4. `03-components` for reusable buttons, cards, forms, tables, modals, tabs, badges, and states.
5. `04-pages` for page-level styling that cannot live in components yet.
6. `05-platforms` for web, PWA, native, tablet, phone, iOS, Android, and desktop runtime selectors.
7. `06-utilities` for small cross-cutting helpers.
8. `99-legacy/app.css` for existing mixed rules that are still being migrated.

New styling should go into the smallest matching layer. Keep platform-only rules in `05-platforms` using selectors such as `html[data-lms-runtime="native"]` or `html[data-lms-target="native-ios-phone"]`.
