// The student's signed 1-hour access token on the website (OPTIMIZE 10.20
// W6 / 10.22): sent as the Bearer on student requests so the server knows the
// student without any database work. Memory only — the httpOnly session
// cookie renews it (POST /app/start) on the next page load. Admins keep the
// cookie session check (9.8 D3), so they never get one.
let token = '';
let startPayload = null;

export function setStudentAccess(value) { token = typeof value === 'string' ? value : ''; }
export function getStudentAccess() { return token; }
export function clearStudentAccess() { token = ''; startPayload = null; progress = null; }

// The last start-up reply, for the Study Hub batch to use without asking again.
export function setStartPayload(value) { startPayload = value || null; }
export function takeStartPayload() { const value = startPayload; startPayload = null; return value; }

// The student's progress from the start-up reply (lesson bitmap, quiz marks):
// the website's lists draw ticks and best % from it, with no request.
let progress = null;
export function setStudentProgress(value) { progress = value || null; }
export function getStudentProgress() { return progress; }
