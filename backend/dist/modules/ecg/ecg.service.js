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
exports.EcgService = void 0;
const common_1 = require("@nestjs/common");
const database_tokens_1 = require("../../database/database.tokens");
let EcgService = class EcgService {
    constructor(db) {
        this.db = db;
    }
    async listTopics() {
        const [rows] = await this.db.execute(`SELECT t.id, t.title, t.description, t.position,
              (SELECT COUNT(*) FROM ecg_cards c
                WHERE c.topic_id = t.id AND c.is_active = 1) AS card_count
         FROM ecg_topics t
        WHERE t.is_active = 1
        ORDER BY t.position ASC, t.id ASC`);
        return rows.map((r) => ({
            id: r.id,
            title: r.title,
            description: r.description,
            position: r.position,
            cardCount: Number(r.card_count ?? 0),
        }));
    }
    async getTopicWithCards(topicId) {
        const [[topicRows], [cardRows]] = await Promise.all([
            this.db.execute(`SELECT id, title, description, position FROM ecg_topics WHERE id = ? AND is_active = 1`, [topicId]),
            this.db.execute(`SELECT id, topic_id, title, image_url, explanation, position
           FROM ecg_cards
          WHERE topic_id = ? AND is_active = 1
          ORDER BY position ASC, id ASC`, [topicId]),
        ]);
        if (!topicRows.length)
            return null;
        return { topic: topicRows[0], cards: cardRows };
    }
    async getQuizBatch(count) {
        const safeCount = Math.min(Math.max(1, count), 30);
        const [rows] = await this.db.execute(`SELECT id, question_text, image_url, options_json, explanation
         FROM ecg_quiz_questions
        WHERE is_active = 1
        ORDER BY RAND()
        LIMIT ?`, [safeCount]);
        const questions = rows.map((r) => {
            const options = this.parseOptions(r.options_json);
            const correct = options.find((o) => o.correct);
            return {
                id: r.id,
                question_text: r.question_text || 'What does this ECG show?',
                image_url: r.image_url,
                options: options.map((o) => o.text),
                answer: correct?.text ?? '',
                explanation: r.explanation,
            };
        });
        return { questions };
    }
    parseOptions(raw) {
        if (!raw)
            return [];
        let arr = raw;
        if (typeof raw === 'string') {
            try {
                arr = JSON.parse(raw);
            }
            catch {
                return [];
            }
        }
        if (!Array.isArray(arr))
            return [];
        return arr
            .filter((o) => o && typeof o.text === 'string' && o.text.trim())
            .map((o) => ({ text: String(o.text).trim(), correct: !!o.correct }));
    }
    async listQuizQuestions() {
        const [rows] = await this.db.execute(`SELECT id, question_text, image_url, options_json, explanation, position, is_active,
              created_at, updated_at
         FROM ecg_quiz_questions
        ORDER BY position ASC, id ASC`);
        return rows.map((r) => ({
            id: r.id,
            question_text: r.question_text,
            image_url: r.image_url,
            options: this.parseOptions(r.options_json),
            explanation: r.explanation,
            position: r.position,
            is_active: r.is_active,
            created_at: r.created_at,
            updated_at: r.updated_at,
        }));
    }
    async getQuizQuestion(id) {
        const [rows] = await this.db.execute(`SELECT * FROM ecg_quiz_questions WHERE id = ?`, [id]);
        if (!rows[0])
            return null;
        const r = rows[0];
        return { ...r, options: this.parseOptions(r.options_json) };
    }
    async createQuizQuestion(data) {
        let position = data.position;
        if (position == null) {
            const [maxRows] = await this.db.execute(`SELECT COALESCE(MAX(position), 0) + 1 AS next FROM ecg_quiz_questions`);
            position = Number(maxRows[0]?.next ?? 1);
        }
        const options = this.parseOptions(data.options);
        const [result] = await this.db.execute(`INSERT INTO ecg_quiz_questions (question_text, image_url, options_json, explanation, position, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`, [
            (data.question_text || 'What does this ECG show?').trim(),
            data.image_url ?? null,
            JSON.stringify(options),
            data.explanation ?? null,
            position,
            data.is_active === false ? 0 : 1,
        ]);
        return { id: result.insertId };
    }
    async updateQuizQuestion(id, data) {
        const options = this.parseOptions(data.options);
        await this.db.execute(`UPDATE ecg_quiz_questions
          SET question_text = ?, image_url = ?, options_json = ?, explanation = ?, position = ?
        WHERE id = ?`, [
            (data.question_text || 'What does this ECG show?').trim(),
            data.image_url ?? null,
            JSON.stringify(options),
            data.explanation ?? null,
            data.position ?? 0,
            id,
        ]);
    }
    async toggleQuizQuestion(id) {
        await this.db.execute(`UPDATE ecg_quiz_questions SET is_active = 1 - is_active WHERE id = ?`, [id]);
    }
    async deleteQuizQuestion(id) {
        await this.db.execute(`DELETE FROM ecg_quiz_questions WHERE id = ?`, [id]);
    }
    async listTopicsAdmin() {
        const [rows] = await this.db.execute(`SELECT t.id, t.title, t.description, t.position, t.is_active,
              t.created_at, t.updated_at,
              (SELECT COUNT(*) FROM ecg_cards c WHERE c.topic_id = t.id) AS card_count
         FROM ecg_topics t
        ORDER BY t.position ASC, t.id ASC`);
        return rows;
    }
    async getTopic(id) {
        const [rows] = await this.db.execute(`SELECT * FROM ecg_topics WHERE id = ?`, [id]);
        return rows[0] ?? null;
    }
    async createTopic(data) {
        let position = data.position;
        if (position == null) {
            const [maxRows] = await this.db.execute(`SELECT COALESCE(MAX(position), 0) + 1 AS next FROM ecg_topics`);
            position = Number(maxRows[0]?.next ?? 1);
        }
        const [result] = await this.db.execute(`INSERT INTO ecg_topics (title, description, position, is_active)
       VALUES (?, ?, ?, ?)`, [data.title, data.description ?? null, position, data.is_active === false ? 0 : 1]);
        return { id: result.insertId };
    }
    async updateTopic(id, data) {
        await this.db.execute(`UPDATE ecg_topics SET title = ?, description = ?, position = ? WHERE id = ?`, [data.title, data.description ?? null, data.position ?? 0, id]);
    }
    async toggleTopic(id) {
        await this.db.execute(`UPDATE ecg_topics SET is_active = 1 - is_active WHERE id = ?`, [id]);
    }
    async reorderTopics(orderedIds) {
        let pos = 1;
        for (const id of orderedIds) {
            await this.db.execute(`UPDATE ecg_topics SET position = ? WHERE id = ?`, [pos++, id]);
        }
    }
    async deleteTopic(id) {
        await this.db.execute(`DELETE FROM ecg_cards WHERE topic_id = ?`, [id]);
        await this.db.execute(`DELETE FROM ecg_topics WHERE id = ?`, [id]);
    }
    async listCards(topicId) {
        const [rows] = await this.db.execute(`SELECT id, topic_id, title, image_url, explanation, position, is_active, created_at, updated_at
         FROM ecg_cards
        WHERE topic_id = ?
        ORDER BY position ASC, id ASC`, [topicId]);
        return rows;
    }
    async getCard(id) {
        const [rows] = await this.db.execute(`SELECT * FROM ecg_cards WHERE id = ?`, [id]);
        return rows[0] ?? null;
    }
    async createCard(data) {
        let position = data.position;
        if (position == null) {
            const [maxRows] = await this.db.execute(`SELECT COALESCE(MAX(position), 0) + 1 AS next FROM ecg_cards WHERE topic_id = ?`, [data.topic_id]);
            position = Number(maxRows[0]?.next ?? 1);
        }
        const [result] = await this.db.execute(`INSERT INTO ecg_cards (topic_id, title, image_url, explanation, position, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`, [data.topic_id, data.title, data.image_url ?? null, data.explanation ?? null,
            position, data.is_active === false ? 0 : 1]);
        return { id: result.insertId };
    }
    async updateCard(id, data) {
        await this.db.execute(`UPDATE ecg_cards SET title = ?, image_url = ?, explanation = ?, position = ? WHERE id = ?`, [data.title ?? '', data.image_url ?? null, data.explanation ?? null, data.position ?? 0, id]);
    }
    async toggleCard(id) {
        await this.db.execute(`UPDATE ecg_cards SET is_active = 1 - is_active WHERE id = ?`, [id]);
    }
    async reorderCards(orderedIds) {
        let pos = 1;
        for (const id of orderedIds) {
            await this.db.execute(`UPDATE ecg_cards SET position = ? WHERE id = ?`, [pos++, id]);
        }
    }
    async deleteCard(id) {
        await this.db.execute(`DELETE FROM ecg_cards WHERE id = ?`, [id]);
    }
};
exports.EcgService = EcgService;
exports.EcgService = EcgService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_tokens_1.DATABASE_CONNECTION)),
    __metadata("design:paramtypes", [Object])
], EcgService);
//# sourceMappingURL=ecg.service.js.map