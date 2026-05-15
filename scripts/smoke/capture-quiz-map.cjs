const fs = require('fs');
const http = require('http');

const token = process.env.LMS_SCREENSHOT_TOKEN || '';
const email = process.env.LMS_SCREENSHOT_EMAIL || '';
const password = process.env.LMS_SCREENSHOT_PASSWORD || '';
const out = process.env.LMS_SCREENSHOT_OUT || 'artifacts/quiz-map.png';
const frontendOrigin = process.env.LMS_SCREENSHOT_FRONTEND || 'http://127.0.0.1:5174';
const frontendEntry = process.env.LMS_SCREENSHOT_ENTRY || `${frontendOrigin}/lms/`;

if (!token && (!email || !password)) {
  console.error('Missing LMS_SCREENSHOT_TOKEN or LMS_SCREENSHOT_EMAIL/PASSWORD');
  process.exit(1);
}

async function main() {
  const target = await requestJson({
    hostname: '127.0.0.1',
    port: 9225,
    path: '/json/new?about:blank',
    method: 'PUT',
  });

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();

  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(JSON.stringify(message.error)));
    else resolve(message.result || {});
  });

  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });

  function send(method, params = {}) {
    const callId = ++id;
    ws.send(JSON.stringify({ id: callId, method, params }));
    return new Promise((resolve, reject) => pending.set(callId, { resolve, reject }));
  }

  async function evalExpr(expression) {
    return send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
  }

  async function waitFor(expression, timeout = 15000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const result = await evalExpr(expression).catch(() => null);
      if (result?.result?.value) return true;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    const debug = await evalExpr("({ url: location.href, title: document.title, inputCount: document.querySelectorAll('input').length, inputs: [...document.querySelectorAll('input')].map(i => ({name:i.name, type:i.type, placeholder:i.placeholder})), text: (document.body?.innerText || '').slice(0, 600) })").catch(() => null);
    if (debug?.result?.value) {
      console.error(JSON.stringify(debug.result.value, null, 2));
    }
    throw new Error(`Timed out waiting for ${expression}`);
  }

  await send('Page.enable');
  await send('Network.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1100,
    deviceScaleFactor: 1,
    mobile: false,
  });
  if (token) {
    await send('Network.setCookie', {
      name: 'lms_session',
      value: token,
      url: 'http://127.0.0.1:3000/',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    });
  }

  await send('Page.navigate', { url: frontendEntry });
  await waitFor("document.readyState === 'complete'", 15000);
  if (!token) {
    await waitFor("document.body && /Sign In|Open login|Explore Platform|Open Dashboard/.test(document.body.innerText || '')", 15000);
    await evalExpr(`
      (() => {
        const link = [...document.querySelectorAll('a,button')]
          .find((item) => /Sign In|Open login|Explore Platform|Open Dashboard/.test(item.innerText || ''));
        if (link) link.click();
        return Boolean(link);
      })()
    `);
    await waitFor("document.body && (/Email address|Go to Quizzes|Q-Bank|Study Hub/.test(document.body.innerText || ''))", 25000);
    const loginInputs = await evalExpr('Boolean(document.querySelector("input[name=\\"email\\"]") && document.querySelector("input[name=\\"password\\"]"))');
    if (loginInputs?.result?.value) {
      await evalExpr(`
        (() => {
          const setValue = (input, value) => {
            const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
            setter.call(input, value);
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
          };
          setValue(document.querySelector('input[name="email"]'), ${JSON.stringify(email)});
          setValue(document.querySelector('input[name="password"]'), ${JSON.stringify(password)});
          document.querySelector('button[type=submit]').click();
          return true;
        })()
      `);
      await waitFor("document.body && /Go to Quizzes|Q-Bank|Study Hub/.test(document.body.innerText || '')", 25000);
    }
    await evalExpr(`
      (() => {
        const target = [...document.querySelectorAll('a,button')]
          .find((item) => /Go to Quizzes|Q-Bank/.test(item.innerText || ''));
        if (target) target.click();
        return Boolean(target);
      })()
    `);
  }

  await waitFor(
    "document.body && (document.body.innerText.includes('Choose a Course Map') || document.body.innerText.includes('Q-Bank'))",
    25000,
  );

  await evalExpr(`
    (() => {
      const buttons = [...document.querySelectorAll('button')];
      const button = buttons.find((item) => /Open Medicine map|Medicine/.test(item.getAttribute('aria-label') || item.innerText));
      if (!button) return false;
      button.click();
      return true;
    })()
  `);

  await waitFor(
    "document.body && (document.body.innerText.includes('Map hierarchy') || document.body.innerText.includes('Map overview'))",
    15000,
  );
  await new Promise((resolve) => setTimeout(resolve, 900));

  const screenshot = await send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false,
  });
  fs.writeFileSync(out, Buffer.from(screenshot.data, 'base64'));
  console.log(out);
  ws.close();
}

function requestJson(options) {
  return new Promise((resolve, reject) => {
    const request = http.request(options, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        body += chunk;
      });
      response.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on('error', reject);
    request.end();
  });
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
