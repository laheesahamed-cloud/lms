import { XP } from './xp.rules';

/**
 * The XP amount a payment of [base] adds on the student's summary row: base,
 * plus today's streak-day XP once, plus the 7 / 30-day bonuses once, never past
 * the daily cap — all from the row's own (old) columns. 0 when base is 0.
 */
export function xpAmountSql(base: number, day: string): { sql: string; params: Array<number | string> } {
  return xpAmountFor('?', [base], day);
}

/** Same, with the base written as SQL (e.g. an exam's XP worked out from its old quiz byte). */
export function xpAmountFor(baseSql: string, baseParams: unknown[], day: string): { sql: string; params: any[] } {
  return {
    sql: `IF((${baseSql}) > 0, LEAST(
      (${baseSql}) + IF(streak_xp_day <=> ?, 0, ?) + IF(streak7_paid = 0 AND streak >= 7, ?, 0) + IF(streak30_paid = 0 AND streak >= 30, ?, 0),
      GREATEST(0, ? - IF(xp_day <=> ?, xp_today, 0))), 0)`,
    params: [...baseParams, ...baseParams, day, XP.STREAK_DAY, XP.STREAK_7, XP.STREAK_30, XP.DAILY_CAP, day],
  };
}

/**
 * The XP payment as SET assignments on the student's summary row (OPTIMIZE
 * 10.12 / 10.13 / 10.14 / 10.16), shared by every writer so the rules can't
 * drift. Single-table assignments run left to right, so each one still sees
 * the old values it needs (the flags are written last). The amount paid is
 * handed back through LAST_INSERT_ID; with [capture] false the caller captures
 * it itself (e.g. packed with the progress version). With base 0 nothing is
 * paid and nothing is marked.
 */
export function xpPayAssignments(base: number, day: string, capture = true): { sql: string; params: any[] } {
  return xpPayAssignmentsFor('?', [base], day, capture);
}

export function xpPayAssignmentsFor(baseSql: string, baseParams: unknown[], day: string, capture = true): { sql: string; params: any[] } {
  const amount = xpAmountFor(baseSql, baseParams, day);
  return {
    sql: `xp_total = xp_total + ${capture ? `LAST_INSERT_ID(${amount.sql})` : amount.sql},
          xp_today = IF(xp_day <=> ?, xp_today, 0) + ${amount.sql},
          streak7_paid = IF((${baseSql}) > 0 AND streak >= 7, 1, streak7_paid),
          streak30_paid = IF((${baseSql}) > 0 AND streak >= 30, 1, streak30_paid),
          streak_xp_day = IF((${baseSql}) > 0, ?, streak_xp_day),
          xp_day = IF((${baseSql}) > 0, ?, xp_day)`,
    params: [
      ...amount.params,
      day, ...amount.params,
      ...baseParams,
      ...baseParams,
      ...baseParams, day,
      ...baseParams, day,
    ],
  };
}
