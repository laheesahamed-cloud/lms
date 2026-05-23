# LMS Production Runbook

This runbook is the minimum production handover checklist for the React + NestJS LMS. Keep secrets in the hosting provider or server environment, not in git.

## Required Environment

Backend:

```bash
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://your-domain.com
FRONTEND_URLS=https://your-domain.com,https://app.your-domain.com
APP_PUBLIC_URL=https://your-domain.com/lms
API_PUBLIC_URL=https://your-domain.com/api
ALLOW_LAN_ORIGINS=false
BODY_LIMIT=8mb
SETTINGS_ENCRYPTION_KEY=<32+ random characters>
HEALTH_METRICS_TOKEN=<long random token>
DB_HOST=<database host>
DB_PORT=3306
DB_USER=<least-privilege app user>
DB_PASSWORD=<strong password>
DB_NAME=lms_db
```

Frontend web/PWA:

```bash
VITE_API_BASE_URL=/api
VITE_API_BASE_URLS=
VITE_LMS_BUILD_TARGET=web
VITE_ENABLE_PWA=true
VITE_PUBLIC_WEBSITE_URL=https://your-domain.com/lms
VITE_APP_ONLY_HOSTS=app.your-domain.com,app-lms.your-domain.com
```

Native app builds must use the public API URL, not a LAN address:

```bash
VITE_API_BASE_URL=https://your-domain.com/api
VITE_API_BASE_URLS=https://your-domain.com/api
VITE_LMS_BUILD_TARGET=native
VITE_ENABLE_PWA=false
```

## Server Setup

1. Serve `frontend/dist` behind HTTPS.
2. Reverse proxy `/api/*` to the NestJS backend.
3. Keep `/uploads/*` available only through the backend rules. Payment proofs must remain admin-only.
4. Use a process manager such as `systemd`, PM2, Docker, or the hosting platform supervisor.
5. Configure log retention for backend stdout/stderr.
6. Add uptime checks for `/api/health` and `/api/health/ready`.
7. Protect `/api/health/metrics` with `HEALTH_METRICS_TOKEN`.

Recommended Apache/Nginx headers for the static frontend:

```text
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: no-referrer
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

## Deployment

1. Pull the release commit.
2. Install dependencies with `npm ci`, `npm ci --prefix frontend`, and `npm ci --prefix backend`.
3. Build with `npm run build:frontend` and `npm run build:backend`.
4. Run database migrations with `npm run migrate:backend`.
5. Restart the backend process.
6. Load `/api/health/ready`.
7. Sign in as admin and check setup, settings, plans, users, lessons, questions, subscriptions, and reports.
8. Sign in as a student and check dashboard, lesson access, quiz start, quiz submit, results, billing, and logout.

## Database Backup

Create a database backup before every deployment:

```bash
mysqldump --single-transaction --routines --triggers --set-gtid-purged=OFF \
  -h "$DB_HOST" -u "$DB_USER" -p "$DB_NAME" > "backup-$(date +%Y%m%d-%H%M%S).sql"
```

Store backups outside the web root. Encrypt backups if they leave the server.

## Upload Backup

Back up these folders whenever payment proofs or user uploads are enabled:

```text
uploads/
backend/uploads/
```

Store uploads outside git and outside public static folders. Payment proof files should remain readable through authenticated admin endpoints only.

## Rollback

1. Stop the backend process.
2. Restore the previous release bundle.
3. Restore the database backup if the failed release ran migrations or wrote incompatible data.
4. Restore uploads if upload writes changed during the failed release.
5. Start the backend process.
6. Check `/api/health/ready`, admin login, student login, billing, and quiz submit.

## Payment Go-Live

Before enabling live PayHere payments:

1. Set live merchant ID and merchant secret in Admin Settings.
2. Disable sandbox mode.
3. Set return, cancel, and notify URLs to public HTTPS URLs.
4. Complete one live low-value payment.
5. Confirm the PayHere notification activates a subscription.
6. Confirm finance reports show the transaction.
7. Confirm manual payment proof uploads are visible only to authorized staff.

## AI And Email Go-Live

1. Set `SETTINGS_ENCRYPTION_KEY` before saving AI, payment, or SMTP secrets.
2. Configure SMTP and send a password reset test.
3. Configure the active AI provider and run a small AI generation test.
4. Set usage limits or billing alerts with the AI provider.

## Monitoring

Minimum alerts:

1. Backend process down.
2. `/api/health/ready` failing.
3. MySQL connection failure.
4. PayHere notification failures.
5. Password reset email failures.
6. High 401/403/429 rates.
7. Low disk space for uploads and logs.

## Launch Blockers

Do not go live if any of these are true:

1. `FRONTEND_URL` points to localhost or a LAN IP.
2. `ALLOW_LAN_ORIGINS=true` in production.
3. `SETTINGS_ENCRYPTION_KEY` is missing, short, or still the example value.
4. `DB_USER=root` or `DB_PASSWORD` is empty in production.
5. SMTP password reset has not been tested.
6. PayHere live checkout and webhook activation have not been tested.
7. No recent database backup exists.
