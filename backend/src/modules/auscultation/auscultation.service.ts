import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { Pool, RowDataPacket } from 'mysql2/promise';
import { mkdir, writeFile, readFile, unlink } from 'fs/promises';
import { join, basename } from 'path';
import { DATABASE_CONNECTION } from '../../database/database.tokens';

export type SoundCategory = 'heart' | 'lung';

export interface AuscTopicInput {
  category?: SoundCategory;
  title: string;
  description?: string | null;
  position?: number | null;
  is_active?: boolean;
}

export interface AuscCardInput {
  topic_id: number;
  title: string;
  audio_data_url?: string | null;   // new upload (base64 data URL) — optional on edit
  explanation?: string | null;
  position?: number | null;
  is_active?: boolean;
}

export interface AuscQuizOption {
  text: string;
  correct: boolean;
}

export interface AuscQuizInput {
  category?: SoundCategory;
  question_text?: string;
  audio_data_url?: string | null;   // upload a fresh clip
  source_card_id?: number | null;   // OR reuse an existing card's clip
  options?: AuscQuizOption[];
  explanation?: string | null;
  position?: number | null;
  is_active?: boolean;
}

interface AudioFile { buffer: Buffer; mime: string; ext: string; }

const AUDIO_DIR = () => join(process.cwd(), 'uploads', 'sound-clips');
const MAX_AUDIO_BYTES = 5 * 1024 * 1024; // 5 MB per clip

const MIME_EXT: Record<string, string> = {
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'aac',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/webm': 'webm',
};

