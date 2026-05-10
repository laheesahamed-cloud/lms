import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { DATABASE_CONNECTION } from '../../database/database.tokens';
import { CreateSubtopicDto } from './dto/create-subtopic.dto';
import { UpdateSubtopicDto } from './dto/update-subtopic.dto';

type SubtopicRow = RowDataPacket & {
  id: number;
  topic_id: number;
  subtopic_name: string;
  status: 'active' | 'inactive';
  created_at?: string | null;
};

@Injectable()
export class SubtopicsService {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Pool) {}

  async findAll(topicId?: number) {
    let sql = `
      SELECT id, topic_id, subtopic_name, status, created_at
      FROM subtopics
    `;
    const params: Array<number> = [];

    if (topicId) {
      sql += ' WHERE topic_id = ?';
      params.push(topicId);
    }

    sql += ' ORDER BY subtopic_name ASC';

    const [rows] = await this.db.execute<SubtopicRow[]>(sql, params);
    return rows.map((row) => this.mapSubtopic(row));
  }

  async create(createSubtopicDto: CreateSubtopicDto) {
    await this.ensureTopicExists(createSubtopicDto.topicId);

    const [result] = await this.db.execute<ResultSetHeader>(
      'INSERT INTO subtopics (topic_id, subtopic_name, status) VALUES (?, ?, ?)',
      [createSubtopicDto.topicId, createSubtopicDto.subtopicName.trim(), createSubtopicDto.status]
    );

    return {
      ok: true,
      id: result.insertId,
    };
  }

  async update(id: number, updateSubtopicDto: UpdateSubtopicDto) {
    const existing = await this.findById(id);
    const topicId = updateSubtopicDto.topicId ?? existing.topicId;
    await this.ensureTopicExists(topicId);

    await this.db.execute(
      'UPDATE subtopics SET topic_id = ?, subtopic_name = ?, status = ? WHERE id = ?',
      [
        topicId,
        updateSubtopicDto.subtopicName?.trim() || existing.subtopicName,
        updateSubtopicDto.status || existing.status,
        id,
      ]
    );

    return {
      ok: true,
      id,
    };
  }

  async remove(id: number) {
    await this.findById(id);
    await this.db.execute('DELETE FROM subtopics WHERE id = ?', [id]);
    return {
      ok: true,
      id,
    };
  }

  private async findById(id: number) {
    const [rows] = await this.db.execute<SubtopicRow[]>(
      'SELECT id, topic_id, subtopic_name, status, created_at FROM subtopics WHERE id = ? LIMIT 1',
      [id]
    );
    const row = rows[0];
    if (!row) {
      throw new NotFoundException('Subtopic not found');
    }
    return this.mapSubtopic(row);
  }

  private async ensureTopicExists(topicId: number) {
    const [rows] = await this.db.execute<RowDataPacket[]>('SELECT id FROM topics WHERE id = ? LIMIT 1', [topicId]);
    if (rows.length === 0) {
      throw new BadRequestException('Selected topic was not found');
    }
  }

  private mapSubtopic(row: SubtopicRow) {
    return {
      id: row.id,
      topicId: row.topic_id,
      subtopicName: row.subtopic_name,
      status: row.status,
      createdAt: row.created_at || null,
    };
  }
}
