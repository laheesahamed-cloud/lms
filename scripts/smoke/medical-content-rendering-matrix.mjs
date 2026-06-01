import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

const repoRoot = path.resolve(new URL('../..', import.meta.url).pathname);
const frontendRoot = path.join(repoRoot, 'frontend');
const outDir = path.join(repoRoot, 'artifacts', 'medical-content-rendering-matrix');
const fixtureDir = path.join(outDir, '_fixture');
const chromePath = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const chromePort = Number(process.env.CDP_PORT || 9634);
const vitePort = Number(process.env.MEDICAL_RENDERING_VITE_PORT || 5194);

const viewports = [
  { name: 'phone-small-320', width: 320, height: 568, mobile: true, deviceScaleFactor: 2 },
  { name: 'phone-390', width: 390, height: 844, mobile: true, deviceScaleFactor: 2 },
  { name: 'tablet-768', width: 768, height: 1024, mobile: false, deviceScaleFactor: 1 },
  { name: 'desktop-1280', width: 1280, height: 900, mobile: false, deviceScaleFactor: 1 },
];

const sampleSvg = encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">
  <rect width="1280" height="720" fill="#eef4f8"/>
  <rect x="140" y="70" width="1000" height="580" rx="36" fill="#d9e6ee" stroke="#93a7b5" stroke-width="8"/>
  <ellipse cx="480" cy="355" rx="210" ry="250" fill="#f8fbfd" stroke="#8297a6" stroke-width="7"/>
  <ellipse cx="800" cy="355" rx="210" ry="250" fill="#f8fbfd" stroke="#8297a6" stroke-width="7"/>
  <path d="M760 438c70-28 150-30 238-8 18 5 27 26 17 43-42 71-126 117-220 117-88 0-168-40-213-104-12-18-4-42 16-50 53-21 107-20 162 2z" fill="#b9d2df"/>
  <path d="M640 120v490" stroke="#8297a6" stroke-width="12" stroke-linecap="round"/>
  <text x="640" y="676" text-anchor="middle" font-family="Arial, sans-serif" font-size="36" fill="#365465">Clinical image fixture</text>
</svg>
`);

function posixPath(value) {
  return value.split(path.sep).join('/');
}

async function writeFixture() {
  await mkdir(path.join(fixtureDir, 'src'), { recursive: true });
  const medicalTextImport = `/@fs${posixPath(path.join(frontendRoot, 'src', 'shared', 'components', 'MedicalText.jsx'))}`;
  const sampleImage = `data:image/svg+xml;charset=utf-8,${sampleSvg}`;
  const clinicalTable = [
    '| Finding | Learner-facing value | Reference range |',
    '| --- | --- | --- |',
    '| SpO2 | 91% on air | 94-98% |',
    '| Respiratory rate | 28/min | 12-20/min |',
    '| CURB-65 | Confusion absent, urea pending, RR high, BP normal, age 68 | Escalate if score is 2 or more |',
  ].join('\n');
  const clinicalCopy = [
    `![Chest x-ray showing right lower lobe consolidation](${sampleImage} "Chest radiograph")`,
    clinicalTable,
    'In this case, <abbr title="community-acquired pneumonia">CAP</abbr> is supported by fever and focal signs. Check [abbr:ECG|electrocardiogram] before macrolide therapy when QT risk is present.',
    'Formula checks: \\\\(QTc = QT / \\\\sqrt{RR}\\\\), \\\\[A-a = PAO_2 - PaO_2\\\\], and $Na - (Cl + HCO_3)$.',
    'Use current local antimicrobial guidance and review the source note before publishing.[^1]',
    '[^1]: Medical content quality gate fixture, reviewed workflow sample, version v4.',
  ].join('\n\n');

  await writeFile(path.join(fixtureDir, 'index.html'), `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Medical content rendering matrix</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/App.jsx"></script>
</body>
</html>
`);

  await writeFile(path.join(fixtureDir, 'src', 'App.jsx'), `import React from 'react';
import { createRoot } from 'react-dom/client';
import { MedicalText } from '${medicalTextImport}';

const clinicalCopy = ${JSON.stringify(clinicalCopy)};

