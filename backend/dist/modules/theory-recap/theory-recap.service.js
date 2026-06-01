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
exports.TheoryRecapService = void 0;
const common_1 = require("@nestjs/common");
const database_tokens_1 = require("../../database/database.tokens");
const ai_service_1 = require("../ai/ai.service");
let TheoryRecapService = class TheoryRecapService {
    constructor(db, aiService) {
        this.db = db;
        this.aiService = aiService;
    }
    async getByQuestionId(questionId) {
        const [rows] = await this.db.execute('SELECT * FROM question_theory_recaps WHERE question_id = ? LIMIT 1', [questionId]);
        const row = rows[0];
        if (!row)
            return null;
        return this.mapRow(row);
    }
    async upsert(questionId, dto, generatedBy = 'manual') {
        const existing = await this.getByQuestionId(questionId);
        if (existing) {
            await this.db.execute(`UPDATE question_theory_recaps SET
          concept_name = ?,
          hierarchy_course = ?,
          hierarchy_subject = ?,
          hierarchy_topic = ?,
          hierarchy_lesson = ?,
          etiology = ?,
          pathophysiology = ?,
          clinical_features = ?,
          investigations = ?,
          treatment = ?,
          key_points = ?,
          mnemonic = ?,
          generated_by = ?,
          reviewed_status = ?,
          updated_at = NOW()
        WHERE question_id = ?`, [
                dto.conceptName || null,
                dto.hierarchyCourse || null,
                dto.hierarchySubject || null,
                dto.hierarchyTopic || null,
                dto.hierarchyLesson || null,
                this.serializeArray(dto.etiology),
                this.serializeArray(dto.pathophysiology),
                this.serializeArray(dto.clinicalFeatures),
                this.serializeArray(dto.investigations),
                this.serializeArray(dto.treatment),
                this.serializeArray(dto.keyPoints),
                dto.mnemonic || null,
                generatedBy,
                dto.reviewedStatus || existing.reviewedStatus,
                questionId,
            ]);
        }
        else {
            await this.db.execute(`INSERT INTO question_theory_recaps
          (question_id, concept_name, hierarchy_course, hierarchy_subject, hierarchy_topic, hierarchy_lesson,
           etiology, pathophysiology, clinical_features, investigations, treatment, key_points,
           mnemonic, generated_by, reviewed_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                questionId,
                dto.conceptName || null,
                dto.hierarchyCourse || null,
                dto.hierarchySubject || null,
                dto.hierarchyTopic || null,
                dto.hierarchyLesson || null,
                this.serializeArray(dto.etiology),
                this.serializeArray(dto.pathophysiology),
                this.serializeArray(dto.clinicalFeatures),
                this.serializeArray(dto.investigations),
                this.serializeArray(dto.treatment),
                this.serializeArray(dto.keyPoints),
                dto.mnemonic || null,
                generatedBy,
                dto.reviewedStatus || 'pending',
            ]);
        }
        return this.getByQuestionId(questionId);
    }
    async generateForQuestion(questionId) {
        const question = await this.loadQuestionContext(questionId);
        if (!question)
            throw new common_1.NotFoundException('Question not found');
        const [optionRows] = await this.db.execute(`SELECT option_label, option_text, is_correct FROM question_options WHERE question_id = ? ORDER BY option_label ASC`, [questionId]);
        const recap = await this.aiService.generateTheoryRecap({
            questionText: question.question_text,
            questionType: question.question_type,
            options: optionRows.map((opt) => ({
                optionLabel: opt.option_label,
                optionText: opt.option_text,
                isCorrect: Number(opt.is_correct),
            })),
            explanation: question.explanation || '',
            course: question.course_title || '',
            subject: question.subject_name || '',
            topic: question.topic_name || '',
            lesson: question.lesson_title || '',
            category: question.category || 'mock',
        });
        return this.upsert(questionId, {
            conceptName: recap.concept_name,
            hierarchyCourse: recap.hierarchy.course,
            hierarchySubject: recap.hierarchy.subject,
            hierarchyTopic: recap.hierarchy.topic,
            hierarchyLesson: recap.hierarchy.lesson,
            etiology: recap.etiology,
            pathophysiology: recap.pathophysiology,
            clinicalFeatures: recap.clinical_features,
            investigations: recap.investigations,
            treatment: recap.treatment,
            keyPoints: recap.key_points,
            mnemonic: recap.mnemonic,
            reviewedStatus: 'pending',
        }, 'ai');
    }
    async delete(questionId) {
        await this.db.execute('DELETE FROM question_theory_recaps WHERE question_id = ?', [questionId]);
        return { success: true };
    }
    async bulkGenerate(questionIds) {
        if (!questionIds.length)
            throw new common_1.BadRequestException('No question IDs provided');
        const results = [];
        for (const questionId of questionIds) {
            try {
                const existing = await this.getByQuestionId(questionId);
                if (existing) {
                    results.push({ questionId, status: 'skipped' });
                    continue;
                }
                await this.generateForQuestion(questionId);
                results.push({ questionId, status: 'generated' });
            }
            catch (error) {
                results.push({ questionId, status: 'error', error: error instanceof Error ? error.message : 'Unknown error' });
            }
        }
        return { results, total: questionIds.length, generated: results.filter((r) => r.status === 'generated').length };
    }
    async loadQuestionContext(questionId) {
        const [rows] = await this.db.execute(`SELECT q.id, q.question_text, q.question_type, q.explanation, q.category,
              c.course_title, s.topic_name AS subject_name, st.subtopic_name AS topic_name, l.lesson_title
       FROM questions q
       LEFT JOIN courses c ON c.id = q.course_id
       LEFT JOIN topics s ON s.id = q.topic_id
       LEFT JOIN subtopics st ON st.id = q.subtopic_id
       LEFT JOIN lessons l ON l.id = q.lesson_id
       WHERE q.id = ? LIMIT 1`, [questionId]);
        return rows[0] || null;
    }
    mapRow(row) {
        return {
            id: row.id,
            questionId: row.question_id,
            conceptName: row.concept_name || '',
            hierarchy: {
                course: row.hierarchy_course || '',
                subject: row.hierarchy_subject || '',
                topic: row.hierarchy_topic || '',
                lesson: row.hierarchy_lesson || '',
            },
            etiology: this.parseArray(row.etiology),
            pathophysiology: this.parseArray(row.pathophysiology),
            clinicalFeatures: this.parseArray(row.clinical_features),
            investigations: this.parseArray(row.investigations),
            treatment: this.parseArray(row.treatment),
            keyPoints: this.parseArray(row.key_points),
            mnemonic: row.mnemonic || '',
            generatedBy: row.generated_by,
            reviewedStatus: row.reviewed_status,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
    serializeArray(value) {
        if (!Array.isArray(value) || value.length === 0)
            return null;
        return JSON.stringify(value.filter(Boolean));
    }
    parseArray(value) {
        if (!value)
            return [];
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
        }
        catch {
            return [];
        }
    }
};
exports.TheoryRecapService = TheoryRecapService;
exports.TheoryRecapService = TheoryRecapService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_tokens_1.DATABASE_CONNECTION)),
    __metadata("design:paramtypes", [Object, ai_service_1.AiService])
], TheoryRecapService);
//# sourceMappingURL=theory-recap.service.js.map