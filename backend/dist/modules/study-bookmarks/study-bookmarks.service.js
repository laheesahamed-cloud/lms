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
Object.defineProperty(exports, "__esModule", { value: true });
exports.StudyBookmarksService = void 0;
const common_1 = require("@nestjs/common");
const database_tokens_1 = require("../../database/database.tokens");
let StudyBookmarksService = class StudyBookmarksService {
    constructor(db) {
        this.db = db;
    }
    async list(userId) {
        const [rows] = await this.db.execute(`SELECT
         b.id,
         b.user_id,
         b.item_type,
         b.item_id,
         b.created_at,
         COALESCE(NULLIF(q.student_title, ''), q.quiz_title) AS quiz_title,
         q.exam_mode_only,
         n.title AS note_title,
         n.engine_key AS note_engine_key,
         LEFT(qn.question_text, 180) AS question_text,
         (
           SELECT MIN(qq.quiz_id)
           FROM question_quizzes qq
           INNER JOIN quizzes linked_quiz ON linked_quiz.id = qq.quiz_id AND linked_quiz.status = 'active'
           WHERE qq.question_id = qn.id
         ) AS question_quiz_id,
         COALESCE(qc.course_title, nc.course_title, qnc.course_title) AS course_title,
         COALESCE(qt.topic_name, nt.topic_name, qnt.topic_name) AS topic_name
       FROM study_bookmarks b
       LEFT JOIN quizzes q ON b.item_type = 'quiz' AND q.id = b.item_id
       LEFT JOIN courses qc ON qc.id = q.course_id
       LEFT JOIN topics qt ON qt.id = q.topic_id
       LEFT JOIN ai_illustrated_notes n ON b.item_type = 'ai_note' AND n.id = b.item_id
       LEFT JOIN courses nc ON nc.id = n.course_id
       LEFT JOIN topics nt ON nt.id = n.topic_id
       LEFT JOIN questions qn ON b.item_type = 'question' AND qn.id = b.item_id
       LEFT JOIN courses qnc ON qnc.id = qn.course_id
       LEFT JOIN topics qnt ON qnt.id = qn.topic_id
       WHERE b.user_id = ?
       ORDER BY b.created_at DESC, b.id DESC`, [userId]);
        return rows.map((row) => ({
            id: row.id,
            userId: row.user_id,
            itemType: row.item_type,
            itemId: row.item_id,
            title: row.item_type === 'quiz'
                ? String(row.quiz_title || 'Quiz')
                : row.item_type === 'question'
                    ? String(row.question_text || `Question #${row.item_id}`)
                    : String(row.note_title || 'AI Note'),
            examModeOnly: row.item_type === 'quiz' ? Number(row.exam_mode_only || 0) === 1 : false,
            engineKey: row.item_type === 'ai_note' ? String(row.note_engine_key || 'gemini') : null,
            quizId: row.item_type === 'question' && row.question_quiz_id ? Number(row.question_quiz_id) : null,
            courseTitle: String(row.course_title || ''),
            topicName: String(row.topic_name || ''),
            createdAt: row.created_at || null,
        }));
    }
    async toggle(userId, dto) {
        await this.assertTargetExists(dto.itemType, dto.itemId);
        const [rows] = await this.db.execute('SELECT id FROM study_bookmarks WHERE user_id = ? AND item_type = ? AND item_id = ? LIMIT 1', [userId, dto.itemType, dto.itemId]);
        if (rows.length > 0) {
            await this.db.execute('DELETE FROM study_bookmarks WHERE id = ?', [rows[0].id]);
            return { ok: true, saved: false };
        }
        await this.db.execute('INSERT IGNORE INTO study_bookmarks (user_id, item_type, item_id) VALUES (?, ?, ?)', [userId, dto.itemType, dto.itemId]);
        return { ok: true, saved: true };
    }
    async assertTargetExists(itemType, itemId) {
        if (itemType === 'quiz') {
            const [rows] = await this.db.execute("SELECT id FROM quizzes WHERE id = ? AND status = 'active' LIMIT 1", [itemId]);
            if (rows.length === 0) {
                throw new common_1.BadRequestException('Quiz not found');
            }
            return;
        }
        if (itemType === 'question') {
            const [rows] = await this.db.execute("SELECT id FROM questions WHERE id = ? AND status = 'active' LIMIT 1", [itemId]);
            if (rows.length === 0) {
                throw new common_1.BadRequestException('Question not found');
            }
            return;
        }
        const [rows] = await this.db.execute("SELECT id FROM ai_illustrated_notes WHERE id = ? AND is_public = 1 AND status = 'active' LIMIT 1", [itemId]);
        if (rows.length === 0) {
            throw new common_1.BadRequestException('Lesson not found');
        }
    }
};
exports.StudyBookmarksService = StudyBookmarksService;
exports.StudyBookmarksService = StudyBookmarksService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_tokens_1.DATABASE_CONNECTION)),
    __metadata("design:paramtypes", [Object])
], StudyBookmarksService);
//# sourceMappingURL=study-bookmarks.service.js.map