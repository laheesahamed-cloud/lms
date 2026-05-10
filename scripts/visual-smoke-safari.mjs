import fs from 'node:fs';
import path from 'node:path';

const WEBDRIVER_URL = 'http://127.0.0.1:4444';
const APP_URL = 'http://127.0.0.1:5174/lms/frontend/dist';
const outDir = path.join(process.cwd(), '.runtime', 'visual-smoke');

const adminToken = process.env.LMS_ADMIN_TOKEN;
const studentToken = process.env.LMS_STUDENT_TOKEN;

if (!adminToken || !studentToken) {
  console.error('Set LMS_ADMIN_TOKEN and LMS_STUDENT_TOKEN before running this script.');
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });

async function webdriver(method, endpoint, body) {
  const response = await fetch(`${WEBDRIVER_URL}${endpoint}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok || payload.value?.error) {
    throw new Error(payload.value?.message || text || `${method} ${endpoint} failed`);
  }
  return payload.value;
}

async function createSession() {
  const value = await webdriver('POST', '/session', {
    capabilities: {
      alwaysMatch: {
        browserName: 'safari',
      },
    },
  });
  return value.sessionId;
}

async function deleteSession(sessionId) {
  try {
    await webdriver('DELETE', `/session/${sessionId}`);
  } catch {
    // Best-effort cleanup.
  }
}

async function navigate(sessionId, url) {
  await webdriver('POST', `/session/${sessionId}/url`, { url });
}

async function setWindow(sessionId, width, height) {
  await webdriver('POST', `/session/${sessionId}/window/rect`, { width, height, x: 0, y: 0 });
}

async function execute(sessionId, script, args = []) {
  return webdriver('POST', `/session/${sessionId}/execute/sync`, { script, args });
}

async function screenshot(sessionId, name) {
  const value = await webdriver('GET', `/session/${sessionId}/screenshot`);
  const file = path.join(outDir, `${name}.png`);
  fs.writeFileSync(file, Buffer.from(value, 'base64'));
  return file;
}

async function waitForReady(sessionId) {
  const started = Date.now();
  while (Date.now() - started < 10000) {
    const state = await execute(sessionId, `
      const appText = document.body?.innerText || '';
      const booting = document.body?.classList.contains('app-booting');
      const hasRootContent = Boolean(document.querySelector('#root')?.children.length);
      return { readyState: document.readyState, booting, hasRootContent, appText: appText.slice(0, 120) };
    `);
    if (state.readyState === 'complete' && !state.booting && state.hasRootContent) {
      return state;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Timed out waiting for app readiness');
}

async function setToken(sessionId, token) {
  await navigate(sessionId, `${APP_URL}/`);
  await waitForReady(sessionId);
  await execute(sessionId, `window.localStorage.setItem('lms_auth_token', arguments[0]);`, [token]);
}

async function inspectPage(sessionId) {
  return execute(sessionId, `
    const controls = [...document.querySelectorAll('button,input,select,textarea,label')];
    const badControls = controls.filter((node) => {
      if (node.tagName === 'INPUT' && ['hidden', 'file', 'checkbox', 'radio', 'color'].includes(node.type)) return false;
      return !node.className || String(node.className).trim() === '';
    }).map((node) => ({
      tag: node.tagName.toLowerCase(),
      type: node.getAttribute('type') || '',
      text: (node.innerText || node.value || node.getAttribute('aria-label') || '').slice(0, 80),
    }));

    const viewportWidth = document.documentElement.clientWidth;
    const overflowX = Math.max(document.body.scrollWidth, document.documentElement.scrollWidth) - viewportWidth;
    const tinyControls = controls.filter((node) => {
      const rect = node.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && (rect.width < 16 || rect.height < 16);
    }).length;

    const visibleText = document.body.innerText || '';
    const errorLike = /Cannot read|undefined is not|TypeError|ReferenceError|Route error/i.test(visibleText);

    return {
      title: document.title,
      path: location.pathname + location.search,
      h1: document.querySelector('h1,h2')?.innerText || '',
      controls: controls.length,
      badControls,
      overflowX,
      tinyControls,
      errorLike,
      textSample: visibleText.slice(0, 180),
    };
  `);
}

const pages = [
  { role: 'admin', path: '/questions', width: 1440, height: 960, name: 'admin-questions-desktop' },
  { role: 'admin', path: '/quizzes/new', width: 1440, height: 960, name: 'admin-quiz-builder-desktop' },
  { role: 'student', path: '/notes', width: 390, height: 844, name: 'student-notes-mobile' },
  { role: 'student', path: '/quizzes', width: 390, height: 844, name: 'student-quizzes-mobile' },
];

const sessionId = await createSession();
const results = [];

try {
  for (const page of pages) {
    await setWindow(sessionId, page.width, page.height);
    await setToken(sessionId, page.role === 'admin' ? adminToken : studentToken);
    await navigate(sessionId, `${APP_URL}${page.path}`);
    await waitForReady(sessionId);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const info = await inspectPage(sessionId);
    const shot = await screenshot(sessionId, page.name);
    results.push({ ...page, ...info, screenshot: shot });
  }
} finally {
  await deleteSession(sessionId);
}

let failed = false;
for (const result of results) {
  const issues = [];
  if (result.errorLike) issues.push('error-like page text');
  if (result.overflowX > 4) issues.push(`horizontal overflow ${result.overflowX}px`);
  if (result.badControls.length) issues.push(`${result.badControls.length} visible bare control(s)`);
  if (result.controls === 0) issues.push('no controls found');
  if (issues.length) failed = true;

  console.log(`${issues.length ? 'FAIL' : 'PASS'} ${result.name}`);
  console.log(`  ${result.path} | heading: ${result.h1 || '(none)'}`);
  console.log(`  controls=${result.controls}, overflowX=${result.overflowX}, screenshot=${result.screenshot}`);
  if (result.badControls.length) {
    console.log(`  bare controls: ${JSON.stringify(result.badControls.slice(0, 5))}`);
  }
  if (issues.length) {
    console.log(`  issues: ${issues.join(', ')}`);
  }
}

if (failed) {
  process.exit(1);
}
