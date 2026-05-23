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

const main = read('backend/src/main.ts');
if (!main.includes('Cross-site cookie request was blocked')) {
  fail('unsafe cookie-auth requests must have CSRF/fetch-metadata protection');
}
if (!main.includes("dotfiles: 'deny'")) {
  fail('static uploads must deny dotfiles');
}
if (!main.includes("Content-Disposition', 'attachment'")) {
  fail('static uploads must be served as attachments');
}

const uploadsController = read('backend/src/modules/uploads/uploads.controller.ts');
if (!uploadsController.includes('Content-Disposition')) {
  fail('authenticated payment proof downloads must force attachment disposition');
}

const subscriptionsService = read('backend/src/modules/subscriptions/subscriptions.service.ts');
if (!subscriptionsService.includes('hasValidPaymentProofSignature')) {
  fail('payment proof uploads must validate file signatures, not only declared MIME types');
}

const createUserDto = read('backend/src/modules/users/dto/create-user.dto.ts');
const updateUserDto = read('backend/src/modules/users/dto/update-user.dto.ts');
if (!createUserDto.includes('@MinLength(10)') || !updateUserDto.includes('@MinLength(10)')) {
  fail('admin-created and admin-reset passwords must use the same minimum length as self-service auth');
}
if (!createUserDto.includes('@Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).+$/') ||
    !updateUserDto.includes('@Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).+$/')) {
  fail('admin-created and admin-reset passwords must require mixed character classes');
}

const authController = read('backend/src/modules/auth/auth.controller.ts');
if (authController.includes("@Query('native')") || authController.includes('nativeQuery')) {
  fail('browser-controlled native query flag must not expose session tokens');
}
if (!authController.includes("@Headers('x-lms-native')")) {
  fail('native token exposure must require the native header signal');
}

const notesPage = read('frontend/src/surfaces/app/student/notes/StudentNotesPage.jsx');
if (!notesPage.includes('/^#[0-9a-f]{6}$/i')) {
  fail('annotation colors rendered into HTML must be strict hex values');
}
if (!notesPage.includes('Number.isInteger(Number(annotation.id))')) {
  fail('annotation IDs rendered into HTML attributes must be numeric-only');
}

const report = read('docs/security/owasp-top-10-risk-report.md');
for (const section of ['Broken Access Control', 'Injection', 'CSRF', 'XSS', 'Vulnerable components']) {
  if (!report.includes(section)) {
    fail(`OWASP report is missing ${section}`);
  }
}

if (failures.length) {
  console.error('OWASP regression checks failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('OWASP regression checks passed.');
