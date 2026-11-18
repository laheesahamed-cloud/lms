import { computeStreak, toDayNumber } from './streak';

/**
 * The daily streak kept on the student's summary row (OPTIMIZE 10.15), updated
 * in the statement that records the activity — no day rows are read.
 *
 * Same rule as computeStreak: a day counts when the student finished a lesson,
 * sat an exam or practised; one missed day is forgiven, but no more than once
 * in any 7 days; two missed days in a row break it. Columns:
 *  - streak                 the running count, as of last_active_day
 *  - last_active_day        the last day with an activity
 *  - streak_forgiven_day    the last missed day that was forgiven (NULL: none)
 *  - streak_after_forgiven  active days after that forgiven day (when a second
 *                           missed day comes too soon, the streak becomes these
 *                           days + today — exactly what computeStreak counts)
 */
export const GRACE_SPACING_DAYS = 7;

function addDays(key: string, delta: number): string {
  const n = toDayNumber(key) + delta;
  const d = new Date(n * 86400000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/**
 * SET assignments recording an activity on [today] (YYYY-MM-DD). Single-table
 * assignments run left to right: `streak` reads the old forgiven-day values,
 * which are written after it; `last_active_day` is written last.
 */
export function streakAssignments(today: string): { sql: string; params: string[] } {
  const y1 = addDays(today, -1);
  const y2 = addDays(today, -2);
  return {
    sql: `streak = CASE
            WHEN last_active_day <=> ? THEN streak
            WHEN last_active_day <=> ? THEN streak + 1
            WHEN last_active_day <=> ? THEN IF(streak_forgiven_day IS NULL OR DATEDIFF(?, streak_forgiven_day) >= ${GRACE_SPACING_DAYS},
                                             streak + 1, streak_after_forgiven + 1)
            ELSE 1 END,
          streak_after_forgiven = CASE
            WHEN last_active_day <=> ? THEN streak_after_forgiven
            WHEN last_active_day <=> ? THEN streak_after_forgiven + 1
            ELSE 1 END,
          streak_forgiven_day = CASE
            WHEN last_active_day <=> ? OR last_active_day <=> ? THEN streak_forgiven_day
            WHEN last_active_day <=> ? THEN ?
            ELSE NULL END,
          last_active_day = ?`,
    params: [today, y1, y2, y1, today, y1, today, y1, y2, y1, today],
  };
}

/**
 * The same streak step, applied only when [condSql] is true (OPTIMIZE 10.28:
 * a day counts once all four of today's goals are done). Each column keeps
 * its value otherwise; `last_active_day` is written last, so every CASE still
 * reads the old one.
 */
export function streakAssignmentsWhen(today: string, condSql: string, condParams: unknown[]): { sql: string; params: unknown[] } {
  const y1 = addDays(today, -1);
  const y2 = addDays(today, -2);
  return {
    sql: `streak = IF(${condSql}, CASE
            WHEN last_active_day <=> ? THEN streak
            WHEN last_active_day <=> ? THEN streak + 1
            WHEN last_active_day <=> ? THEN IF(streak_forgiven_day IS NULL OR DATEDIFF(?, streak_forgiven_day) >= ${GRACE_SPACING_DAYS},
                                             streak + 1, streak_after_forgiven + 1)
            ELSE 1 END, streak),
          streak_after_forgiven = IF(${condSql}, CASE
            WHEN last_active_day <=> ? THEN streak_after_forgiven
            WHEN last_active_day <=> ? THEN streak_after_forgiven + 1
            ELSE 1 END, streak_after_forgiven),
          streak_forgiven_day = IF(${condSql}, CASE
            WHEN last_active_day <=> ? OR last_active_day <=> ? THEN streak_forgiven_day
            WHEN last_active_day <=> ? THEN ?
            ELSE NULL END, streak_forgiven_day),
          last_active_day = IF(${condSql}, ?, last_active_day)`,
    params: [
      ...condParams, today, y1, y2, y1,
      ...condParams, today, y1,
      ...condParams, today, y1, y2, y1,
      ...condParams, today,
    ],
  };
}

/** The streak a student sees on [today] from the stored columns (no day rows read). */
export function streakShown(
  row: { streak?: unknown; last_active_day?: unknown; streak_forgiven_day?: unknown; streak_after_forgiven?: unknown } | undefined,
  today: string,
): { streak: number; graceActive: boolean } {
  const last = row?.last_active_day ? String(row.last_active_day).slice(0, 10) : '';
  if (!last) return { streak: 0, graceActive: false };
  const since = toDayNumber(today) - toDayNumber(last);
  const streak = Number(row?.streak || 0);
  if (since <= 1) return { streak, graceActive: false };
  if (since > 2) return { streak: 0, graceActive: false };
  // Yesterday was missed: forgiven if today is done. If another missed day was
  // forgiven within 7 days of yesterday, only the days after it still count.
  const forgiven = row?.streak_forgiven_day ? String(row.streak_forgiven_day).slice(0, 10) : '';
  const tooSoon = forgiven && toDayNumber(today) - 1 - toDayNumber(forgiven) < GRACE_SPACING_DAYS;
  return { streak: tooSoon ? Number(row?.streak_after_forgiven || 0) : streak, graceActive: true };
}

/**
 * The stored columns for a list of active days (one-time fill from the old day
 * rows): the state as of the latest active day, walked back with the same rule.
 */
export function streakStateFromDays(dayKeys: string[]): {
  streak: number; lastActive: string | null; forgiven: string | null; afterForgiven: number;
} {
  const days = [...new Set(dayKeys.filter(Boolean).map((k) => String(k).slice(0, 10)))].sort().reverse();
  if (!days.length) return { streak: 0, lastActive: null, forgiven: null, afterForgiven: 0 };
  const lastActive = days[0];
  const { streak } = computeStreak(days, lastActive);
  // The most recent forgiven gap inside that streak, and the active days after it.
  let forgiven: string | null = null;
  let afterForgiven = 1;
  let counted = 1;
  for (let i = 1; i < days.length && counted < streak; i++) {
    const gap = toDayNumber(days[i - 1]) - toDayNumber(days[i]);
    if (gap === 2 && !forgiven) {
      forgiven = addDays(days[i - 1], -1);
      afterForgiven = counted;
    }
    counted++;
  }
  if (!forgiven) afterForgiven = streak;
  return { streak, lastActive, forgiven, afterForgiven };
}
