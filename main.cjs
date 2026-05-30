const { app, BrowserWindow, Menu, ipcMain, shell, systemPreferences } = require('electron');
const { join } = require('path');

const DEFAULT_APP_URL = 'http://localhost/lms/';
const APP_URL = process.env.LMS_APP_URL || DEFAULT_APP_URL;

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 680,
    title: 'xyndrome',
    backgroundColor: '#f7f9fc',
    autoHideMenuBar: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: process.platform === 'darwin' ? { x: 14, y: 13 } : undefined,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: join(__dirname, 'preload.cjs'),
      backgroundThrottling: true,
      spellcheck: false,
    },
  });

  win.loadURL(APP_URL);

  win.webContents.on('did-finish-load', () => {
    if (process.platform === 'darwin') {
      applyMacDesktopPolish(win);
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    const appOrigin = getOrigin(APP_URL);
    const nextOrigin = getOrigin(url);

    if (nextOrigin && nextOrigin === appOrigin) {
      return { action: 'allow' };
    }

    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    const appOrigin = getOrigin(APP_URL);
    const nextOrigin = getOrigin(url);

    if (!nextOrigin || nextOrigin !== appOrigin) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  win.webContents.on('did-fail-load', (_event, _errorCode, _errorDescription, _validatedUrl, isMainFrame) => {
    if (isMainFrame) {
      win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(renderOfflinePage())}`);
    }
  });
}

function applyMacDesktopPolish(win) {
  const css = `
    document.documentElement.classList.add('lms-desktop-shell', 'lms-desktop-mac');
    if (!document.getElementById('lms-desktop-mac-polish')) {
      const style = document.createElement('style');
      style.id = 'lms-desktop-mac-polish';
      style.textContent = \`
        :root.lms-desktop-mac body {
          -webkit-user-select: auto;
        }

        :root.lms-desktop-mac button,
        :root.lms-desktop-mac a,
        :root.lms-desktop-mac input,
        :root.lms-desktop-mac textarea,
        :root.lms-desktop-mac select,
        :root.lms-desktop-mac [role="button"],
        :root.lms-desktop-mac .lms-floating-panel {
          -webkit-app-region: no-drag;
        }

        :root.lms-desktop-mac .lms-topbar,
        :root.lms-desktop-mac .auth-route-scene::before {
          -webkit-app-region: drag;
        }

        :root.lms-desktop-mac .auth-route-scene {
          position: relative;
        }

        :root.lms-desktop-mac .auth-route-scene::before {
          content: "";
          position: fixed;
          inset: 0 72px auto 96px;
          z-index: 50;
          height: 28px;
          pointer-events: auto;
          background: transparent;
        }

        :root.lms-desktop-mac .lms-sidebar {
          padding-top: 108px !important;
        }

        :root.lms-desktop-mac .lms-sidebar::before {
          top: -108px;
        }

        @media (min-width: 901px) {
          :root.lms-desktop-mac .lms-sidebar.is-collapsed {
            padding-top: 102px !important;
          }
        }
      \`;
      document.head.appendChild(style);
    }

    if (!window.__lmsDesktopMacDoubleClickBound) {
      window.__lmsDesktopMacDoubleClickBound = true;
      document.addEventListener('dblclick', (event) => {
        const target = event.target;
        const interactive = target?.closest?.('button,a,input,textarea,select,[role="button"],.lms-floating-panel');
        if (interactive) return;

        const inTopbar = Boolean(target?.closest?.('.lms-topbar'));
        const inNativeTopZone =
          event.clientY <= 34 &&
          event.clientX >= 96 &&
          event.clientX <= window.innerWidth - 72;

        if (inTopbar || inNativeTopZone) {
          window.lmsDesktop?.titlebarDoubleClick?.();
        }
      }, true);
    }
  `;

  win.webContents.executeJavaScript(css).catch(() => {});
}

ipcMain.on('lms:titlebar-double-click', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;

  const action = String(systemPreferences.getUserDefault('AppleActionOnDoubleClick', 'string') || '').toLowerCase();
  if (action.includes('minimize')) {
    win.minimize();
    return;
  }
  if (action.includes('none')) {
    return;
  }

  if (win.isMaximized()) {
    win.unmaximize();
  } else {
    win.maximize();
  }
});

function getOrigin(url) {
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

function renderOfflinePage() {
  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>xyndrome</title>
        <style>
          body {
            margin: 0;
            min-height: 100vh;
            display: grid;
            place-items: center;
            background: #f7f9fc;
            color: #172033;
            font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          }
          main {
            width: min(440px, calc(100vw - 40px));
            padding: 28px;
            border: 1px solid #d9e1ec;
            border-radius: 10px;
            background: white;
            box-shadow: 0 18px 50px rgba(23,32,51,.08);
          }
          h1 {
            margin: 0 0 8px;
            font-size: 22px;
          }
          p {
            margin: 0 0 18px;
            color: #657089;
          }
          button {
            min-height: 40px;
            border: 0;
            border-radius: 8px;
            padding: 0 16px;
            background: #2563eb;
            color: white;
            font-weight: 700;
            cursor: pointer;
          }
          code {
            color: #172033;
          }
        </style>
      </head>
      <body>
        <main>
          <h1>Cannot open xyndrome</h1>
          <p>The desktop app is online-only and could not reach <code>${APP_URL}</code>.</p>
          <button onclick="location.href='${APP_URL}'">Try again</button>
        </main>
      </body>
    </html>
  `;
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
