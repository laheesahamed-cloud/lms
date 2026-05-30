import { spawn } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';

const repoRoot = path.resolve(new URL('../..', import.meta.url).pathname);
const chromePath = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const chromePort = Number(process.env.CDP_PORT || 9633);
const cssAsset = (await readdir(path.join(repoRoot, 'frontend/dist/assets')))
  .find((file) => /^app-.*\.css$/.test(file));

if (!cssAsset) {
  throw new Error('No built app CSS asset found. Run npm run build --prefix frontend first.');
}

const cssText = (await readFile(path.join(repoRoot, 'frontend/dist/assets', cssAsset), 'utf8'))
  .replaceAll('</style', '<\\/style');

const scenarios = [
  { name: 'web-light', attrs: 'data-theme="light" data-lms-runtime="web" data-lms-form-factor="phone"' },
  { name: 'pwa-dark', attrs: 'data-theme="dark" data-lms-runtime="pwa" data-lms-form-factor="phone"' },
  { name: 'native-ios-dark', attrs: 'data-theme="dark" data-lms-runtime="native" data-lms-form-factor="phone" data-browser-engine="webkit" data-lms-target="native-ios-phone"' },
  { name: 'native-ios-dark-tablet-attr', attrs: 'data-theme="dark" data-lms-runtime="native" data-lms-form-factor="tablet" data-browser-engine="webkit" data-lms-target="native-ios-tablet"' },
  { name: 'native-ios-dark-no-formfactor', attrs: 'data-theme="dark" data-lms-runtime="native" data-browser-engine="webkit"' },
];

const viewports = [
  { width: 320, height: 568 },
  { width: 360, height: 640 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];

function requestJson(url, { method = 'GET' } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function requestJsonWithRetry(url, options = {}, attempts = 20) {
  let lastError;
  for (let index = 0; index < attempts; index += 1) {
    try {
      return await requestJson(url, options);
    } catch (error) {
      lastError = error;
      await wait(200);
    }
  }
  throw lastError;
}

class CdpClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
  }

  async open() {
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });

    this.ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
    });
  }

  send(method, params = {}) {
    const id = this.nextId;
    this.nextId += 1;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  close() {
    this.ws.close();
  }
}

