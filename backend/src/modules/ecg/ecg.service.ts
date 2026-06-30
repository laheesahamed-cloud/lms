import { Inject, Injectable } from '@nestjs/common';
import { Pool, RowDataPacket } from 'mysql2/promise';
import { DATABASE_CONNECTION } from '../../database/database.tokens';

export interface EcgTopicInput {
  title: string;
  description?: string | null;
  position?: number | null;
  is_active?: boolean;
}

export interface EcgCardInput {
  topic_id: number;
  title: string;
  image_url?: string | null;
  explanation?: string | null;
  position?: number | null;
  is_active?: boolean;
}

export interface EcgQuizOption {
  text: string;
  correct: boolean;
}

export interface EcgQuizInput {
  question_text?: string;
  image_url?: string | null;
  options?: EcgQuizOption[];
  explanation?: string | null;
  position?: number | null;
  is_active?: boolean;
}

@Injectable()
export class EcgService {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Pool) {}

  // ── Student: list active topics with card counts ──
  async listTopics() {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT t.id, t.title, t.description, t.position,
              (SELECT COUNT(*) FROM ecg_cards c
                WHERE c.topic_id = t.id AND c.is_active = 1) AS card_count
         FROM ecg_topics t
        WHERE t.is_active = 1
        ORDER BY t.position ASC, t.id ASC`,
    );
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      position: r.position,
      cardCount: Number(r.card_count ?? 0),
    }));
  }

  // ── Student: one topic + its active cards ──
  async getTopicWithCards(topicId: number) {
    const [[topicRows], [cardRows]] = await Promise.all([
      this.db.execute<RowDataPacket[]>(
        `SELECT id, title, description, position FROM ecg_topics WHERE id = ? AND is_active = 1`,
        [topicId],
      ),
      this.db.execute<RowDataPacket[]>(
        `SELECT id, topic_id, title, image_url, explanation, position
           FROM ecg_cards
          WHERE topic_id = ? AND is_active = 1
          ORDER BY position ASC, id ASC`,
        [topicId],
      ),
    ]);
    if (!topicRows.length) return null;
    return { topic: topicRows[0], cards: cardRows };
  }

  // ── Student: quiz batch — admin-authored questions ──
  async getQuizBatch(count: number) {
    const safeCount = Math.min(Math.max(1, count), 30);

    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT id, question_text, image_url, options_json, explanation
         FROM ecg_quiz_questions
        WHERE is_active = 1
        ORDER BY RAND()
        LIMIT ?`,
      [safeCount],
    );

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

  private parseOptions(raw: any): EcgQuizOption[] {
    if (!raw) return [];
    let arr = raw;
    if (typeof raw === 'string') {
      try { arr = JSON.parse(raw); } catch { return []; }
    }
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((o) => o && typeof o.text === 'string' && o.text.trim())
      .map((o) => ({ text: String(o.text).trim(), correct: !!o.correct }));
  }

  // ════════════════════════════ ADMIN — QUIZ ════════════════════════════

  async listQuizQuestions() {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT id, question_text, image_url, options_json, explanation, position, is_active,
              created_at, updated_at
         FROM ecg_quiz_questions
        ORDER BY position ASC, id ASC`,
    );
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

  async getQuizQuestion(id: number) {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT * FROM ecg_quiz_questions WHERE id = ?`, [id],
    );
    if (!rows[0]) return null;
    const r = rows[0] as any;
    return { ...r, options: this.parseOptions(r.options_json) };
  }

  async createQuizQuestion(data: EcgQuizInput) {
    let position = data.position;
    if (position == null) {
      const [maxRows] = await this.db.execute<RowDataPacket[]>(
        `SELECT COALESCE(MAX(position), 0) + 1 AS next FROM ecg_quiz_questions`,
      );
      position = Number((maxRows[0] as any)?.next ?? 1);
    }
    const options = this.parseOptions(data.options);
    const [result] = await this.db.execute<any>(
      `INSERT INTO ecg_quiz_questions (question_text, image_url, options_json, explanation, position, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        (data.question_text || 'What does this ECG show?').trim(),
        data.image_url ?? null,
        JSON.stringify(options),
        data.explanation ?? null,
        position,
        data.is_active === false ? 0 : 1,
      ],
    );
    return { id: result.insertId };
  }

  async updateQuizQuestion(id: number, data: EcgQuizInput) {
    const options = this.parseOptions(data.options);
    await this.db.execute(
      `UPDATE ecg_quiz_questions
          SET question_text = ?, image_url = ?, options_json = ?, explanation = ?, position = ?
        WHERE id = ?`,
      [
        (data.question_text || 'What does this ECG show?').trim(),
        data.image_url ?? null,
        JSON.stringify(options),
        data.explanation ?? null,
        data.position ?? 0,
        id,
      ],
    );
  }

  async toggleQuizQuestion(id: number) {
    await this.db.execute(`UPDATE ecg_quiz_questions SET is_active = 1 - is_active WHERE id = ?`, [id]);
  }

  async deleteQuizQuestion(id: number) {
    await this.db.execute(`DELETE FROM ecg_quiz_questions WHERE id = ?`, [id]);
  }

  // ════════════════════════════ ADMIN — TOPICS ════════════════════════════

  async listTopicsAdmin() {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT t.id, t.title, t.description, t.position, t.is_active,
              t.created_at, t.updated_at,
              (SELECT COUNT(*) FROM ecg_cards c WHERE c.topic_id = t.id) AS card_count
         FROM ecg_topics t
        ORDER BY t.position ASC, t.id ASC`,
    );
    return rows;
  }

  async getTopic(id: number) {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT * FROM ecg_topics WHERE id = ?`, [id],
    );
    return rows[0] ?? null;
  }

  async createTopic(data: EcgTopicInput) {
    // default position = max + 1
    let position = data.position;
    if (position == null) {
      const [maxRows] = await this.db.execute<RowDataPacket[]>(
        `SELECT COALESCE(MAX(position), 0) + 1 AS next FROM ecg_topics`,
      );
      position = Number((maxRows[0] as any)?.next ?? 1);
    }
    const [result] = await this.db.execute<any>(
      `INSERT INTO ecg_topics (title, description, position, is_active)
       VALUES (?, ?, ?, ?)`,
      [data.title, data.description ?? null, position, data.is_active === false ? 0 : 1],
    );
    return { id: result.insertId };
  }

  async updateTopic(id: number, data: EcgTopicInput) {
    await this.db.execute(
      `UPDATE ecg_topics SET title = ?, description = ?, position = ? WHERE id = ?`,
      [data.title, data.description ?? null, data.position ?? 0, id],
    );
  }

  async toggleTopic(id: number) {
    await this.db.execute(`UPDATE ecg_topics SET is_active = 1 - is_active WHERE id = ?`, [id]);
  }

  async reorderTopics(orderedIds: number[]) {
    let pos = 1;
    for (const id of orderedIds) {
      await this.db.execute(`UPDATE ecg_topics SET position = ? WHERE id = ?`, [pos++, id]);
    }
  }

  async deleteTopic(id: number) {
    // cascade delete the topic's cards first
    await this.db.execute(`DELETE FROM ecg_cards WHERE topic_id = ?`, [id]);
    await this.db.execute(`DELETE FROM ecg_topics WHERE id = ?`, [id]);
  }

  // ════════════════════════════ ADMIN — CARDS ════════════════════════════

  async listCards(topicId: number) {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT id, topic_id, title, image_url, explanation, position, is_active, created_at, updated_at
         FROM ecg_cards
        WHERE topic_id = ?
        ORDER BY position ASC, id ASC`,
      [topicId],
    );
    return rows;
  }

  async getCard(id: number) {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT * FROM ecg_cards WHERE id = ?`, [id],
    );
    return rows[0] ?? null;
  }

  async createCard(data: EcgCardInput) {
    let position = data.position;
    if (position == null) {
      const [maxRows] = await this.db.execute<RowDataPacket[]>(
        `SELECT COALESCE(MAX(position), 0) + 1 AS next FROM ecg_cards WHERE topic_id = ?`,
        [data.topic_id],
      );
      position = Number((maxRows[0] as any)?.next ?? 1);
    }
    const [result] = await this.db.execute<any>(
      `INSERT INTO ecg_cards (topic_id, title, image_url, explanation, position, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [data.topic_id, data.title, data.image_url ?? null, data.explanation ?? null,
       position, data.is_active === false ? 0 : 1],
    );
    return { id: result.insertId };
  }

  async updateCard(id: number, data: Partial<EcgCardInput>) {
    await this.db.execute(
      `UPDATE ecg_cards SET title = ?, image_url = ?, explanation = ?, position = ? WHERE id = ?`,
      [data.title ?? '', data.image_url ?? null, data.explanation ?? null, data.position ?? 0, id],
    );
  }

  async toggleCard(id: number) {
    await this.db.execute(`UPDATE ecg_cards SET is_active = 1 - is_active WHERE id = ?`, [id]);
  }

  async reorderCards(orderedIds: number[]) {
    let pos = 1;
    for (const id of orderedIds) {
      await this.db.execute(`UPDATE ecg_cards SET position = ? WHERE id = ?`, [pos++, id]);
    }
  }

  async deleteCard(id: number) {
    await this.db.execute(`DELETE FROM ecg_cards WHERE id = ?`, [id]);
  }
}
