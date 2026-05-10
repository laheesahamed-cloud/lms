import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { DATABASE_CONNECTION } from '../../database/database.tokens';
import { ToggleStudyBookmarkDto } from './dto/toggle-study-bookmark.dto';

type BookmarkRow = RowDataPacket & {
  id: number;
  user_id: number;
  item_type: 'quiz' | 'ai_note';
  item_id: number;
  created_at: string | null;
  quiz_title?: string | null;
  note_title?: string | null;
  note_engine_key?: string | null;
  course_title?: string | null;
  topic_name?: string | null;
};

@Injectable()
export class StudyBookmarksService {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Pool) {}

  async list(userId: number) {
    const [rows] = await this.db.execute<BookmarkRow[]>(
      `SELECT
         b.id,
         b.user_id,
         b.item_type,
         b.item_id,
         b.created_at,
         COALESCE(NULLIF(q.student_title, ''), q.quiz_title) AS quiz_title,
         n.title AS note_title,
         n.engine_key AS note_engine_key,
         COALESCE(qc.course_title, nc.course_title) AS course_title,
         COALESCE(qt.topic_name, nt.topic_name) AS topic_name
       FROM study_bookmarks b
       LEFT JOIN quizzes q ON b.item_type = 'quiz' AND q.id = b.item_id
       LEFT JOIN courses qc ON qc.id = q.course_id
       LEFT JOIN topics qt ON qt.id = q.topic_id
       LEFT JOIN ai_illustrated_notes n ON b.item_type = 'ai_note' AND n.id = b.item_id
       LEFT JOIN courses nc ON nc.id = n.course_id
       LEFT JOIN topics nt ON nt.id = n.topic_id
       WHERE b.user_id = ?
       ORDER BY b.created_at DESC, b.id DESC`,
      [userId]
    );

    return rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      itemType: row.item_type,
      itemId: row.item_id,
      title: row.item_type === 'quiz' ? String(row.quiz_title || 'Quiz') : String(row.note_title || 'AI Note'),
      engineKey: row.item_type === 'ai_note' ? String(row.note_engine_key || 'gemini') : null,
      courseTitle: String(row.course_title || ''),
      topicName: String(row.topic_name || ''),
      createdAt: row.created_at || null,
    }));
  }

  async toggle(userId: number, dto: ToggleStudyBookmarkDto) {
    await this.assertTargetExists(dto.itemType, dto.itemId);

    const [rows] = await this.db.execute<RowDataPacket[]>(
      'SELECT id FROM study_bookmarks WHERE user_id = ? AND item_type = ? AND item_id = ? LIMIT 1',
      [userId, dto.itemType, dto.itemId]
    );

    if (rows.length > 0) {
      await this.db.execute('DELETE FROM study_bookmarks WHERE id = ?', [rows[0].id]);
      return { ok: true, saved: false };
    }

    await this.db.execute<ResultSetHeader>(
      'INSERT INTO study_bookmarks (user_id, item_type, item_id) VALUES (?, ?, ?)',
      [userId, dto.itemType, dto.itemId]
    );

    return { ok: true, saved: true };
  }

  private async assertTargetExists(itemType: 'quiz' | 'ai_note', itemId: number) {
    if (itemType === 'quiz') {
      const [rows] = await this.db.execute<RowDataPacket[]>(
        "SELECT id FROM quizzes WHERE id = ? AND status = 'active' LIMIT 1",
        [itemId]
      );
      if (rows.length === 0) {
        throw new BadRequestException('Quiz not found');
      }
      return;
    }

    const [rows] = await this.db.execute<RowDataPacket[]>(
      "SELECT id FROM ai_illustrated_notes WHERE id = ? AND is_public = 1 AND status = 'active' LIMIT 1",
      [itemId]
    );
    if (rows.length === 0) {
      throw new BadRequestException('Lesson not found');
    }
  }
}
