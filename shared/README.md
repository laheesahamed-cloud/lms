# Shared

Shared code used across app boundaries belongs here.

- `constants/` for stable cross-app constants.
- `types/` for shared TypeScript shapes.
- `validation/` for schemas shared by frontend/backend.
- `contracts/` for API request/response contracts.

Avoid importing frontend-only or backend-only dependencies from this folder.
