"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.xpAmountSql = xpAmountSql;
exports.xpAmountFor = xpAmountFor;
exports.xpPayAssignments = xpPayAssignments;
exports.xpPayAssignmentsFor = xpPayAssignmentsFor;
const xp_rules_1 = require("./xp.rules");
function xpAmountSql(base, day) {
    return xpAmountFor('?', [base], day);
}
function xpAmountFor(baseSql, baseParams, day) {
    return {
        sql: `IF((${baseSql}) > 0, LEAST(
      (${baseSql}) + IF(streak_xp_day <=> ?, 0, ?) + IF(streak7_paid = 0 AND streak >= 7, ?, 0) + IF(streak30_paid = 0 AND streak >= 30, ?, 0),
      GREATEST(0, ? - IF(xp_day <=> ?, xp_today, 0))), 0)`,
        params: [...baseParams, ...baseParams, day, xp_rules_1.XP.STREAK_DAY, xp_rules_1.XP.STREAK_7, xp_rules_1.XP.STREAK_30, xp_rules_1.XP.DAILY_CAP, day],
    };
}
function xpPayAssignments(base, day, capture = true) {
    return xpPayAssignmentsFor('?', [base], day, capture);
}
function xpPayAssignmentsFor(baseSql, baseParams, day, capture = true) {
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
//# sourceMappingURL=xp-pay-sql.js.map