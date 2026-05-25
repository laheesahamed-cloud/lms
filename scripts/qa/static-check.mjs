import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const requiredFiles = [
  'frontend/package.json',
  'backend/package.json',
  'backend/src/app.module.ts',
  'backend/src/main.ts',
  'frontend/src/main.jsx',
  'docs/deployment/production-runbook.md',
];

const failures = [];

for (const file of requiredFiles) {
  if (!existsSync(join(root, file))) {
    failures.push(`Missing required file: ${file}`);
  }
}

const backendPackage = JSON.parse(readFileSync(join(root, 'backend/package.json'), 'utf8'));
const frontendPackage = JSON.parse(readFileSync(join(root, 'frontend/package.json'), 'utf8'));
const readProjectFile = (file) => readFileSync(join(root, file), 'utf8');

if (!backendPackage.scripts?.build) failures.push('backend/package.json is missing scripts.build');
if (!frontendPackage.scripts?.build) failures.push('frontend/package.json is missing scripts.build');

const appModule = readProjectFile('backend/src/app.module.ts');
for (const moduleName of ['AuthModule', 'CoursesModule', 'QuizAttemptsModule', 'ResultsModule', 'DashboardModule']) {
  if (!appModule.includes(moduleName)) {
    failures.push(`AppModule is missing ${moduleName}`);
  }
}

const backendEnvExample = readProjectFile('backend/.env.example');
for (const key of [
  'NODE_ENV=production',
  'FRONTEND_URL=',
  'FRONTEND_URLS=',
  'APP_PUBLIC_URL=',
  'API_PUBLIC_URL=',
  'ALLOW_LAN_ORIGINS=false',
  'SETTINGS_ENCRYPTION_KEY=',
  'HEALTH_METRICS_TOKEN=',
  'DB_PASSWORD=',
]) {
  if (!backendEnvExample.includes(key)) {
    failures.push(`backend/.env.example is missing production key: ${key}`);
  }
}

const frontendEnvExample = readProjectFile('frontend/.env.example');
if (!frontendEnvExample.includes('VITE_API_BASE_URL=/api')) {
  failures.push('frontend/.env.example should default production web builds to same-origin /api');
}

const mainTs = readProjectFile('backend/src/main.ts');
for (const forbidden of ['192.168.0.117', '192.168.2.189', '172.20.10.2']) {
  if (mainTs.includes(forbidden)) {
    failures.push(`backend/src/main.ts still contains hard-coded LAN origin ${forbidden}`);
  }
}
for (const requiredSnippet of [
  'buildContentSecurityPolicy',
  'assertProductionConfig',
  'FRONTEND_URLS',
]) {
  if (!mainTs.includes(requiredSnippet)) {
    failures.push(`backend/src/main.ts is missing production hardening snippet: ${requiredSnippet}`);
  }
}

const rolePermissions = readProjectFile('backend/src/modules/auth/role-permissions.ts');
for (const permission of ['plans.manage', 'settings.manage', 'ai.manage', 'notifications.manage']) {
  if (!rolePermissions.includes(permission)) {
    failures.push(`role-permissions.ts is missing ${permission}`);
  }
}

for (const [file, permissions] of [
  ['backend/src/modules/settings/settings.controller.ts', ['settings.manage']],
  ['backend/src/modules/plans/plans.controller.ts', ['plans.manage']],
  ['backend/src/modules/subscriptions/subscriptions.controller.ts', ['subscriptions.manage']],
  ['backend/src/modules/push-notifications/push-notifications.controller.ts', ['notifications.manage']],
  ['backend/src/modules/ai/ai.controller.ts', ['ai.manage']],
  ['backend/src/modules/workspace/workspace.controller.ts', ['notifications.manage', 'reports.view']],
]) {
  const source = readProjectFile(file);
  if (!source.includes('RequirePermissions')) {
    failures.push(`${file} is missing RequirePermissions`);
  }
  for (const permission of permissions) {
    if (!source.includes(permission)) {
      failures.push(`${file} is missing permission guard ${permission}`);
    }
  }
}

const runbook = readProjectFile('docs/deployment/production-runbook.md');
for (const section of ['Required Environment', 'Database Backup', 'Rollback', 'Payment Go-Live', 'Launch Blockers']) {
  if (!runbook.includes(section)) {
    failures.push(`production-runbook.md is missing section: ${section}`);
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('Static LMS smoke checks passed.');
