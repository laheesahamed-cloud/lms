import fs from 'node:fs';
import path from 'node:path';

const CDP_HTTP = 'http://127.0.0.1:9222';
const APP_URL = 'http://127.0.0.1:5174/lms/frontend/dist';
const outDir = path.join(process.cwd(), '.runtime', 'visual-smoke');

const adminToken = process.env.LMS_ADMIN_TOKEN;
const studentToken = process.env.LMS_STUDENT_TOKEN;

if (!adminToken || !studentToken) {
  console.error('Set LMS_ADMIN_TOKEN and LMS_STUDENT_TOKEN before running this script.');
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });

async function getJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || `${url} failed`);
  }
  return text ? JSON.parse(text) : {};
}

class CdpPage {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
    this.ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) {
          reject(new Error(message.error.message || JSON.stringify(message.error)));
        } else {
          resolve(message.result || {});
        }
      } else if (message.method) {
        this.events.push(message);
      }
    });
  }

  async ready() {
    if (this.ws.readyState === WebSocket.OPEN) return;
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
  }

  async send(method, params = {}) {
    await this.ready();
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`${method} timed out`));
        }
      }, 15000);
    });
  }

  close() {
    this.ws.close();
  }
}

async function createPage() {
  let target;
  try {
    target = await getJson(`${CDP_HTTP}/json/new`, { method: 'PUT' });
  } catch {
    const pages = await getJson(`${CDP_HTTP}/json/list`);
    target = pages.find((page) => page.type === 'page');
  }
  if (!target?.webSocketDebuggerUrl) {
    throw new Error('Unable to create Chrome DevTools page target.');
  }
  const page = new CdpPage(target.webSocketDebuggerUrl);
  await page.ready();
  await page.send('Page.enable');
  await page.send('Runtime.enable');
  return page;
}

async function evaluate(page, expression, awaitPromise = false) {
  const result = await page.send('Runtime.evaluate', {
    expression,
    awaitPromise,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || 'Runtime evaluation failed');
  }
  return result.result?.value;
}

async function navigate(page, url) {
  await page.send('Page.navigate', { url });
}

async function setViewport(page, width, height) {
  await page.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 700,
  });
}

async function waitForReady(page) {
  const started = Date.now();
  while (Date.now() - started < 12000) {
    const state = await evaluate(page, `(() => {
      const appText = document.body?.innerText || '';
      return {
        readyState: document.readyState,
        booting: document.body?.classList.contains('app-booting'),
        hasRootContent: Boolean(document.querySelector('#root')?.children.length),
        sample: appText.slice(0, 100),
      };
    })()`);
    if (state.readyState === 'complete' && !state.booting && state.hasRootContent) {
      return state;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Timed out waiting for app readiness');
}

async function setToken(page, token) {
  await navigate(page, `${APP_URL}/`);
  await waitForReady(page);
  await evaluate(page, `window.localStorage.setItem('lms_auth_token', ${JSON.stringify(token)});`);
}

async function inspectPage(page) {
  return evaluate(page, `(() => {
    const controls = [...document.querySelectorAll('button,input,select,textarea,label')];
    const badControls = controls.filter((node) => {
      if (node.tagName === 'INPUT' && ['hidden', 'file', 'checkbox', 'radio', 'color'].includes(node.type)) return false;
      const className = typeof node.className === 'string' ? node.className : '';
      return className.trim() === '';
    }).map((node) => ({
      tag: node.tagName.toLowerCase(),
      type: node.getAttribute('type') || '',
      text: (node.innerText || node.value || node.getAttribute('aria-label') || '').slice(0, 80),
    }));
    const viewportWidth = document.documentElement.clientWidth;
    const overflowX = Math.max(document.body.scrollWidth, document.documentElement.scrollWidth) - viewportWidth;
    const visibleText = document.body.innerText || '';
    return {
      title: document.title,
      path: location.pathname + location.search,
      heading: document.querySelector('h1,h2')?.innerText || '',
      controls: controls.length,
      badControls,
      overflowX,
      errorLike: /Cannot read|undefined is not|TypeError|ReferenceError|Route error/i.test(visibleText),
      sample: visibleText.slice(0, 180),
    };
  })()`);
}

async function screenshot(page, name) {
  const result = await page.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });
  const file = path.join(outDir, `${name}.png`);
  fs.writeFileSync(file, Buffer.from(result.data, 'base64'));
  return file;
}

const pages = [
  { role: 'admin', path: '/questions', width: 1440, height: 960, name: 'admin-questions-desktop' },
  { role: 'admin', path: '/quizzes/new', width: 1440, height: 960, name: 'admin-quiz-builder-desktop' },
  { role: 'student', path: '/notes', width: 390, height: 844, name: 'student-notes-mobile' },
  { role: 'student', path: '/quizzes', width: 390, height: 844, name: 'student-quizzes-mobile' },
];

const page = await createPage();
const results = [];

try {
  for (const item of pages) {
    await setViewport(page, item.width, item.height);
    await setToken(page, item.role === 'admin' ? adminToken : studentToken);
    await navigate(page, `${APP_URL}${item.path}`);
    await waitForReady(page);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const info = await inspectPage(page);
    const shot = await screenshot(page, item.name);
    results.push({ ...item, ...info, screenshot: shot });
  }
} finally {
  page.close();
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
  console.log(`  ${result.path} | heading: ${result.heading || '(none)'}`);
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
