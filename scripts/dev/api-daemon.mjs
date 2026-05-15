import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn, spawnSync } from 'node:child_process';

const rootDir = process.cwd();
const runtimeDir = path.join(rootDir, '.runtime');
const pidFile = path.join(runtimeDir, 'api.pid');
const logFile = path.join(runtimeDir, 'api.log');
const port = 3000;

function ensureRuntimeDir() {
  fs.mkdirSync(runtimeDir, { recursive: true });
}

function isPortOpen(targetPort) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port: targetPort });

    socket.once('connect', () => {
      socket.end();
      resolve(true);
    });

    socket.once('error', () => {
      resolve(false);
    });
  });
}

function readPid() {
  if (!fs.existsSync(pidFile)) {
    return null;
  }

  const value = fs.readFileSync(pidFile, 'utf8').trim();
  const pid = Number(value);
  return Number.isInteger(pid) && pid > 0 ? pid : null;
}

function writePid(pid) {
  ensureRuntimeDir();
  fs.writeFileSync(pidFile, String(pid));
}

function removePid() {
  if (fs.existsSync(pidFile)) {
    fs.unlinkSync(pidFile);
  }
}

function processExists(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === 'EPERM';
  }
}

async function stopPid(pid, signal = 'SIGTERM') {
  if (!pid || !processExists(pid)) {
    return true;
  }

  try {
    process.kill(pid, signal);
  } catch (error) {
    if (error?.code === 'EPERM') {
      return false;
    }
    throw error;
  }

  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (!processExists(pid)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  return false;
}

async function start() {
  if (await isPortOpen(port)) {
    console.log(`API already running on http://localhost:${port}`);
    return;
  }

  const existingPid = readPid();
  if (existingPid && processExists(existingPid)) {
    console.log(`Found stale API process with PID ${existingPid} but port ${port} is closed. Restarting it.`);

    const stopped = await stopPid(existingPid, 'SIGTERM');
    if (!stopped && processExists(existingPid)) {
      console.log(`API process ${existingPid} could not be stopped automatically.`);
      console.log(`Stop it manually, then run: npm run start:api:bg`);
      process.exit(1);
    }

    removePid();
  }

  ensureRuntimeDir();
  const buildResult = spawnSync('npm', ['run', 'build'], {
    cwd: path.join(rootDir, 'backend'),
    stdio: 'inherit',
  });

  if (buildResult.status !== 0) {
    console.error('Backend build failed. API was not started.');
    process.exit(buildResult.status || 1);
  }

  const out = fs.openSync(logFile, 'a');
  const child = spawn('node', ['dist/main.js'], {
    cwd: path.join(rootDir, 'backend'),
    detached: true,
    stdio: ['ignore', out, out],
  });

  child.unref();
  writePid(child.pid);

  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (await isPortOpen(port)) {
      console.log(`API started in background on http://localhost:${port}`);
      console.log(`PID: ${child.pid}`);
      console.log(`Log: ${logFile}`);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  console.error(`API did not become ready. Check log: ${logFile}`);
  process.exit(1);
}

async function stop() {
  const pid = readPid();
  if (!pid) {
    console.log('No saved API PID found.');
    return;
  }

  if (!processExists(pid)) {
    removePid();
    console.log('Saved API process is no longer running.');
    return;
  }

  const stopped = await stopPid(pid, 'SIGTERM');
  if (stopped) {
    removePid();
    console.log(`API stopped (PID ${pid}).`);
    return;
  }

  console.log(`API process ${pid} could not be stopped automatically.`);
  console.log('Stop it manually from your system process list, then run the command again.');
}

async function status() {
  const pid = readPid();
  const open = await isPortOpen(port);

  if (pid && processExists(pid)) {
    if (open) {
      console.log(`API process is running on http://localhost:${port} (PID ${pid})`);
      return;
    }

    console.log(`API process exists with PID ${pid}, but port ${port} is not responding.`);
    return;
  }

  if (open) {
    console.log(`API is running on http://localhost:${port}, but it is not managed by the background script.`);
    return;
  }

  console.log('API is not running.');
}

const command = process.argv[2] || 'status';

if (command === 'start') {
  await start();
} else if (command === 'stop') {
  await stop();
} else if (command === 'status') {
  await status();
} else {
  console.error(`Unknown command: ${command}`);
  process.exit(1);
}
