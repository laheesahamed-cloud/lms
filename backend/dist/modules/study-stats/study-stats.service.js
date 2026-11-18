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
var StudyStatsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StudyStatsService = exports.MIN_ANSWERED = void 0;
const common_1 = require("@nestjs/common");
const database_tokens_1 = require("../../database/database.tokens");
const subscription_scope_1 = require("../../common/auth/subscription-scope");
const streak_1 = require("../xp/streak");
const xp_rules_1 = require("../xp/xp.rules");
const streak_sql_1 = require("../xp/streak-sql");
const progress_write_1 = require("../../common/utils/progress-write");
exports.MIN_ANSWERED = 10;
let StudyStatsService = StudyStatsService_1 = class StudyStatsService {
    constructor(db) {
        this.db = db;
        this.built = new Set();
        this.building = new Map();
    }
    static todayKey() {
        return (0, streak_1.localDateKey)(new Date());
    }
    async ensureBuilt(userId) {
        if (this.built.has(userId))
            return;
        const running = this.building.get(userId);
        if (running)
            return running;
        const task = (async () => {
            await this.db.execute('INSERT IGNORE INTO student_study_summary (user_id) VALUES (?)', [userId]);
            this.built.add(userId);
        })().finally(() => this.building.delete(userId));
        this.building.set(userId, task);
        return task;
    }
    async recordExam(conn, userId, exam) {
        const day = StudyStatsService_1.todayKey();
        const passed = exam.passed ? 1 : 0;
        const xpBase = exam.eligible ? xp_rules_1.XP.EXAM_TAKE + (passed ? xp_rules_1.XP.EXAM_PASS : 0) : 0;
        const w = (0, progress_write_1.progressWrite)(day, { baseXpSql: '?', baseXpParams: [xpBase], practices: (0, progress_write_1.takeRideAlong)(), captureXp: true });
        const [sum] = await conn.execute(`INSERT INTO student_study_summary (user_id)
       VALUES (?)
       ON DUPLICATE KEY UPDATE
         ${w.streak.sql},
         ${w.pay.sql},
         ${w.seq.sql}`, [userId, ...w.streak.params, ...w.pay.params, ...w.seq.params]);
        const xpAwarded = Number(sum?.affectedRows) === 2 ? Number(sum?.insertId || 0) : 0;
        return { examAttempts: 1, xpBase, xpAwarded };
    }
    async attemptsPruned(_conn, _userId, _quizId, _pruned) {
        return;
    }
    async quizProgress(_userId) {
        return [];
    }
    async summary(userId) {
        await this.ensureBuilt(userId);
        const today = StudyStatsService_1.todayKey();
        const [rows] = await this.db.execute(`SELECT streak,
              DATE_FORMAT(last_active_day, '%Y-%m-%d') AS last_active_day,
              DATE_FORMAT(streak_forgiven_day, '%Y-%m-%d') AS streak_forgiven_day, streak_after_forgiven,
              IF(last_active_day <=> ?, 15, 0) AS today_bits,
              xp_total AS total_xp, IF(xp_day = ?, xp_today, 0) AS d_xp,
              lessons_done, quiz_marks, recent_results, progress_version, flash_history, practice_seq
         FROM student_study_summary
        WHERE user_id = ?
        LIMIT 1`, [today, today, userId]);
        const s = rows[0];
        (0, subscription_scope_1.rememberSummaryRow)(userId, s);
        const bits = Number(s?.today_bits || 0);
        const todayRow = {
            day: today,
            exams: bits & progress_write_1.TODAY.EXAM ? 1 : 0,
            exam_pct_sum: 0,
            practice: bits & progress_write_1.TODAY.PRACTICE ? 1 : 0,
            lessons: bits & progress_write_1.TODAY.LESSON ? 1 : 0,
            flashcards: bits & progress_write_1.TODAY.FLASHCARDS ? 1 : 0,
            results_viewed: 0,
            subject_ids: '',
            xp: Number(s?.d_xp || 0),
            active: bits === progress_write_1.TODAY.ALL ? 1 : 0,
        };
        const { streak, graceActive } = (0, streak_sql_1.streakShown)(s, today);
        const marks = s?.quiz_marks ? Buffer.from(s.quiz_marks) : Buffer.alloc(0);
        let attempts = 0, passedQuizzes = 0, bestSum = 0;
        for (const b of marks) {
            if (!b)
                continue;
            attempts++;
            if (b & 128)
                passedQuizzes++;
            bestSum += (b & 127) - 1;
        }
        let recent = [];
        try {
            recent = JSON.parse(String(s?.recent_results || '[]'))
                .map((e) => ({ pct: Number(e?.pct) || 0, at: String(e?.at || '') }))
                .filter((e) => e.at);
        }
        catch {
            recent = [];
        }
        return {
            attemptsTotal: attempts,
            passedTotal: passedQuizzes,
            averagePercentage: attempts ? bestSum / attempts : 0,
            streak,
            streakGraceActive: graceActive,
            today: todayRow,
            todayBits: bits,
            totalXp: Number(s?.total_xp || 0),
            recentDays: [],
            lastActiveDay: String(s?.last_active_day || ''),
            recentResults: recent,
        };
    }
};
exports.StudyStatsService = StudyStatsService;
exports.StudyStatsService = StudyStatsService = StudyStatsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_tokens_1.DATABASE_CONNECTION)),
    __metadata("design:paramtypes", [Object])
], StudyStatsService);
//# sourceMappingURL=study-stats.service.js.map