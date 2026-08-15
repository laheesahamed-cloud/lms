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
// Lesson PDFs and images have to render in place, so a blanket attachment rule is
// no longer workable. The invariant that replaces it: inline is an explicit
// allowlist of inert types, and everything else still downloads.
if (!main.includes('INLINE_SAFE_UPLOAD_EXTENSIONS')) {
  fail('static uploads must decide Content-Disposition from an inline-safe allowlist');
}
if (!/INLINE_SAFE_UPLOAD_EXTENSIONS\.has\(extension\)\s*\?\s*'inline'\s*:\s*'attachment'/.test(main)) {
  fail('static uploads must fall back to attachment for types outside the inline allowlist');
}
const inlineAllowlist = main.match(/INLINE_SAFE_UPLOAD_EXTENSIONS = new Set\(\[([^\]]*)\]/)?.[1] || '';
for (const scriptableExtension of ['html', 'htm', 'svg', 'xml', 'xhtml', 'js']) {
  if (new RegExp(`'${scriptableExtension}'`).test(inlineAllowlist)) {
    fail(`scriptable upload type .${scriptableExtension} must never be served inline`);
  }
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

// The old student notes page (frontend/src/surfaces/app/student/notes/StudentNotesPage.jsx)
// hand-built an HTML string from annotation data, so it had to validate the
// annotation id and colour before interpolating them into attributes. That page
// was deleted and replaced by the ai-notes NoteCanvas, which renders a React
// tree instead of concatenating markup — the annotation-id check has no
// equivalent because annotations no longer exist. What still matters is the
// underlying invariant: user-controlled values never reach raw markup.
const noteCanvas = read('frontend/src/surfaces/app/student/ai-notes/NoteCanvas.jsx');
if (!noteCanvas.includes('/^#[0-9a-f]{6}$/i')) {
  fail('note colors must be validated as strict hex values before being rendered');
}

// Raw-HTML injection sinks: the only allowed dangerouslySetInnerHTML is the
// static stylesheet constant in the marketing hero. Any new one — or that one
// growing an interpolated value — must be reviewed rather than land silently.
const rawHtmlSinks = [];
for (const dir of ['frontend/src']) {
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(path.join(root, current), { withFileTypes: true })) {
      const relPath = `${current}/${entry.name}`;
      if (entry.isDirectory()) {
        stack.push(relPath);
      } else if (/\.(jsx?|tsx?)$/.test(entry.name) && read(relPath).includes('dangerouslySetInnerHTML')) {
        rawHtmlSinks.push(relPath);
      }
    }
  }
}
const allowedRawHtmlSinks = ['frontend/src/surfaces/website/components/CinematicHero.jsx'];
for (const sink of rawHtmlSinks) {
  if (!allowedRawHtmlSinks.includes(sink)) {
    fail(`unreviewed dangerouslySetInnerHTML sink: ${sink}`);
  }
}
const heroStyles = read('frontend/src/surfaces/website/components/CinematicHero.jsx');
if (!heroStyles.includes('dangerouslySetInnerHTML={{ __html: INJECTED_STYLES }}')) {
  fail('hero raw-HTML sink must render the static INJECTED_STYLES constant only');
}
// INJECTED_STYLES interpolates design tokens; every one must resolve to a
// module-level string literal, so no request/user value can reach the stylesheet.
const injectedStylesTemplate = heroStyles.match(/const INJECTED_STYLES = `([^`]*)`/)?.[1] || '';
for (const [, expression] of injectedStylesTemplate.matchAll(/\$\{([^}]*)\}/g)) {
  const token = expression.trim();
  if (!new RegExp(`^const ${token} = ['"\`]`, 'm').test(heroStyles)) {
    fail(`INJECTED_STYLES interpolates "${token}", which is not a static string constant`);
  }
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
