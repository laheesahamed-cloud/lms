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
const database_tokens_1 = require("../../database/database.tokens");
const streak_1 = require("./streak");
const xp_rules_1 = require("./xp.rules");
const NONE = { awarded: 0, capped: false };
let XpService = XpService_1 = class XpService {
    constructor(db) {
        this.db = db;
        this.logger = new common_1.Logger(XpService_1.name);
    }
    async onExamSubmitted(userId, attemptId) {
        try {
            const [rows] = await this.db.execute(`SELECT qa.quiz_id, qa.total_questions, qa.percentage, qa.pass_status,
                (SELECT TIMESTAMPDIFF(SECOND, es.started_at, NOW())
                   FROM exam_sessions es
                  WHERE es.submitted_attempt_id = qa.id
                  LIMIT 1) AS secs
           FROM quiz_attempts qa
          WHERE qa.id = ? AND qa.user_id = ? AND qa.status = 'submitted'
          LIMIT 1`, [attemptId, userId]);
            const row = rows[0];
            if (!row)
                return NONE;
            const [marker] = await this.db.execute(`INSERT IGNORE INTO xp_events (user_id, event_type, ref_id, xp, day) VALUES (?, 'exam_attempt', ?, 0, ?)`, [userId, attemptId, (0, streak_1.localDateKey)(new Date())]);
            if (marker.affectedRows === 0)
                return { awarded: 0, capped: false, reason: 'nothing_new' };
            if (Number(row.percentage) < xp_rules_1.XP.MIN_PERCENT) {
                return { awarded: 0, capped: false, reason: 'low_score' };
            }
            const questions = Number(row.total_questions || 0);
            if (row.secs !== null && Number(row.secs) < questions * xp_rules_1.XP.EXAM_MIN_SECONDS_PER_QUESTION) {
                return { awarded: 0, capped: false, reason: 'too_fast' };
            }
            const quizId = Number(row.quiz_id);
            const entries = [];
            const [took] = await this.db.execute(`SELECT 1 FROM xp_events WHERE user_id = ? AND event_type = 'exam_take' AND ref_id = ? LIMIT 1`, [userId, quizId]);
            if (!took.length) {
                entries.push({ type: 'exam_take', refId: quizId, xp: xp_rules_1.XP.EXAM_TAKE });
            }
            else {
                const [paid] = await this.db.execute(`SELECT COUNT(*) AS c FROM xp_events
            WHERE user_id = ? AND event_type = 'exam_retake' AND ref_id >= ? AND ref_id < ?`, [userId, quizId * 100, quizId * 100 + 100]);
                const used = Number(paid[0]?.c || 0);
                if (used < xp_rules_1.XP.MAX_PAID_RETAKES) {
                    entries.push({ type: 'exam_retake', refId: quizId * 100 + used, xp: xp_rules_1.XP.EXAM_RETAKE });
                }
            }
            if (String(row.pass_status) === 'pass') {
                entries.push({ type: 'exam_pass', refId: quizId, xp: xp_rules_1.XP.EXAM_PASS });
            }
            if (!entries.length) {
                return { awarded: 0, capped: false, reason: 'nothing_new' };
            }
            entries.push(...(await this.streakEntries(userId)));
            return await this.award(userId, entries);
        }
        catch (error) {
            this.logger.error(`XP for exam attempt ${attemptId} failed`, error);
            return NONE;
        }
    }
    async onLessonCompleted(userId, lessonId) {
        try {
            const [rows] = await this.db.execute(`SELECT TIMESTAMPDIFF(SECOND, last_opened_at, NOW()) AS secs
           FROM lesson_opens WHERE user_id = ? AND lesson_id = ? LIMIT 1`, [userId, lessonId]);
            if (!rows.length)
                return { awarded: 0, capped: false, reason: 'unverified' };
            if (Number(rows[0].secs) < xp_rules_1.XP.LESSON_MIN_SECONDS) {
                return { awarded: 0, capped: false, reason: 'too_soon' };
            }
            const entries = [{ type: 'lesson', refId: lessonId, xp: xp_rules_1.XP.LESSON }];
            entries.push(...(await this.streakEntries(userId)));
            const result = await this.award(userId, entries);
            return result.awarded === 0 && !result.capped ? { ...result, reason: 'nothing_new' } : result;
        }
        catch (error) {
            this.logger.error(`XP for lesson ${lessonId} failed`, error);
            return NONE;
        }
    }
    async markLessonOpened(userId, lessonId) {
        try {
            await this.db.execute(`INSERT INTO lesson_opens (user_id, lesson_id, last_opened_at)
         VALUES (?, ?, NOW())
         ON DUPLICATE KEY UPDATE last_opened_at = NOW()`, [userId, lessonId]);
        }
        catch (error) {
            this.logger.error(`Could not record lesson ${lessonId} opening`, error);
        }
    }
    async getSummary(userId) {
        try {
            const [[totalRows], [todayRows]] = await Promise.all([
                this.db.execute(`SELECT total_xp FROM student_xp WHERE user_id = ? LIMIT 1`, [userId]),
                this.db.execute(`SELECT COALESCE(SUM(xp), 0) AS s FROM xp_events
            WHERE user_id = ? AND day = ? AND event_type <> 'starting_xp'`, [userId, (0, streak_1.localDateKey)(new Date())]),
            ]);
            const totalXp = Number(totalRows[0]?.total_xp || 0);
            return {
                totalXp,
                xpToday: Number(todayRows[0]?.s || 0),
                xpDailyCap: xp_rules_1.XP.DAILY_CAP,
                level: Math.floor(totalXp / xp_rules_1.XP.LEVEL_SIZE) + 1,
            };
        }
        catch (error) {
            this.logger.error('Could not read XP summary', error);
            return { totalXp: 0, xpToday: 0, xpDailyCap: xp_rules_1.XP.DAILY_CAP, level: 1 };
        }
    }
    async streakEntries(userId) {
        const today = (0, streak_1.localDateKey)(new Date());
        const dayRef = Number(today.replace(/-/g, ''));
        const [seen] = await this.db.execute(`SELECT 1 FROM xp_events WHERE user_id = ? AND event_type = 'streak_day' AND ref_id = ? LIMIT 1`, [userId, dayRef]);
        if (seen.length)
            return [];
        const entries = [{ type: 'streak_day', refId: dayRef, xp: xp_rules_1.XP.STREAK_DAY }];
        const [days] = await this.db.execute(`SELECT attempt_day FROM (
         SELECT DISTINCT DATE(COALESCE(submitted_at, created_at)) AS attempt_day
           FROM quiz_attempts WHERE user_id = ? AND status = 'submitted'
         UNION
         SELECT DISTINCT DATE(created_at) AS attempt_day
           FROM study_activity_events
          WHERE user_id = ? AND activity_type IN ('practice_completed', 'ai_note_viewed')
       ) AS days`, [userId, userId]);
        const keys = days.map((row) => row.attempt_day instanceof Date
            ? (0, streak_1.localDateKey)(row.attempt_day)
            : String(row.attempt_day).slice(0, 10));
        keys.push(today);
        const { streak } = (0, streak_1.computeStreak)(keys, today);
        if (streak >= 7)
            entries.push({ type: 'streak_7', refId: 0, xp: xp_rules_1.XP.STREAK_7 });
        if (streak >= 30)
            entries.push({ type: 'streak_30', refId: 0, xp: xp_rules_1.XP.STREAK_30 });
        return entries;
    }
    async award(userId, entries) {
        const day = (0, streak_1.localDateKey)(new Date());
        const [rows] = await this.db.execute(`SELECT COALESCE(SUM(xp), 0) AS s FROM xp_events
        WHERE user_id = ? AND day = ? AND event_type <> 'starting_xp'`, [userId, day]);
        let remaining = Math.max(0, xp_rules_1.XP.DAILY_CAP - Number(rows[0]?.s || 0));
        let awarded = 0;
        let capped = false;
        for (const entry of entries) {
            if (entry.xp <= 0)
                continue;
            if (remaining <= 0) {
                capped = true;
                continue;
            }
            const pay = Math.min(entry.xp, remaining);
            const [result] = await this.db.execute(`INSERT IGNORE INTO xp_events (user_id, event_type, ref_id, xp, day) VALUES (?, ?, ?, ?, ?)`, [userId, entry.type, entry.refId, pay, day]);
            if (result.affectedRows === 1) {
                awarded += pay;
                remaining -= pay;
                if (pay < entry.xp)
                    capped = true;
            }
        }
        if (awarded > 0) {
            await this.db.execute(`INSERT INTO student_xp (user_id, total_xp) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE total_xp = total_xp + VALUES(total_xp)`, [userId, awarded]);
        }
        return { awarded, capped };
    }
};
exports.XpService = XpService;
exports.XpService = XpService = XpService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_tokens_1.DATABASE_CONNECTION)),
    __metadata("design:paramtypes", [Object])
], XpService);
//# sourceMappingURL=xp.service.js.map