"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GRACE_SPACING_DAYS = void 0;
exports.streakAssignments = streakAssignments;
exports.streakAssignmentsWhen = streakAssignmentsWhen;
exports.streakShown = streakShown;
exports.streakStateFromDays = streakStateFromDays;
const streak_1 = require("./streak");
exports.GRACE_SPACING_DAYS = 7;
function addDays(key, delta) {
    const n = (0, streak_1.toDayNumber)(key) + delta;
    const d = new Date(n * 86400000);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
function streakAssignments(today) {
    const y1 = addDays(today, -1);
    const y2 = addDays(today, -2);
    return {
        sql: `streak = CASE
            WHEN last_active_day <=> ? THEN streak
            WHEN last_active_day <=> ? THEN streak + 1
            WHEN last_active_day <=> ? THEN IF(streak_forgiven_day IS NULL OR DATEDIFF(?, streak_forgiven_day) >= ${exports.GRACE_SPACING_DAYS},
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
function streakAssignmentsWhen(today, condSql, condParams) {
    const y1 = addDays(today, -1);
    const y2 = addDays(today, -2);
    return {
        sql: `streak = IF(${condSql}, CASE
            WHEN last_active_day <=> ? THEN streak
            WHEN last_active_day <=> ? THEN streak + 1
            WHEN last_active_day <=> ? THEN IF(streak_forgiven_day IS NULL OR DATEDIFF(?, streak_forgiven_day) >= ${exports.GRACE_SPACING_DAYS},
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
function streakShown(row, today) {
    const last = row?.last_active_day ? String(row.last_active_day).slice(0, 10) : '';
    if (!last)
        return { streak: 0, graceActive: false };
    const since = (0, streak_1.toDayNumber)(today) - (0, streak_1.toDayNumber)(last);
    const streak = Number(row?.streak || 0);
    if (since <= 1)
        return { streak, graceActive: false };
    if (since > 2)
        return { streak: 0, graceActive: false };
    const forgiven = row?.streak_forgiven_day ? String(row.streak_forgiven_day).slice(0, 10) : '';
    const tooSoon = forgiven && (0, streak_1.toDayNumber)(today) - 1 - (0, streak_1.toDayNumber)(forgiven) < exports.GRACE_SPACING_DAYS;
    return { streak: tooSoon ? Number(row?.streak_after_forgiven || 0) : streak, graceActive: true };
}
function streakStateFromDays(dayKeys) {
    const days = [...new Set(dayKeys.filter(Boolean).map((k) => String(k).slice(0, 10)))].sort().reverse();
    if (!days.length)
        return { streak: 0, lastActive: null, forgiven: null, afterForgiven: 0 };
    const lastActive = days[0];
    const { streak } = (0, streak_1.computeStreak)(days, lastActive);
    let forgiven = null;
    let afterForgiven = 1;
    let counted = 1;
    for (let i = 1; i < days.length && counted < streak; i++) {
        const gap = (0, streak_1.toDayNumber)(days[i - 1]) - (0, streak_1.toDayNumber)(days[i]);
        if (gap === 2 && !forgiven) {
            forgiven = addDays(days[i - 1], -1);
            afterForgiven = counted;
        }
        counted++;
    }
    if (!forgiven)
        afterForgiven = streak;
    return { streak, lastActive, forgiven, afterForgiven };
}
//# sourceMappingURL=streak-sql.js.map