function App() {
  return (
    <main className="medical-content-fixture">
      <section className="medical-content-panel">
        <h1>Medical Content Rendering Fixture</h1>
        <MedicalText className="medical-text-rendered" text={clinicalCopy} imageLoading="eager" imageFetchPriority="high" />
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
`);
}

function requestJson(url, { method = 'GET' } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        body += chunk;
      });
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

async function requestJsonWithRetry(url, options = {}, attempts = 30) {
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

function fixtureCss() {
  return `
    body {
      margin: 0;
      background: #f6f8fb;
      color: #10202b;
      font: 16px/1.55 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .medical-content-fixture {
      box-sizing: border-box;
      min-height: 100vh;
      padding: clamp(12px, 3vw, 32px);
    }
    .medical-content-panel {
      box-sizing: border-box;
      width: min(100%, 860px);
      margin: 0 auto;
      padding: clamp(14px, 3vw, 28px);
      border: 1px solid #ccd8e1;
      border-radius: 8px;
      background: #ffffff;
    }
    .medical-content-panel h1 {
      margin: 0 0 16px;
      font-size: clamp(20px, 2.2vw, 28px);
      line-height: 1.2;
    }
    .medical-text-rendered {
      display: grid;
      gap: 12px;
      max-width: 100%;
    }
    .lms-medical-paragraph,
    .lms-medical-reference-list {
      display: block;
    }
    .lms-medical-reference-list {
      display: grid;
      gap: 6px;
      margin-top: 8px;
      padding-top: 10px;
      border-top: 1px solid #dbe4ea;
      font-size: 0.92rem;
    }
    .lms-medical-abbreviation {
      text-decoration-thickness: 1px;
      text-underline-offset: 3px;
    }
    .lms-medical-formula {
      padding: 0 4px;
      border-radius: 4px;
      background: #eef4f8;
    }
  `;
}

function metricScript() {
  return `(() => {
    const tableFrame = document.querySelector('.lms-medical-table-frame');
    const bodyOverflow = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth;
    const overflowingNodes = Array.from(document.querySelectorAll('body *')).filter((el) => {
      if (el.closest('.lms-medical-table-frame')) return false;
      const rect = el.getBoundingClientRect();
      return rect.right > window.innerWidth + 1 || rect.left < -1;
    }).slice(0, 8).map((el) => ({
      tagName: el.tagName,
      className: String(el.className || ''),
      left: Math.round(el.getBoundingClientRect().left),
      right: Math.round(el.getBoundingClientRect().right),
    }));

    return {
      ready: Boolean(document.querySelector('.medical-text-rendered')),
      hasImage: Boolean(document.querySelector('.lms-medical-image-frame img[alt*="Chest x-ray"]')),
      imageRendered: (() => {
        const image = document.querySelector('.lms-medical-image-frame img');
        return Boolean(image && image.getBoundingClientRect().width > 20 && image.getBoundingClientRect().height > 20);
      })(),
      hasTable: document.querySelectorAll('.lms-medical-table th').length === 3 && document.querySelectorAll('.lms-medical-table tbody tr').length === 3,
      tableFrameWidth: Math.round(tableFrame?.getBoundingClientRect().width || 0),
      tableScrollWidth: Math.round(tableFrame?.scrollWidth || 0),
      tableOverflowMode: tableFrame ? getComputedStyle(tableFrame).overflowX : null,
      tableContained: tableFrame ? tableFrame.getBoundingClientRect().right <= window.innerWidth + 1 : false,
      hasAbbreviation: Boolean(document.querySelector('abbr[title="community-acquired pneumonia"]')),
      hasShortAbbreviation: Boolean(document.querySelector('abbr[title="electrocardiogram"]')),
      formulaCount: document.querySelectorAll('[role="math"]').length,
      hasReferenceCue: Boolean(document.querySelector('.lms-medical-reference-cue')),
      hasReferenceList: Boolean(document.querySelector('.lms-medical-reference-list [role="listitem"]')),
      bodyOverflow,
      overflowingNodes,
    };
  })()`;
}

async function waitForFixture(client) {
  for (let index = 0; index < 40; index += 1) {
    const result = await client.send('Runtime.evaluate', {
      expression: 'Boolean(document.querySelector(".medical-text-rendered"))',
      returnByValue: true,
    });
    if (result.result.value) return;
    await wait(150);
  }
  throw new Error('Medical content rendering fixture did not load.');
}

async function evaluate(client, expression) {
  const result = await client.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
  });
  return result.result.value;
}

function assertMatrixRow(row) {
  const failures = [];
  if (!row.ready) failures.push('fixture did not render');
  if (!row.hasImage || !row.imageRendered) failures.push('clinical image did not render');
  if (!row.hasTable) failures.push('medical table did not render');
  if (row.tableOverflowMode !== 'auto') failures.push('medical table is not horizontally scrollable');
  if (!row.tableContained) failures.push('medical table frame escapes the viewport');
  if (!row.hasAbbreviation || !row.hasShortAbbreviation) failures.push('abbreviations did not render');
  if (row.formulaCount < 3) failures.push('formulas did not render');
  if (!row.hasReferenceCue || !row.hasReferenceList) failures.push('references did not render');
  if (row.bodyOverflow > 1) failures.push(`page overflowed horizontally by ${row.bodyOverflow}px`);
  if (row.overflowingNodes.length) failures.push('nodes escaped the viewport');
  return failures;
}

async function main() {
  await writeFixture();

  const [{ createServer }, reactModule] = await Promise.all([
    import(pathToFileURL(path.join(frontendRoot, 'node_modules', 'vite', 'dist', 'node', 'index.js')).href),
    import(pathToFileURL(path.join(frontendRoot, 'node_modules', '@vitejs', 'plugin-react', 'dist', 'index.js')).href),
  ]);

  const server = await createServer({
    root: fixtureDir,
    configFile: false,
    appType: 'spa',
    plugins: [reactModule.default()],
    resolve: {
      alias: [
        { find: /^react\/jsx-dev-runtime$/, replacement: path.join(frontendRoot, 'node_modules', 'react', 'jsx-dev-runtime.js') },
        { find: /^react\/jsx-runtime$/, replacement: path.join(frontendRoot, 'node_modules', 'react', 'jsx-runtime.js') },
        { find: /^react-dom\/client$/, replacement: path.join(frontendRoot, 'node_modules', 'react-dom', 'client.js') },
        { find: /^react-dom$/, replacement: path.join(frontendRoot, 'node_modules', 'react-dom', 'index.js') },
        { find: /^react$/, replacement: path.join(frontendRoot, 'node_modules', 'react', 'index.js') },
      ],
      dedupe: ['react', 'react-dom'],
    },
    server: {
      host: '127.0.0.1',
      port: vitePort,
      strictPort: false,
      fs: {
        allow: [repoRoot],
      },
    },
  });

  const chrome = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${chromePort}`,
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'ignore'] });

  const rows = [];
  let client;

  try {
    await server.listen();
    const baseUrl = server.resolvedUrls.local[0];
    await requestJsonWithRetry(`http://127.0.0.1:${chromePort}/json/version`);
    const target = await requestJson(`http://127.0.0.1:${chromePort}/json/new?about:blank`, { method: 'PUT' });
    client = new CdpClient(target.webSocketDebuggerUrl);
    await client.open();
    await client.send('Page.enable');
    await client.send('Runtime.enable');

    for (const viewport of viewports) {
      await client.send('Emulation.setDeviceMetricsOverride', {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: viewport.deviceScaleFactor,
        mobile: viewport.mobile,
      });
      await client.send('Page.navigate', { url: baseUrl });
      await waitForFixture(client);
      await client.send('Runtime.evaluate', {
        expression: `(() => {
          const style = document.createElement('style');
          style.textContent = ${JSON.stringify(fixtureCss())};
          document.head.appendChild(style);
          return true;
        })()`,
        returnByValue: true,
      });
      await wait(250);

      const metrics = await evaluate(client, metricScript());
      const screenshot = await client.send('Page.captureScreenshot', {
        format: 'png',
        fromSurface: true,
        captureBeyondViewport: false,
      });
      const screenshotPath = path.join(outDir, `medical-content-${viewport.name}.png`);
      await writeFile(screenshotPath, Buffer.from(screenshot.data, 'base64'));
      rows.push({ ...viewport, ...metrics, screenshot: screenshotPath, failures: assertMatrixRow(metrics) });
    }

    await writeFile(
      path.join(outDir, 'device-matrix.json'),
      `${JSON.stringify(rows, null, 2)}\n`,
    );

    for (const row of rows) {
      console.log(JSON.stringify({
        ok: row.failures.length === 0,
        name: row.name,
        width: row.width,
        height: row.height,
        screenshot: row.screenshot,
        failures: row.failures,
      }));
    }

    const failed = rows.some((row) => row.failures.length > 0);
    if (failed) process.exitCode = 1;
  } finally {
    if (client) client.close();
    chrome.kill('SIGTERM');
    await server.close();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
