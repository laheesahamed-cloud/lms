import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { DATABASE_CONNECTION } from '../../database/database.tokens';
import { CreateTopicDto } from './dto/create-topic.dto';
import { UpdateTopicDto } from './dto/update-topic.dto';

type TopicRow = RowDataPacket & {
  id: number;
  course_id: number;
  topic_name: string;
  topic_description: string | null;
  status: 'active' | 'inactive';
  created_at?: string | null;
  course_title?: string;
  subtopic_count?: number;
};

type TopicEntity = {
  id: number;
  courseId: number;
  topicName: string;
  topicDescription: string;
  status: 'active' | 'inactive';
  createdAt: string | null;
  courseTitle?: string;
  subtopicCount?: number;
};

@Injectable()
export class TopicsService {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Pool) {}

  async findAll(courseId?: number) {
    let sql = `
      SELECT
        t.id,
        t.course_id,
        t.topic_name,
        t.topic_description,
        t.status,
        t.created_at,
        c.course_title,
        COUNT(s.id) AS subtopic_count
      FROM topics t
      INNER JOIN courses c ON c.id = t.course_id
      LEFT JOIN subtopics s ON s.topic_id = t.id
    `;
    const params: Array<number> = [];

    if (courseId) {
      sql += ' WHERE t.course_id = ?';
      params.push(courseId);
    }

    sql += `
      GROUP BY t.id, t.course_id, t.topic_name, t.topic_description, t.status, t.created_at, c.course_title
      ORDER BY t.topic_name ASC
    `;

    const [rows] = await this.db.execute<TopicRow[]>(sql, params);
    return rows.map((row) => this.mapTopic(row));
  }

  async findOne(id: number) {
    const [rows] = await this.db.execute<TopicRow[]>(
      `
        SELECT
          t.id,
          t.course_id,
          t.topic_name,
          t.topic_description,
          t.status,
          t.created_at,
          c.course_title,
          COUNT(s.id) AS subtopic_count
        FROM topics t
        INNER JOIN courses c ON c.id = t.course_id
        LEFT JOIN subtopics s ON s.topic_id = t.id
        WHERE t.id = ?
        GROUP BY t.id, t.course_id, t.topic_name, t.topic_description, t.status, t.created_at, c.course_title
        LIMIT 1
      `,
      [id]
    );

    const row = rows[0];
    if (!row) {
      throw new NotFoundException('Topic not found');
    }

    const topic = this.mapTopic(row);
    const [subtopicRows] = await this.db.execute<RowDataPacket[]>(
      'SELECT subtopic_name FROM subtopics WHERE topic_id = ? ORDER BY subtopic_name ASC',
      [id]
    );

    return {
      ...topic,
      subtopics: subtopicRows.map((item) => item.subtopic_name as string),
    };
  }

  async create(createTopicDto: CreateTopicDto) {
    await this.ensureCourseExists(createTopicDto.courseId);

    const connection = await this.db.getConnection();
    try {
      await connection.beginTransaction();

      const [result] = await connection.execute<ResultSetHeader>(
        'INSERT INTO topics (course_id, topic_name, topic_description, status) VALUES (?, ?, ?, ?)',
        [
          createTopicDto.courseId,
          createTopicDto.topicName.trim(),
          (createTopicDto.topicDescription || '').trim(),
          createTopicDto.status,
        ]
      );

      await this.replaceSubtopics(connection, result.insertId, createTopicDto.subtopics || []);

      await connection.commit();
      return {
        ok: true,
        id: result.insertId,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async update(id: number, updateTopicDto: UpdateTopicDto) {
    const existing = await this.findOne(id);
    const courseId = updateTopicDto.courseId ?? existing.courseId;
    await this.ensureCourseExists(courseId);

    const connection = await this.db.getConnection();
    try {
      await connection.beginTransaction();

      await connection.execute(
        'UPDATE topics SET course_id = ?, topic_name = ?, topic_description = ?, status = ? WHERE id = ?',
        [
          courseId,
          updateTopicDto.topicName?.trim() || existing.topicName,
          typeof updateTopicDto.topicDescription === 'string'
            ? updateTopicDto.topicDescription.trim()
            : existing.topicDescription,
          updateTopicDto.status || existing.status,
          id,
        ]
      );

      if (Array.isArray(updateTopicDto.subtopics)) {
        await this.replaceSubtopics(connection, id, updateTopicDto.subtopics);
      }

      await connection.commit();
      return {
        ok: true,
        id,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async remove(id: number) {
    await this.findOne(id);

    const connection = await this.db.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute('DELETE FROM subtopics WHERE topic_id = ?', [id]);
      await connection.execute('DELETE FROM topics WHERE id = ?', [id]);
      await connection.commit();
      return {
        ok: true,
        id,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  private async ensureCourseExists(courseId: number) {
    const [rows] = await this.db.execute<RowDataPacket[]>('SELECT id FROM courses WHERE id = ? LIMIT 1', [courseId]);
    if (rows.length === 0) {
      throw new BadRequestException('Selected course was not found');
    }
  }

  private async replaceSubtopics(connection: Pool | any, topicId: number, subtopics: string[]) {
    const cleaned = Array.from(
      new Map(
        subtopics
          .map((item) => item.trim())
          .filter(Boolean)
          .map((item) => [item.toLowerCase(), item])
      ).values()
    );

    await connection.execute('DELETE FROM subtopics WHERE topic_id = ?', [topicId]);

    for (const subtopic of cleaned) {
      await connection.execute(
        'INSERT INTO subtopics (topic_id, subtopic_name, status) VALUES (?, ?, ?)',
        [topicId, subtopic, 'active']
      );
    }
  }

  private mapTopic(row: TopicRow): TopicEntity {
    return {
      id: row.id,
      courseId: row.course_id,
      topicName: row.topic_name,
      topicDescription: row.topic_description || '',
      status: row.status,
      createdAt: row.created_at || null,
      courseTitle: row.course_title,
      subtopicCount: Number(row.subtopic_count || 0),
    };
  }
}
