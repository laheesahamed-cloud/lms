import { Pool } from 'mysql2/promise';

/**
 * Catalogue version (OPTIMIZE 10.2 #3). Goes up by one whenever an admin or
 * staff member saves content (courses, subjects, topics, lessons, questions,
 * assessments, papers, plans). Phones keep their saved lists while the number
 * is unchanged (up to a day), so a cold open re-downloads nothing that didn't
 * change. Student actions never change it.
 *
 * Kept in memory (0 reads per start-up) and persisted in one system_settings
 * row so it survives restarts.
 */
let current: number | null = null;
let loading: Promise<number> | null = null;

export async function getContentVersion(db: Pool): Promise<number> {
  if (current !== null) return current;
  if (!loading) {
    loading = db.query<any[]>("SELECT setting_value FROM system_settings WHERE setting_key = 'content_version' LIMIT 1")
      .then(([rows]) => { current = Number(rows[0]?.setting_value || 1) || 1; return current; })
      .finally(() => { loading = null; });
  }
  return loading;
}

const listeners: Array<(version: number) => void> = [];

/** Run when the catalogue version goes up (e.g. rebuild a snapshot). */
export function onContentVersionChange(listener: (version: number) => void) {
  listeners.push(listener);
}

function announce(next: number) {
  current = next;
  for (const listener of listeners) {
    try { listener(next); } catch { /* a listener must never break a save */ }
  }
}

/**
 * An admin save: raise the version IN THE DATABASE (+1 on whatever is stored),
 * then read it back. Several backend processes (or a direct SQL fix) can each
 * have raised it; writing "my memory + 1" used to go backwards or collide
 * (2026-11-18: an edit saved through one process never reached phones served
 * by another). Admin saves only — 2 statements.
 */
export async function bumpContentVersion(db: Pool) {
  await db.query(
    `INSERT INTO system_settings (setting_key, setting_value) VALUES ('content_version', '2')
     ON DUPLICATE KEY UPDATE setting_value = CAST(setting_value AS UNSIGNED) + 1`);
  const [rows] = await db.query<any[]>(
    "SELECT setting_value FROM system_settings WHERE setting_key = 'content_version' LIMIT 1");
  const next = Number(rows[0]?.setting_value || 0) || ((current ?? 1) + 1);
  announce(Math.max(next, (current ?? 0) + 1));
}

/**
 * Re-read the stored version every [intervalMs] (default 30 s) and pick up a
 * change made by another backend process or directly in the database, so
 * phones see it on their next open. 1 tiny statement per interval per
 * process — never per student.
 */
let watchTimer: NodeJS.Timeout | null = null;
export function watchContentVersion(db: Pool, intervalMs = 30_000) {
  if (watchTimer) return;
  watchTimer = setInterval(() => {
    db.query<any[]>("SELECT setting_value FROM system_settings WHERE setting_key = 'content_version' LIMIT 1")
      .then(([rows]) => {
        const stored = Number(rows[0]?.setting_value || 0);
        if (current !== null && stored > current) announce(stored);
      })
      .catch(() => { /* database busy: try again next time */ });
  }, intervalMs);
  watchTimer.unref?.();
}

const CATALOGUE_PREFIXES = [
  '/api/questions', '/api/quizzes', '/api/lessons', '/api/topics', '/api/subtopics',
  '/api/papers', '/api/courses', '/api/plans', '/api/admin',
  // 10.27: a theory recap is part of a quiz students see (it raises the
  // quiz stamps, which reach phones through the Q-Bank list).
  '/api/theory-recap',
];

/** An admin/staff save that changes what students' saved lists show. */
export function isCatalogueWrite(method: string, path: string) {
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return false;
  if (/\/student(\/|$)/.test(path)) return false; // a student's own action
  // Announcements, notices and push settings are not catalogue content: they
  // must not make every phone re-download its lists.
  if (/\/(announcements|notifications|push)(\/|$)/.test(path)) return false;
  // 10.58: the admin website saves through /api/admin/<resource> (rewritten
  // later). Accounts, subscriptions, coupons, settings, reports and the hub
  // are not catalogue content: a user or subscription save used to raise the
  // version, rebuild the student lists (~1,850 rows) and make every phone
  // re-download them. Drugs, ECG, OSCE, auscultation, plans and all lesson /
  // question resources still raise it.
  if (/^\/api\/admin\/(users|subscriptions|settings|reports|question-reports|question-review|dashboard|ai)(\/|$)/.test(path)) return false;
  // 10.60: Fix counts only corrects admin-only counters; it raises the version
  // itself, once, when the admin asks for the assessment-stamp bump.
  if (/\/structure\/counts(\/|$)/.test(path)) return false;
  return CATALOGUE_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix + '/'));
}
