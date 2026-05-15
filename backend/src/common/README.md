# Backend Common

Cross-module NestJS utilities live here.

- `utils/` for pure helpers used by more than one module.
- `guards/`, `filters/`, `interceptors`, `pipes`, `decorators`, and `middleware` for reusable NestJS infrastructure.

Feature-specific logic should stay inside `modules/<feature>`. Only move code here when it is genuinely shared.
