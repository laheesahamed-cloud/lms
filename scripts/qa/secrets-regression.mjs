import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function fail(message) {
  failures.push(message);
}

function assertContains(content, needle, label) {
  if (!content.includes(needle)) {
    fail(`${label} is missing ${needle}`);
  }
}

const gitignore = read('.gitignore');
for (const ignored of ['.env.*', '*.pem', '*.p8', 'google-services.json', 'GoogleService-Info.plist']) {
  assertContains(gitignore, ignored, '.gitignore');
}

const backendEnv = read('backend/.env');
if (/VAPID_PRIVATE_KEY=.+/.test(backendEnv)) {
  fail('backend/.env must not contain a populated VAPID_PRIVATE_KEY');
}
if (/SETTINGS_ENCRYPTION_KEY=local-development-change-me/.test(backendEnv)) {
  fail('backend/.env must not keep the default SETTINGS_ENCRYPTION_KEY');
}
if (/(AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{20,}|sk-[0-9A-Za-z_-]{20,}|ghp_[0-9A-Za-z_]{20,})/.test(backendEnv)) {
  fail('backend/.env appears to contain a hard-coded cloud/API token');
}

const capacitorEnv = read('frontend/.env.capacitor');
if (/https?:\/\/(?:10|127|192\.168|172\.(?:1[6-9]|2\d|3[01]))\./.test(capacitorEnv)) {
  fail('frontend/.env.capacitor must not expose private LAN API hosts');
}

const backendExample = read('backend/.env.example');
for (const key of [
  'EXPOSE_DEV_RESET_TOKEN=false',
  'OPENROUTER_API_KEY=',
  'FCM_SERVICE_ACCOUNT_JSON=',
  'VAPID_PRIVATE_KEY=',
]) {
  assertContains(backendExample, key, 'backend/.env.example');
}

const authService = read('backend/src/modules/auth/auth.service.ts');
if (!authService.includes('EXPOSE_DEV_RESET_TOKEN')) {
  fail('password reset token exposure must be gated by EXPOSE_DEV_RESET_TOKEN');
}
if (authService.includes("nodeEnv !== 'production' && !shouldSendEmail;")) {
  fail('password reset token exposure must not be enabled by environment alone');
}

const apiClient = read('frontend/src/shared/api/client.js');
if (!apiClient.includes('function redactSensitiveValue')) {
  fail('frontend API client logs must redact sensitive URL/message content');
}

if (failures.length) {
  console.error('Secret hygiene regression checks failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Secret hygiene regression checks passed.');
