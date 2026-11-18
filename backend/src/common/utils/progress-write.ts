import { requestContext } from '../auth/subscription-scope';
import { XP } from '../../modules/xp/xp.rules';
import { xpAmountFor, xpPayAssignmentsFor } from '../../modules/xp/xp-pay-sql';
import { streakAssignmentsWhen } from '../../modules/xp/streak-sql';

/**
 * One row per student (OPTIMIZE 10.28): every student write is ONE `UPDATE`
 * of the student's `student_study_summary` row (1 row examined, 0 returned).
 *
 * 10.30: the phone counts the day's 4 goals (lesson · exam · practice ·
 * flashcards). When all 4 are done it flips that day's mark and the mark rides
 * along with the next main request as `{ n, day, kind: 'day' }`; the streak
 * moves for THAT day (a mark arriving the next morning still counts for its
 * day). Practices ride along as `{ n, day, passed }` for their XP only.
 * `n` counts up per account; the row keeps the last one applied
 * (`practice_seq`), so a retried request never counts anything twice.
 */
export const TODAY = { LESSON: 1, EXAM: 2, PRACTICE: 4, FLASHCARDS: 8, ALL: 15 } as const;

export const PRACTICE_XP = 1;

/** kind 'day' (10.30): all 4 goals were done that day on the phone. */
export type RideAlongPractice = { n: number; day: string; passed: boolean; kind?: 'day' | 'flash' };

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The practices a request carries (validated; at most 200). */
export function parseRideAlong(body: unknown): RideAlongPractice[] {
  const list = (body && typeof body === 'object' ? (body as any).practices : null);
  if (!Array.isArray(list)) return [];
  const out: RideAlongPractice[] = [];
  for (const p of list.slice(0, 200)) {
    const n = Math.trunc(Number(p?.n));
    const day = String(p?.day || '');
    if (!(n > 0) || n > 2_000_000_000 || !DAY.test(day)) continue;
    if (p?.kind === 'day') out.push({ n, day, passed: false, kind: 'day' });
    // 10.29 flashcards notes (a build from that day): numbered, nothing else.
    else if (p?.kind === 'flash') out.push({ n, day, passed: false, kind: 'flash' });
    else out.push({ n, day, passed: p?.passed === true || p?.passed === 1 });
  }
  return out;
}

/** Keep this request's practices for the write that applies them. */
export function rememberRideAlong(list: RideAlongPractice[]) {
  const ctx = requestContext.getStore() as any;
  if (ctx) {
    ctx.rideAlong = list;
    ctx.rideAlongApplied = false;
  }
}

/** This request's practices not applied yet (each write takes them once). */
export function takeRideAlong(): RideAlongPractice[] {
  const ctx = requestContext.getStore() as any;
  if (!ctx || ctx.rideAlongApplied || !Array.isArray(ctx.rideAlong)) return [];
  ctx.rideAlongApplied = true;
  return ctx.rideAlong as RideAlongPractice[];
}

/**
 * A write that took the practices wrote nothing (e.g. the lesson was already
 * done, a repeated exam submit): give them back, so they are applied on their
 * own after the request.
 */
export function returnRideAlong() {
  const ctx = requestContext.getStore() as any;
  if (ctx && Array.isArray(ctx.rideAlong)) ctx.rideAlongApplied = false;
}

/** The highest practice number this request carried and saved (0 when none). */
export function rideAlongSavedMax(): number {
  const ctx = requestContext.getStore() as any;
  if (!ctx || !ctx.rideAlongApplied || !Array.isArray(ctx.rideAlong)) return 0;
  return (ctx.rideAlong as RideAlongPractice[]).reduce((m, p) => Math.max(m, p.n), 0);
}

/** Whether this request still carries practices nobody applied. */
export function rideAlongPending(): boolean {
  const ctx = requestContext.getStore() as any;
  return Boolean(ctx && !ctx.rideAlongApplied && Array.isArray(ctx.rideAlong) && ctx.rideAlong.length);
}

/**
 * The SET pieces of one progress write, in the order they must appear (each
 * reads the old values it needs):
 *   streak (one step per day mark, oldest day first) → XP amount / pay → …
 *   the caller's own columns … → practice_seq.
 *
 * baseXpSql: the write's own XP base (e.g. a lesson's 6, an exam's rule).
 */
export function progressWrite(
  day: string,
  opts: { baseXpSql?: string; baseXpParams?: unknown[]; practices?: RideAlongPractice[]; captureXp?: boolean } = {},
) {
  const practices = opts.practices || [];
  // Each new day mark (n above practice_seq, a day after the last counted one)
  // moves the streak for its own day. Single-table SETs run left to right, so
  // a second mark reads the first one's result.
  const marks = practices.filter((p) => p.kind === 'day').sort((a, b) => a.day.localeCompare(b.day));
  const steps = marks.map((m) =>
    streakAssignmentsWhen(m.day, '(? > practice_seq AND (last_active_day IS NULL OR last_active_day < ?))', [m.n, m.day]));
  const streak = steps.length
    ? { sql: steps.map((x) => x.sql).join(',\n          '), params: steps.flatMap((x) => x.params) }
    : { sql: 'streak = streak', params: [] as unknown[] };

  // XP: the write's own base + 1 per NEW passed practice (n above practice_seq).
  const parts: string[] = [];
  const params: unknown[] = [];
  if (opts.baseXpSql) {
    parts.push(`(${opts.baseXpSql})`);
    params.push(...(opts.baseXpParams || []));
  }
  for (const p of practices) {
    if (!p.passed || p.kind) continue;
    parts.push('IF(? > practice_seq, ?, 0)');
    params.push(p.n, PRACTICE_XP);
  }
  const baseSql = parts.length ? parts.join(' + ') : '0';
  const amount = xpAmountFor(baseSql, params, day);
  // captureXp: the amount paid comes back through LAST_INSERT_ID; otherwise
  // the caller packs [amount] itself (e.g. with the progress version).
  const pay = xpPayAssignmentsFor(baseSql, params, day, opts.captureXp === true);

  const maxN = practices.reduce((m, p) => Math.max(m, p.n), 0);
  const seq = maxN
    ? { sql: 'practice_seq = GREATEST(practice_seq, ?)', params: [maxN] as unknown[] }
    : { sql: 'practice_seq = practice_seq', params: [] as unknown[] };
  return { streak, amount, pay, seq };
}

/** XP a practice can never exceed in a day (the shared daily cap). */
export const DAILY_CAP = XP.DAILY_CAP;

type Exec = { execute: (sql: string, params?: any[]) => Promise<any> };

/**
 * A progress write on its own (ONE statement): this request's ride-along
 * (practices, day marks) that no other write took. Creates the row when it
 * doesn't exist yet (same statement).
 */
export async function applyProgress(db: Exec, userId: number, day: string) {
  const practices = takeRideAlong();
  if (!practices.length) return;
  const w = progressWrite(day, { practices });
  await db.execute(
    `INSERT INTO student_study_summary (user_id) VALUES (?)
     ON DUPLICATE KEY UPDATE ${w.streak.sql}, ${w.pay.sql}, ${w.seq.sql}`,
    [userId, ...w.streak.params, ...w.pay.params, ...w.seq.params],
  );
}
