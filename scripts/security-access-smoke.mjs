import mysql from '../backend/node_modules/mysql2/promise.js';
import bcrypt from '../backend/node_modules/bcryptjs/index.js';

const API_BASE = process.env.LMS_API_BASE || 'http://localhost:3000/api';
const DB_CONFIG = {
  host: process.env.LMS_DB_HOST || 'localhost',
  user: process.env.LMS_DB_USER || 'root',
  password: process.env.LMS_DB_PASSWORD || '',
  database: process.env.LMS_DB_NAME || 'lms_db',
};
const ADMIN_EMAIL = process.env.LMS_ADMIN_EMAIL || 'admin@gmail.com';
const ADMIN_PASSWORD = process.env.LMS_ADMIN_PASSWORD || '123456';
const STUDENT_PASSWORD = `Smoke-${Date.now()}!`;
const STUDENT_EMAIL = `security-smoke-${Date.now()}@example.test`;

const checks = [];

function record(name, passed, detail = '') {
  checks.push({ name, passed, detail });
  const status = passed ? 'PASS' : 'FAIL';
  console.log(`${status} ${name}${detail ? ` - ${detail}` : ''}`);
}

async function request(path, options = {}) {
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  });
}

async function jsonOrNull(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function getCookie(response) {
  const setCookie = response.headers.get('set-cookie') || '';
  return setCookie.split(';')[0];
}

function hasSensitiveKey(value) {
  if (!value || typeof value !== 'object') return false;
  const stack = [value];
  while (stack.length) {
    const item = stack.pop();
    if (!item || typeof item !== 'object') continue;
    for (const [key, child] of Object.entries(item)) {
      if (['password', 'session_token', 'sessionToken', 'reset_token', 'resetToken'].includes(key)) {
        return true;
      }
      if (child && typeof child === 'object') stack.push(child);
    }
  }
  return false;
}

async function main() {
  const db = await mysql.createConnection(DB_CONFIG);
  let studentId = null;

  try {
    const hash = await bcrypt.hash(STUDENT_PASSWORD, 10);
    const [result] = await db.execute(
      'INSERT INTO users (full_name, email, password, role, status, session_token, session_expires_at) VALUES (?, ?, ?, ?, ?, NULL, NULL)',
      ['Security Smoke Student', STUDENT_EMAIL, hash, 'student', 'active']
    );
    studentId = result.insertId;

    const unauthUsers = await request('/users');
    record('Unauthenticated users list is blocked', [401, 403].includes(unauthUsers.status), `status ${unauthUsers.status}`);

    const studentLogin = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: STUDENT_EMAIL, password: STUDENT_PASSWORD }),
    });
    const studentBody = await jsonOrNull(studentLogin);
    const studentCookie = getCookie(studentLogin);
    record('Student login succeeds with HttpOnly cookie', studentLogin.ok && Boolean(studentCookie), `status ${studentLogin.status}`);
    record('Student login response does not expose session token', !hasSensitiveKey(studentBody), '');

    const studentUsers = await request('/users', {
      headers: { cookie: studentCookie },
    });
    record('Student cannot call admin users API', [401, 403].includes(studentUsers.status), `status ${studentUsers.status}`);

    const studentDashboard = await request('/dashboard/admin', {
      headers: { cookie: studentCookie },
    });
    record('Student cannot call admin dashboard API', [401, 403].includes(studentDashboard.status), `status ${studentDashboard.status}`);

    const studentQuestionCreate = await request('/questions', {
      method: 'POST',
      headers: { cookie: studentCookie },
      body: JSON.stringify({ questionText: 'blocked' }),
    });
    record('Student cannot create admin question', [401, 403].includes(studentQuestionCreate.status), `status ${studentQuestionCreate.status}`);

    const massAssignment = await request('/study-bookmarks/toggle', {
      method: 'POST',
      headers: { cookie: studentCookie },
      body: JSON.stringify({ itemType: 'quiz', itemId: 1, userId: 1, role: 'admin' }),
    });
    record('Unknown ownership fields are rejected', massAssignment.status === 400, `status ${massAssignment.status}`);

    const me = await request('/auth/me', { headers: { cookie: studentCookie } });
    const meBody = await jsonOrNull(me);
    record('Cookie-backed auth/me succeeds', me.ok && meBody?.user?.email === STUDENT_EMAIL, `status ${me.status}`);
    record('auth/me response is serialized safely', !hasSensitiveKey(meBody), '');

    const evilOrigin = await request('/auth/login', {
      method: 'POST',
      headers: { origin: 'https://attacker.example' },
      body: JSON.stringify({ email: STUDENT_EMAIL, password: STUDENT_PASSWORD }),
    });
    record('Cross-origin unsafe request is blocked', evilOrigin.status === 403, `status ${evilOrigin.status}`);

    const adminLogin = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    });
    const adminCookie = getCookie(adminLogin);
    record('Admin login succeeds', adminLogin.ok && Boolean(adminCookie), `status ${adminLogin.status}`);

    if (adminCookie) {
      const adminUsers = await request('/users', { headers: { cookie: adminCookie } });
      record('Admin can call admin users API', adminUsers.ok, `status ${adminUsers.status}`);
    }
  } finally {
    if (studentId) {
      await db.execute('DELETE FROM users WHERE id = ? AND email = ?', [studentId, STUDENT_EMAIL]);
    }
    await db.end();
  }

  const failed = checks.filter((check) => !check.passed);
  if (failed.length) {
    console.error(`\n${failed.length} security smoke check(s) failed.`);
    process.exit(1);
  }

  console.log('\nAll security smoke checks passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
