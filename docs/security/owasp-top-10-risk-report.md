# OWASP Top 10 Security Review

Date: 2026-05-23

Scope: NestJS API, React/Vite frontend, auth/session handling, upload paths, CORS/CSRF boundaries, security headers, dependency audit, secret hygiene checks, and existing QA regression scripts.

## Executive Summary

Critical and high-risk issues found during this pass have been fixed and covered by regression checks. The app now has server-side route/permission enforcement, parameterized SQL helpers, cookie-origin CSRF protections, stricter file upload handling, stronger admin-created password policy, and clean dependency audits.

Residual risks are medium/low operational hardening items: in-memory rate limits should move to a shared store before horizontal scaling, CSP still allows inline styles for frontend compatibility, and security logs should be shipped to centralized alerting in production.

## Prioritized Findings

| Priority | OWASP area | Risk | Status |
| --- | --- | --- | --- |
| Critical | A01 Broken Access Control | Student/admin route boundaries and object ownership must be enforced server-side. Prior hardening added role/permission checks, route-boundary rewrites, and student ownership checks for lessons, quizzes, subscriptions, bookmarks, planner tasks, doubts, and notes. | Mitigated with regression coverage |
| Critical | A03 Injection | Raw SQL, dynamic `IN` clauses, and report filters can become exploitable if identifiers/fragments are interpolated from request input. Prior hardening added parameterized queries and SQL helper allow-lists. | Mitigated with regression coverage |
| High | A01 Broken Access Control | Inactive staff sessions could still pass permission-only routes or the default subscriptions route after a staff account was deactivated. | Fixed: global permission guard and subscription default route now reject inactive staff sessions |
| High | A07 Auth/session flaws | Admin-created or admin-reset passwords accepted 6-character passwords while self-service auth required stronger passwords. | Fixed: admin user create/update now require 10+ chars with uppercase, lowercase, and number |
| High | A06 Vulnerable components | Dependency audit found high-severity issues in frontend `axios` and backend transitive `protobufjs`, plus related moderate findings. | Fixed: lockfiles updated; backend and frontend audits report zero vulnerabilities |
| High | A05 Insecure file uploads | Payment proofs trusted declared MIME/data URL type and the authenticated download controller did not force attachment disposition. | Fixed: payment proof files now require matching PNG/JPEG/WEBP/PDF signatures and download as attachments |
| High | A07 Auth/session flaws | Web login/register previously allowed browser-controlled native token exposure. | Fixed earlier: session token exposure requires `x-lms-native` header |
| High | A01/A05 CSRF and CORS | Cookie-backed auth needs explicit origin/fetch-metadata checks on unsafe methods. | Fixed earlier: unsafe cookie requests from cross-site contexts are blocked and CORS is allow-listed |
| High | A03 XSS | Notebook annotation IDs/colors were rendered into generated HTML attributes/styles. | Fixed earlier: IDs are numeric-only and colors are strict hex values |
| High | A02 Cryptographic failures | Environment files previously contained weak/local secrets and a VAPID private key. | Fixed earlier; rotate any previously exposed VAPID key material |
| Medium | A05 Security headers | API responses include CSP, frame denial, nosniff, referrer policy, permissions policy, and CORP. CSP still allows inline styles for app compatibility. | Accepted residual risk |
| Medium | A04 Insecure design | Rate limiting is in-memory and resets on process restart; it will not coordinate across replicas. | Follow-up: use Redis/shared limiter before scaling horizontally |
| Medium | A09 Logging/monitoring | Security/content audit logs exist, but alerting depends on deployment log collection. | Follow-up: ship logs to SIEM/alerting and alert on rate limits, invalid webhooks, and multi-device warnings |
| Medium | A10 SSRF | Admin-managed AI provider base URLs can target arbitrary HTTPS endpoints. This is limited to settings-capable staff but should be constrained in production. | Follow-up: allow-list known provider hosts or require an explicit trusted custom-provider mode |
| Low | A05 Debug/verbose errors | Production config assertions are present; development mode can expose more diagnostic detail. | Accept for local development; verify `NODE_ENV=production` in deployment |

## Checklist Results

| Checklist item | Result |
| --- | --- |
| Injection | Parameterized SQL and helper allow-lists are in place; regression checks cover unsafe identifiers/fragments. |
| Broken access control | Admin/student route boundaries, permission metadata, inactive staff rejection, and student object ownership are enforced server-side. |
| Insecure design | Main concern is operational: rate limits need a shared backing store before multi-instance deployment. |
| Auth/session flaws | Sessions are hashed server-side, expire, use HttpOnly cookies for web, and native bearer exposure is header-gated. Admin-created passwords now match stronger auth policy. |
| Vulnerable dependencies | `npm audit --audit-level=moderate` passes for backend and frontend. |
| Unsafe CORS | CORS is origin allow-listed; LAN/dev origins are blocked by production assertions. |
| Missing security headers | Core API headers are set globally. |
| CSRF | Unsafe cookie-auth requests are blocked by origin/fetch-metadata checks. |
| XSS | React escaping covers normal rendering; generated notebook HTML escapes lesson text and validates annotation attributes/styles. |
| Insecure file uploads | CSV imports are size/type-limited; payment proof files now validate file signatures and force attachment downloads. |
| Verbose errors/debug mode | Production startup assertions reduce unsafe config; no debug route is exposed. |
| Missing rate limits | Auth, admin, AI/import/generate, and student content paths have rate limits; Redis/shared limiting remains a follow-up. |
| Weak logging/monitoring | Security access and content access events are logged; centralized alerting remains a deployment requirement. |

## Verification

- `npm audit --audit-level=moderate --prefix backend`
- `npm audit --audit-level=moderate --prefix frontend`
- `npm test`
- `npm run build:backend`
- `npm run build:frontend`
