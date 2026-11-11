"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.localDateKey = localDateKey;
exports.toDayNumber = toDayNumber;
exports.computeStreak = computeStreak;
function localDateKey(d) {
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
}
function toDayNumber(key) {
    const [y, m, d] = key.split('-').map(Number);
    return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}
function computeStreak(dayKeys, todayKey) {
    const GRACE_SPACING_DAYS = 7;
    const dayNumbers = [...new Set(dayKeys.filter(Boolean).map(toDayNumber).filter((n) => Number.isFinite(n)))].sort((a, b) => b - a);
    if (!dayNumbers.length) {
        return { streak: 0, graceActive: false };
    }
    const today = toDayNumber(todayKey);
    const sinceLatest = Math.max(0, today - dayNumbers[0]);
    let lastForgiven = null;
    const canForgive = (missed) => lastForgiven === null || Math.abs(lastForgiven - missed) >= GRACE_SPACING_DAYS;
    let graceActive = false;
    if (sinceLatest > 2) {
        return { streak: 0, graceActive: false };
    }
    if (sinceLatest === 2) {
        lastForgiven = today - 1;
        graceActive = true;
    }
    let streak = 1;
    let previous = dayNumbers[0];
    for (let index = 1; index < dayNumbers.length; index += 1) {
        const gap = previous - dayNumbers[index];
        if (gap === 1) {
            streak += 1;
        }
        else if (gap === 2 && canForgive(previous - 1)) {
            lastForgiven = previous - 1;
            streak += 1;
        }
        else {
            break;
        }
        previous = dayNumbers[index];
    }
    return { streak, graceActive };
}
//# sourceMappingURL=streak.js.map