function fixtureHtml(attrs) {
  return `<!doctype html>
<html lang="en" ${attrs}>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <style>
    ${cssText}
    body { margin: 0; }
    .qa-wrap { width: 100%; max-width: 100%; padding: 12px; box-sizing: border-box; }
    .qa-box { min-height: 100px; }
  </style>
</head>
<body class="app-ready">
  <main class="dashboard-page lms-route-page">
    <section class="management-layout qa-wrap">
      <header class="lms-topbar glass-card">
        <div class="lms-topbar-left">
          <button class="lms-topbar-menu-button" type="button" aria-label="Open navigation"></button>
          <div><h1>Study Hub</h1></div>
        </div>
        <div class="lms-topbar-center"></div>
        <div class="lms-topbar-right">
          <div class="lms-topbar-utility">
            <button type="button" aria-label="Install xyndrome app"></button>
            <button type="button" aria-label="Switch theme"></button>
            <div><button type="button" aria-label="Notifications"></button></div>
            <button type="button" aria-label="Search"></button>
            <div><button type="button" aria-label="Open profile menu"><span class="lms-profile-avatar"></span></button></div>
          </div>
        </div>
      </header>

      <section class="lms-dashboard-welcome-card lms-hero-card lms-dashboard-hero-card qa-box" data-score-band="fail" data-study-move="exam">
        <div class="lms-dashboard-welcome-copy">
          <span class="lms-rc-eyebrow">xyndrome</span>
          <h2>Welcome back, Laheez</h2>
          <p class="lms-hero-quiz-context">Next study move - EXAM</p>
        </div>
        <div class="lms-dashboard-welcome-mascot"></div>
        <div class="lms-dashboard-hero-actions">
          <button class="lms-dashboard-hero-primary"><span>Start exam</span></button>
          <button class="lms-dashboard-hero-secondary"><span>View last result</span></button>
        </div>
      </section>

      <section class="lms-dashboard-quick-actions">
        <button class="lms-dashboard-quick-action"><span class="lms-dashboard-quick-action__icon"></span><span class="lms-dashboard-quick-action__copy"><strong>Review answers</strong></span></button>
        <button class="lms-dashboard-quick-action"><span class="lms-dashboard-quick-action__icon"></span><span class="lms-dashboard-quick-action__copy"><strong>Start exam</strong></span></button>
        <button class="lms-dashboard-quick-action"><span class="lms-dashboard-quick-action__icon"></span><span class="lms-dashboard-quick-action__copy"><strong>Review lesson</strong></span></button>
      </section>

      <section class="lms-imc-grid">
        <article class="lms-imc-card lms-imc-card--blue"><strong class="lms-imc-value">8</strong><span class="lms-imc-label">Available exams</span></article>
        <article class="lms-imc-card lms-imc-card--teal"><strong class="lms-imc-value">4</strong><span class="lms-imc-label">Total attempts</span></article>
        <article class="lms-imc-card lms-imc-card--slate"><strong class="lms-imc-value">25.63%</strong><span class="lms-imc-label">Average score</span></article>
        <article class="lms-imc-card lms-imc-card--violet"><strong class="lms-imc-value">0 days</strong><span class="lms-imc-label">Exam day streak</span></article>
      </section>

      <section class="lms-score-today-grid">
        <article class="lms-dashboard-card lms-score-trend-card qa-box">
          <div class="lms-stc-header"><div><span>Score Trend</span><h2>Your last 4 exam results</h2></div><div class="lms-stc-stat"><strong>25.63%</strong><span>avg</span></div></div>
        </article>
        <article class="lms-dashboard-card lms-dashboard-today-shell">
          <div class="lms-dashboard-today-card qa-box">
            <h2>Review Rheumatology today</h2>
            <div class="sd-study-route">
              <span class="sd-study-node">Review</span><span class="sd-study-line"></span>
              <span class="sd-study-node">Exam</span><span class="sd-study-line"></span>
              <span class="sd-study-node">Track</span>
            </div>
            <p class="sd-today-summary">Medicine is the clearest place to pick up points right now.</p>
            <div><button class="sd-today-action">Start Exam</button></div>
          </div>
        </article>
      </section>

      <section class="lms-dashboard-main-grid">
        <article class="lms-dashboard-card qa-box"><h2>Recent Attempts</h2><button class="sd-data-row"><span>0%</span><span class="sd-attempt-copy"><strong>ai</strong><span>Medicine - Cardiology</span></span><span class="sd-status-pill">fail</span></button></article>
        <article class="lms-dashboard-card qa-box"><h2>Daily Goals</h2><button class="sd-data-row sd-goal-row"><span>1</span><span class="sd-goal-main"><strong>Take an exam</strong></span><span class="sd-status-pill">Pending</span></button></article>
      </section>
    </section>
  </main>

  <main class="student-quiz-map-page lms-route-page">
    <section class="management-layout qa-wrap">
      <section class="student-page-hero lms-hero-card qa-box"></section>
      <section class="lms-page-header-card qa-box"><h2>Medicine</h2></section>
      <section class="lms-map-hierarchy-guide">
        <div class="grid">
          <div><span>01</span><strong>Subject</strong></div><span aria-hidden="true"></span>
          <div><span>02</span><strong>Topic</strong></div><span aria-hidden="true"></span>
          <div><span>03</span><strong>Practice sets</strong></div>
        </div>
        <p>Subjects stay closed first. Open one subject, then a topic, then choose a set.</p>
      </section>
      <button class="lms-quiz-card lms-quiz-course-card">
        <div><span></span><strong>Medicine</strong></div>
        <div><span>7 sets · 7 done</span><span>100%</span></div>
      </button>
      <button class="lms-quiz-subject-card grid">
        <span aria-hidden="true"></span>
        <div><span></span><div><h3>Cardiology</h3><p>1 topic · 3 practice sets · 3 done</p></div></div>
        <div><span></span><strong>100%</strong><span></span></div>
      </button>
      <section class="lms-quiz-topic-card">
        <span aria-hidden="true"></span>
        <button type="button"><span></span><div><strong>Other quizzes</strong><span>3/3 sets completed</span></div><div><span>3/3</span></div></button>
        <div>
          <div class="lms-quiz-set-card">
            <div class="grid">
              <button type="button"><span></span><span><strong>A very long cardiology practice set title should wrap cleanly</strong><span>Medicine · Cardiology</span></span></button>
              <div><button type="button"><span>Review answers</span></button><button type="button"></button></div>
            </div>
          </div>
        </div>
      </section>
    </section>
  </main>

  <main class="lms-exam-page lms-route-page">
    <section class="lms-exam-layout qa-wrap">
      <div class="lms-exam-grid grid">
        <aside class="lms-exam-sidebar grid">
          <section class="lms-exam-main-card">
            <div class="lms-exam-question-nav grid">
              <button>1</button><button>2</button><button>3</button><button>4</button>
            </div>
            <div class="lms-exam-nav-legend">
              <span><i></i>Current</span><span><i></i>Answered</span><span><i></i>Not answered</span><span><i></i>Flagged</span>
            </div>
          </section>
        </aside>
        <article class="lms-exam-main-card">
          <p class="lms-reading-question">A 20 year old male complains of arthritis and eye irritation. This question copy is intentionally long so narrow iPhones cannot clip it horizontally.</p>
          <div><button class="lms-reading-answer">An ANA is very likely to be positive</button></div>
        </article>
      </div>
    </section>
  </main>
</body>
</html>`;
}

