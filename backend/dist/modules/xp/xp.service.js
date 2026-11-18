"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var XpService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.XpService = void 0;
const common_1 = require("@nestjs/common");
const study_stats_service_1 = require("../study-stats/study-stats.service");
const database_tokens_1 = require("../../database/database.tokens");
const streak_1 = require("./streak");
const progress_write_1 = require("../../common/utils/progress-write");
const xp_rules_1 = require("./xp.rules");
const lesson_bits_1 = require("../../common/utils/lesson-bits");
const NONE = { awarded: 0, capped: false };
let XpService = XpService_1 = class XpService {
    constructor(db, studyStats) {
        this.db = db;
        this.studyStats = studyStats;
        this.logger = new common_1.Logger(XpService_1.name);
    }
    async onLessonCompleted(userId, lessonId, readSeconds) {
        let reason;
        if (readSeconds !== undefined && Number.isFinite(readSeconds)) {
            if (readSeconds < xp_rules_1.XP.LESSON_MIN_SECONDS)
                reason = 'too_soon';
        }
        else {
            reason = 'unverified';
        }
        const base = reason ? 0 : xp_rules_1.XP.LESSON;
        await this.studyStats?.ensureBuilt(userId);
        const day = (0, streak_1.localDateKey)(new Date());
        const w = (0, progress_write_1.progressWrite)(day, { baseXpSql: '?', baseXpParams: [base], practices: (0, progress_write_1.takeRideAlong)() });
        const bit = (0, lesson_bits_1.setLessonBitSql)('lessons_done');
        const idx = Math.floor(lessonId / 8);
        const mask = 1 << (lessonId % 8);
        const [res] = await this.db.execute(`UPDATE student_study_summary
          SET ${w.streak.sql},
              progress_version = LAST_INSERT_ID((progress_version + 1) * 1000 + ${w.amount.sql}) DIV 1000,
              ${w.pay.sql},
              lessons_done = ${bit.sql},
              ${w.seq.sql}
        WHERE user_id = ?
          AND (LENGTH(COALESCE(lessons_done, '')) <= ? OR (ORD(SUBSTRING(lessons_done, ? + 1, 1)) & ?) = 0)`, [...w.streak.params, ...w.amount.params, ...w.pay.params, ...bit.params(lessonId), ...w.seq.params, userId, idx, idx, mask]);
        if (!res.affectedRows) {
            (0, progress_write_1.returnRideAlong)();
            return { awarded: 0, capped: false, reason: 'nothing_new' };
        }
        const packed = Number(res.insertId || 0);
        const progressVersion = Math.floor(packed / 1000);
        const awarded = packed % 1000;
        return reason
            ? { awarded: 0, capped: false, reason, progressVersion }
            : { awarded, capped: awarded < base, progressVersion };
    }
    async markLessonOpened(_userId, _lessonId) {
    }
    async getSummary(userId, xpToday, knownTotalXp) {
        try {
            let totalXp = knownTotalXp;
            let today = xpToday;
            if (totalXp === undefined || today === undefined) {
                const [rows] = await this.db.execute(`SELECT xp_total, IF(xp_day = ?, xp_today, 0) AS xp_today FROM student_study_summary WHERE user_id = ? LIMIT 1`, [(0, streak_1.localDateKey)(new Date()), userId]);
                totalXp = totalXp ?? Number(rows[0]?.xp_total || 0);
                today = today ?? Number(rows[0]?.xp_today || 0);
            }
            return {
                totalXp,
                xpToday: today,
                xpDailyCap: xp_rules_1.XP.DAILY_CAP,
                level: Math.floor(totalXp / xp_rules_1.XP.LEVEL_SIZE) + 1,
            };
        }
        catch (error) {
            this.logger.error('Could not read XP summary', error);
            return { totalXp: 0, xpToday: 0, xpDailyCap: xp_rules_1.XP.DAILY_CAP, level: 1 };
        }
    }
};
exports.XpService = XpService;
exports.XpService = XpService = XpService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_tokens_1.DATABASE_CONNECTION)),
    __param(1, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [Object, study_stats_service_1.StudyStatsService])
], XpService);
//# sourceMappingURL=xp.service.js.map