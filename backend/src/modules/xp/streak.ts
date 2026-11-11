/**
 * Streak maths shared by the dashboard (the number students see) and the XP
 * service (streak milestones), so the two can never disagree.
 *
 * Works in whole-day numbers, so the server's timezone cannot shift a day.
 */

/** YYYY-MM-DD for the date as the server's own calendar shows it. */
export function localDateKey(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function toDayNumber(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

/**
 * The daily streak, with a grace day.
 *
 * A day counts when the student did any quiz/practice/lesson activity on it.
 * One missed day is forgiven, but no more than once in any 7 days: a single
 * gap of one day inside the streak (Mon, [Tue missed], Wed) keeps it alive,
 * while two such gaps closer than a week apart break it. Two missed days in a
 * row always break it.
 *
 * graceActive is true when yesterday was missed and is being forgiven right
 * now, which means tonight is the last chance to keep the streak.
 */
export function computeStreak(dayKeys: string[], todayKey: string): { streak: number; graceActive: boolean } {
  const GRACE_SPACING_DAYS = 7;
  const dayNumbers = [...new Set(dayKeys.filter(Boolean).map(toDayNumber).filter((n) => Number.isFinite(n)))].sort(
    (a, b) => b - a
  );

  if (!dayNumbers.length) {
    return { streak: 0, graceActive: false };
  }

  const today = toDayNumber(todayKey);
  const sinceLatest = Math.max(0, today - dayNumbers[0]);

  let lastForgiven: number | null = null; // the missed day most recently forgiven
  const canForgive = (missed: number) =>
    lastForgiven === null || Math.abs(lastForgiven - missed) >= GRACE_SPACING_DAYS;

  let graceActive = false;
  if (sinceLatest > 2) {
    return { streak: 0, graceActive: false };
  }
  if (sinceLatest === 2) {
    // Yesterday was missed. It is forgiven, but only if today is done.
    lastForgiven = today - 1;
    graceActive = true;
  }

  let streak = 1;
  let previous = dayNumbers[0];
  for (let index = 1; index < dayNumbers.length; index += 1) {
    const gap = previous - dayNumbers[index];
    if (gap === 1) {
      streak += 1;
    } else if (gap === 2 && canForgive(previous - 1)) {
      lastForgiven = previous - 1;
      streak += 1;
    } else {
      break;
    }
    previous = dayNumbers[index];
  }

  return { streak, graceActive };
}