function metricScript() {
  return `(() => {
    const get = (selector) => document.querySelector(selector);
    const columns = (selector) => {
      const el = get(selector);
      if (!el) return 0;
      const value = getComputedStyle(el).gridTemplateColumns;
      if (!value || value === 'none') return 0;
      return value.trim().split(/\\s+/).length;
    };
    const cssValue = (selector, property) => {
      const el = get(selector);
      if (!el) return null;
      return getComputedStyle(el).getPropertyValue(property);
    };
    const overflows = Array.from(document.querySelectorAll('body *')).filter((el) => {
      const rect = el.getBoundingClientRect();
      return rect.right > window.innerWidth + 1 || rect.left < -1;
    }).slice(0, 8).map((el) => ({
      className: el.className,
      left: Math.round(el.getBoundingClientRect().left),
      right: Math.round(el.getBoundingClientRect().right),
    }));

    return {
      width: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
      scoreColumns: columns('.lms-score-today-grid'),
      mainColumns: columns('.lms-dashboard-main-grid'),
      imcColumns: columns('.lms-imc-grid'),
      quickColumns: columns('.lms-dashboard-quick-actions'),
      studyRouteColumns: columns('.sd-study-route'),
      studyRouteTemplate: cssValue('.sd-study-route', 'grid-template-columns'),
      heroColumns: columns('.lms-dashboard-welcome-card'),
      heroTemplate: cssValue('.lms-dashboard-welcome-card', 'grid-template-columns'),
      heroBackground: cssValue('.lms-dashboard-welcome-card', 'background-image'),
      heroHeight: Math.round(get('.lms-dashboard-welcome-card')?.getBoundingClientRect?.().height || 0),
      topbarTitleOverflow: (() => {
        const el = get('.lms-topbar h1');
        return el ? el.scrollWidth - el.clientWidth : 0;
      })(),
      quizHierarchyColumns: columns('.lms-map-hierarchy-guide > div'),
      quizSubjectColumns: columns('.lms-quiz-subject-card'),
      quizSetColumns: columns('.lms-quiz-set-card > div'),
      quizHeroDisplay: cssValue('.student-quiz-map-page .student-page-hero', 'display'),
      examGridColumns: columns('.lms-exam-grid'),
      examNavColumns: columns('.lms-exam-question-nav'),
      overflowingNodes: overflows,
    };
  })()`;
}

async function main() {
  const chrome = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${chromePort}`,
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'ignore'] });

  try {
    await requestJsonWithRetry(`http://127.0.0.1:${chromePort}/json/version`);
    const target = await requestJson(`http://127.0.0.1:${chromePort}/json/new?about:blank`, { method: 'PUT' });
    const client = new CdpClient(target.webSocketDebuggerUrl);
    await client.open();
    await client.send('Page.enable');
    await client.send('Runtime.enable');

    async function evaluate(expression) {
      const result = await client.send('Runtime.evaluate', {
        expression,
        returnByValue: true,
      });
      return result.result.value;
    }

    async function waitForFixture() {
      for (let index = 0; index < 30; index += 1) {
        const ready = await evaluate(`({
          href: location.href.slice(0, 80),
          state: document.readyState,
          hasFixture: Boolean(document.querySelector('.lms-score-today-grid')),
          bodyLength: document.body ? document.body.innerHTML.length : 0
        })`);
        if (ready.hasFixture) return;
        await wait(100);
      }
      throw new Error('Responsive fixture did not load in Chrome.');
    }

    const rows = [];
    for (const scenario of scenarios) {
      for (const viewport of viewports) {
        await client.send('Emulation.setDeviceMetricsOverride', {
          width: viewport.width,
          height: viewport.height,
          deviceScaleFactor: viewport.width <= 430 ? 2 : 1,
          mobile: viewport.width <= 430,
        });
        const url = `data:text/html;charset=utf-8,${encodeURIComponent(fixtureHtml(scenario.attrs))}`;
        await client.send('Page.navigate', { url });
        await waitForFixture();
        await wait(250);
        rows.push({ scenario: scenario.name, ...viewport, ...(await evaluate(metricScript())) });
      }
    }

    client.close();

    let failed = false;
    for (const row of rows) {
      const phone = row.width <= 430;
      const scoreTintedHero = /239[,\s]+68[,\s]+68|33[,\s]+13[,\s]+20|42[,\s]+19[,\s]+32/i.test(String(row.heroBackground || ''));
      const expectedImcColumns = row.width <= 420 ? 1 : 2;
      const failedShared =
        row.overflow > 1 ||
        row.topbarTitleOverflow > 1 ||
        row.overflowingNodes.length > 0;
      const expectedPhone =
        phone &&
        (failedShared ||
          row.scoreColumns !== 1 ||
          row.mainColumns !== 1 ||
          row.imcColumns !== expectedImcColumns ||
          row.quickColumns !== 3 ||
          row.heroColumns > 3 ||
          scoreTintedHero ||
          row.studyRouteColumns > 3 ||
          row.quizHierarchyColumns !== 3 ||
          row.quizSubjectColumns !== 1 ||
          row.quizSetColumns !== 1 ||
          row.examGridColumns !== 1 ||
          row.examNavColumns < 1);
      const expectedTabletDesktop = !phone && failedShared;
      if (expectedPhone || expectedTabletDesktop) failed = true;
      console.log(JSON.stringify({ ok: !(expectedPhone || expectedTabletDesktop), ...row }));
    }

    if (failed) {
      process.exitCode = 1;
    }
  } finally {
    chrome.kill('SIGTERM');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