@Injectable()
export class AuscultationService {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Pool) {}

  // ── audio helpers ──────────────────────────────────────────────────────────
  private parseAudioDataUrl(dataUrl: string): AudioFile {
    const match = String(dataUrl).match(/^data:([a-z0-9.\-/+]+);base64,(.+)$/i);
    if (!match) throw new BadRequestException('Audio must be an MP3, M4A, WAV, or OGG file');
    const mime = match[1].toLowerCase();
    const ext = MIME_EXT[mime];
    if (!ext) throw new BadRequestException('Unsupported audio format. Use MP3, M4A, WAV, or OGG.');
    const buffer = Buffer.from(match[2], 'base64');
    if (!buffer.length) throw new BadRequestException('Audio file is empty');
    if (buffer.length > MAX_AUDIO_BYTES) {
      throw new BadRequestException('Audio is too large (max 5 MB). Use a shorter or lower-bitrate clip.');
    }
    return { buffer, mime, ext };
  }

  private async saveAudio(prefix: string, id: number, dataUrl: string): Promise<{ file: string; mime: string }> {
    const audio = this.parseAudioDataUrl(dataUrl);
    const dir = AUDIO_DIR();
    await mkdir(dir, { recursive: true });
    const fileName = `${prefix}-${id}.${audio.ext}`;
    await writeFile(join(dir, fileName), audio.buffer);
    return { file: fileName, mime: audio.mime };
  }

  private async deleteAudio(fileName: string | null) {
    if (!fileName) return;
    await unlink(join(AUDIO_DIR(), basename(fileName))).catch(() => {});
  }

  /** Read a stored audio file for streaming. */
  async getCardAudio(id: number) {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT audio_file, audio_mime FROM auscultation_cards WHERE id = ?`, [id],
    );
    return this.readAudioRow(rows[0]);
  }

  async getQuizAudio(id: number) {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT audio_file, audio_mime, source_card_id FROM auscultation_quiz_questions WHERE id = ?`, [id],
    );
    const row = rows[0] as any;
    // Reuse an existing card's clip when no own file is set
    if (row && !String(row.audio_file || '').trim() && row.source_card_id) {
      return this.getCardAudio(Number(row.source_card_id));
    }
    return this.readAudioRow(row);
  }

  private async readAudioRow(row: any): Promise<{ buffer: Buffer; mime: string } | null> {
    const file = String(row?.audio_file || '').trim();
    if (!file) return null;
    const buffer = await readFile(join(AUDIO_DIR(), basename(file))).catch(() => null);
    if (!buffer?.length) return null;
    return { buffer, mime: String(row?.audio_mime || 'audio/mpeg') };
  }

  private parseOptions(raw: any): AuscQuizOption[] {
    if (!raw) return [];
    let arr = raw;
    if (typeof raw === 'string') { try { arr = JSON.parse(raw); } catch { return []; } }
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((o) => o && typeof o.text === 'string' && o.text.trim())
      .map((o) => ({ text: String(o.text).trim(), correct: !!o.correct }));
  }

  private normCategory(c: any): SoundCategory {
    return c === 'lung' ? 'lung' : 'heart';
  }

  // ════════════════════════════ STUDENT ════════════════════════════

  async listTopics(category: SoundCategory) {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT t.id, t.category, t.title, t.description, t.position,
              (SELECT COUNT(*) FROM auscultation_cards c
                WHERE c.topic_id = t.id AND c.is_active = 1) AS card_count
         FROM auscultation_topics t
        WHERE t.is_active = 1 AND t.category = ?
        ORDER BY t.position ASC, t.id ASC`,
      [category],
    );
    return rows.map((r) => ({
      id: r.id, category: r.category, title: r.title,
      description: r.description, position: r.position,
      cardCount: Number(r.card_count ?? 0),
    }));
  }

  async getTopicWithCards(topicId: number) {
    const [[topicRows], [cardRows]] = await Promise.all([
      this.db.execute<RowDataPacket[]>(
        `SELECT id, category, title, description, position
           FROM auscultation_topics WHERE id = ? AND is_active = 1`, [topicId],
      ),
      this.db.execute<RowDataPacket[]>(
        `SELECT id, topic_id, title, audio_file, explanation, position
           FROM auscultation_cards
          WHERE topic_id = ? AND is_active = 1
          ORDER BY position ASC, id ASC`, [topicId],
      ),
    ]);
    if (!topicRows.length) return null;
    const cards = cardRows.map((c) => ({
      id: c.id, topic_id: c.topic_id, title: c.title,
      explanation: c.explanation, position: c.position,
      hasAudio: !!String(c.audio_file || '').trim(),
    }));
    return { topic: topicRows[0], cards };
  }

  async getQuizBatch(category: SoundCategory, count: number) {
    const safeCount = Math.min(Math.max(1, count), 30);
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT id, question_text, audio_file, source_card_id, options_json, explanation
         FROM auscultation_quiz_questions
        WHERE is_active = 1 AND category = ?
        ORDER BY RAND() LIMIT ?`,
      [category, safeCount],
    );
    const questions = rows.map((r) => {
      const options = this.parseOptions(r.options_json);
      const correct = options.find((o) => o.correct);
      return {
        id: r.id,
        question_text: r.question_text || 'What is this sound?',
        hasAudio: !!String(r.audio_file || '').trim() || !!(r as any).source_card_id,
        options: options.map((o) => o.text),
        answer: correct?.text ?? '',
        explanation: r.explanation,
      };
    });
    return { questions };
  }

  // ════════════════════════════ ADMIN — TOPICS ════════════════════════════

  async listTopicsAdmin(category?: SoundCategory) {
    const where = category ? `WHERE t.category = ?` : ``;
    const params = category ? [category] : [];
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT t.id, t.category, t.title, t.description, t.position, t.is_active,
              t.created_at, t.updated_at,
              (SELECT COUNT(*) FROM auscultation_cards c WHERE c.topic_id = t.id) AS card_count
         FROM auscultation_topics t
         ${where}
        ORDER BY t.position ASC, t.id ASC`,
      params,
    );
    return rows;
  }

  async getTopic(id: number) {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT * FROM auscultation_topics WHERE id = ?`, [id]);
    return rows[0] ?? null;
  }

  async createTopic(data: AuscTopicInput) {
    const category = this.normCategory(data.category);
    let position = data.position;
    if (position == null) {
      const [m] = await this.db.execute<RowDataPacket[]>(
        `SELECT COALESCE(MAX(position),0)+1 AS next FROM auscultation_topics WHERE category = ?`, [category]);
      position = Number((m[0] as any)?.next ?? 1);
    }
    const [res] = await this.db.execute<any>(
      `INSERT INTO auscultation_topics (category, title, description, position, is_active)
       VALUES (?, ?, ?, ?, ?)`,
      [category, data.title, data.description ?? null, position, data.is_active === false ? 0 : 1],
    );
    return { id: res.insertId };
  }

  async updateTopic(id: number, data: AuscTopicInput) {
    await this.db.execute(
      `UPDATE auscultation_topics SET category = ?, title = ?, description = ?, position = ? WHERE id = ?`,
      [this.normCategory(data.category), data.title, data.description ?? null, data.position ?? 0, id],
    );
  }

  async toggleTopic(id: number) {
    await this.db.execute(`UPDATE auscultation_topics SET is_active = 1 - is_active WHERE id = ?`, [id]);
  }

  async deleteTopic(id: number) {
    // delete the topic's cards (and their audio files) first
    const [cards] = await this.db.execute<RowDataPacket[]>(
      `SELECT audio_file FROM auscultation_cards WHERE topic_id = ?`, [id]);
    for (const c of cards) await this.deleteAudio((c as any).audio_file);
    await this.db.execute(`DELETE FROM auscultation_cards WHERE topic_id = ?`, [id]);
    await this.db.execute(`DELETE FROM auscultation_topics WHERE id = ?`, [id]);
  }

  // ════════════════════════════ ADMIN — CARDS ════════════════════════════

  async listCards(topicId: number) {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT id, topic_id, title, audio_file, audio_mime, explanation, position, is_active,
              created_at, updated_at
         FROM auscultation_cards WHERE topic_id = ?
        ORDER BY position ASC, id ASC`, [topicId]);
    return rows.map((r) => ({ ...r, hasAudio: !!String((r as any).audio_file || '').trim() }));
  }

  async createCard(data: AuscCardInput) {
    let position = data.position;
    if (position == null) {
      const [m] = await this.db.execute<RowDataPacket[]>(
        `SELECT COALESCE(MAX(position),0)+1 AS next FROM auscultation_cards WHERE topic_id = ?`, [data.topic_id]);
      position = Number((m[0] as any)?.next ?? 1);
    }
    const [res] = await this.db.execute<any>(
      `INSERT INTO auscultation_cards (topic_id, title, explanation, position, is_active)
       VALUES (?, ?, ?, ?, ?)`,
      [data.topic_id, data.title, data.explanation ?? null, position, data.is_active === false ? 0 : 1],
    );
    const id = res.insertId;
    if (data.audio_data_url) {
      const saved = await this.saveAudio('card', id, data.audio_data_url);
      await this.db.execute(`UPDATE auscultation_cards SET audio_file = ?, audio_mime = ? WHERE id = ?`,
        [saved.file, saved.mime, id]);
    }
    return { id };
  }

  async updateCard(id: number, data: AuscCardInput) {
    await this.db.execute(
      `UPDATE auscultation_cards SET title = ?, explanation = ?, position = ? WHERE id = ?`,
      [data.title ?? '', data.explanation ?? null, data.position ?? 0, id],
    );
    if (data.audio_data_url) {
      const saved = await this.saveAudio('card', id, data.audio_data_url);
      await this.db.execute(`UPDATE auscultation_cards SET audio_file = ?, audio_mime = ? WHERE id = ?`,
        [saved.file, saved.mime, id]);
    }
  }

  async toggleCard(id: number) {
    await this.db.execute(`UPDATE auscultation_cards SET is_active = 1 - is_active WHERE id = ?`, [id]);
  }

  async deleteCard(id: number) {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT audio_file FROM auscultation_cards WHERE id = ?`, [id]);
    await this.deleteAudio((rows[0] as any)?.audio_file);
    await this.db.execute(`DELETE FROM auscultation_cards WHERE id = ?`, [id]);
  }

  // ════════════════════════════ ADMIN — QUIZ ════════════════════════════

  async listQuizQuestions(category?: SoundCategory) {
    const where = category ? `WHERE category = ?` : ``;
    const params = category ? [category] : [];
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT id, category, question_text, audio_file, audio_mime, source_card_id, options_json, explanation,
              position, is_active, created_at, updated_at
         FROM auscultation_quiz_questions ${where}
        ORDER BY position ASC, id ASC`, params);
    return rows.map((r) => ({
      id: r.id, category: r.category, question_text: r.question_text,
      hasAudio: !!String((r as any).audio_file || '').trim() || !!(r as any).source_card_id,
      source_card_id: (r as any).source_card_id ?? null,
      options: this.parseOptions((r as any).options_json),
      explanation: r.explanation, position: r.position, is_active: r.is_active,
      created_at: r.created_at, updated_at: r.updated_at,
    }));
  }

  async createQuizQuestion(data: AuscQuizInput) {
    const category = this.normCategory(data.category);
    let position = data.position;
    if (position == null) {
      const [m] = await this.db.execute<RowDataPacket[]>(
        `SELECT COALESCE(MAX(position),0)+1 AS next FROM auscultation_quiz_questions WHERE category = ?`, [category]);
      position = Number((m[0] as any)?.next ?? 1);
    }
    const options = this.parseOptions(data.options);
    const sourceCardId = data.source_card_id ? Number(data.source_card_id) : null;
    const [res] = await this.db.execute<any>(
      `INSERT INTO auscultation_quiz_questions (category, question_text, source_card_id, options_json, explanation, position, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [category, (data.question_text || 'What is this sound?').trim(), sourceCardId,
       JSON.stringify(options), data.explanation ?? null, position, data.is_active === false ? 0 : 1],
    );
    const id = res.insertId;
    if (data.audio_data_url) {
      // Uploading a fresh clip takes priority and clears any reuse reference
      const saved = await this.saveAudio('quiz', id, data.audio_data_url);
      await this.db.execute(`UPDATE auscultation_quiz_questions SET audio_file = ?, audio_mime = ?, source_card_id = NULL WHERE id = ?`,
        [saved.file, saved.mime, id]);
    }
    return { id };
  }

  async updateQuizQuestion(id: number, data: AuscQuizInput) {
    const options = this.parseOptions(data.options);
    await this.db.execute(
      `UPDATE auscultation_quiz_questions
          SET category = ?, question_text = ?, options_json = ?, explanation = ?, position = ?
        WHERE id = ?`,
      [this.normCategory(data.category), (data.question_text || 'What is this sound?').trim(),
       JSON.stringify(options), data.explanation ?? null, data.position ?? 0, id],
    );
    if (data.audio_data_url) {
      // Fresh upload — store own file, drop any reuse reference
      const saved = await this.saveAudio('quiz', id, data.audio_data_url);
      await this.db.execute(`UPDATE auscultation_quiz_questions SET audio_file = ?, audio_mime = ?, source_card_id = NULL WHERE id = ?`,
        [saved.file, saved.mime, id]);
    } else if (data.source_card_id !== undefined && data.source_card_id !== null) {
      // Reuse an existing card's clip — clear own file, set reference
      const [rows] = await this.db.execute<RowDataPacket[]>(
        `SELECT audio_file FROM auscultation_quiz_questions WHERE id = ?`, [id]);
      await this.deleteAudio((rows[0] as any)?.audio_file);
      await this.db.execute(
        `UPDATE auscultation_quiz_questions SET source_card_id = ?, audio_file = NULL, audio_mime = NULL WHERE id = ?`,
        [Number(data.source_card_id), id]);
    }
  }

  /** All sound cards (optionally by category) — used by the quiz "reuse" picker. */
  async listAllCards(category?: SoundCategory) {
    const where = category ? `WHERE t.category = ?` : ``;
    const params = category ? [category] : [];
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT c.id, c.title, c.audio_file, t.id AS topic_id, t.title AS topic_title, t.category
         FROM auscultation_cards c
         JOIN auscultation_topics t ON t.id = c.topic_id
         ${where}
        ORDER BY t.category, t.position, c.position, c.id`,
      params,
    );
    return rows
      .filter((r) => !!String((r as any).audio_file || '').trim())
      .map((r) => ({
        id: r.id, title: r.title, topicId: r.topic_id,
        topicTitle: r.topic_title, category: r.category,
      }));
  }

  async toggleQuizQuestion(id: number) {
    await this.db.execute(`UPDATE auscultation_quiz_questions SET is_active = 1 - is_active WHERE id = ?`, [id]);
  }

  async deleteQuizQuestion(id: number) {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT audio_file FROM auscultation_quiz_questions WHERE id = ?`, [id]);
    await this.deleteAudio((rows[0] as any)?.audio_file);
    await this.db.execute(`DELETE FROM auscultation_quiz_questions WHERE id = ?`, [id]);
  }
}
