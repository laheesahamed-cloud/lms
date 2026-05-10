import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool, RowDataPacket } from 'mysql2/promise';
import { DATABASE_CONNECTION } from '../../database/database.tokens';
import { AiService } from '../ai/ai.service';
import { UpsertTheoryRecapDto } from './dto/upsert-theory-recap.dto';

type RecapRow = RowDataPacket & {
  id: number;
  question_id: number;
  concept_name: string | null;
  hierarchy_course: string | null;
  hierarchy_subject: string | null;
  hierarchy_topic: string | null;
  hierarchy_lesson: string | null;
  etiology: string | null;
  pathophysiology: string | null;
  clinical_features: string | null;
  investigations: string | null;
  treatment: string | null;
  key_points: string | null;
  mnemonic: string | null;
  generated_by: 'ai' | 'manual';
  reviewed_status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
};

type QuestionContextRow = RowDataPacket & {
  id: number;
  question_text: string;
  question_type: 'sba' | 'true_false';
  explanation: string | null;
  category: string | null;
  course_title: string | null;
  subject_name: string | null;
  topic_name: string | null;
  lesson_title: string | null;
};

type OptionRow = RowDataPacket & {
  option_label: string;
  option_text: string;
  is_correct: number;
};

@Injectable()
export class TheoryRecapService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Pool,
    private readonly aiService: AiService
  ) {}

  async getByQuestionId(questionId: number) {
    const [rows] = await this.db.execute<RecapRow[]>(
      'SELECT * FROM question_theory_recaps WHERE question_id = ? LIMIT 1',
      [questionId]
    );
    const row = rows[0];
    if (!row) return null;
    return this.mapRow(row);
  }

  async upsert(questionId: number, dto: UpsertTheoryRecapDto, generatedBy: 'ai' | 'manual' = 'manual') {
    const existing = await this.getByQuestionId(questionId);

    if (existing) {
      await this.db.execute(
        `UPDATE question_theory_recaps SET
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
        WHERE question_id = ?`,
        [
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
        ]
      );
    } else {
      await this.db.execute(
        `INSERT INTO question_theory_recaps
          (question_id, concept_name, hierarchy_course, hierarchy_subject, hierarchy_topic, hierarchy_lesson,
           etiology, pathophysiology, clinical_features, investigations, treatment, key_points,
           mnemonic, generated_by, reviewed_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
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
        ]
      );
    }

    return this.getByQuestionId(questionId);
  }

  async generateForQuestion(questionId: number) {
    const question = await this.loadQuestionContext(questionId);
    if (!question) throw new NotFoundException('Question not found');

    const [optionRows] = await this.db.execute<OptionRow[]>(
      `SELECT option_label, option_text, is_correct FROM question_options WHERE question_id = ? ORDER BY option_label ASC`,
      [questionId]
    );

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

    return this.upsert(
      questionId,
      {
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
      },
      'ai'
    );
  }

  async delete(questionId: number) {
    await this.db.execute('DELETE FROM question_theory_recaps WHERE question_id = ?', [questionId]);
    return { success: true };
  }

  async bulkGenerate(questionIds: number[]) {
    if (!questionIds.length) throw new BadRequestException('No question IDs provided');

    const results: Array<{ questionId: number; status: 'generated' | 'skipped' | 'error'; error?: string }> = [];

    for (const questionId of questionIds) {
      try {
        const existing = await this.getByQuestionId(questionId);
        if (existing) {
          results.push({ questionId, status: 'skipped' });
          continue;
        }
        await this.generateForQuestion(questionId);
        results.push({ questionId, status: 'generated' });
      } catch (error) {
        results.push({ questionId, status: 'error', error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    return { results, total: questionIds.length, generated: results.filter((r) => r.status === 'generated').length };
  }

  private async loadQuestionContext(questionId: number): Promise<QuestionContextRow | null> {
    const [rows] = await this.db.execute<QuestionContextRow[]>(
      `SELECT q.id, q.question_text, q.question_type, q.explanation, q.category,
              c.course_title, s.topic_name AS subject_name, st.subtopic_name AS topic_name, l.lesson_title
       FROM questions q
       LEFT JOIN courses c ON c.id = q.course_id
       LEFT JOIN topics s ON s.id = q.topic_id
       LEFT JOIN subtopics st ON st.id = q.subtopic_id
       LEFT JOIN lessons l ON l.id = q.lesson_id
       WHERE q.id = ? LIMIT 1`,
      [questionId]
    );
    return rows[0] || null;
  }

  private mapRow(row: RecapRow) {
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

  private serializeArray(value: string[] | undefined | null): string | null {
    if (!Array.isArray(value) || value.length === 0) return null;
    return JSON.stringify(value.filter(Boolean));
  }

  private parseArray(value: string | null): string[] {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
    } catch {
      return [];
    }
  }
}
