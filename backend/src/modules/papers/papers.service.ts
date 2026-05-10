import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { DATABASE_CONNECTION } from '../../database/database.tokens';
import { CreatePaperDto } from './dto/create-paper.dto';
import { UpdatePaperDto } from './dto/update-paper.dto';

type PaperRow = RowDataPacket & {
  id: number;
  paper_title: string;
  year: number;
  exam_source: 'local' | 'erpm';
  keywords_text: string | null;
  status: 'active' | 'inactive';
  created_at?: string | null;
  question_count?: number;
};

@Injectable()
export class PapersService {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Pool) {}

  async findAll(filters: { search?: string; status?: string }) {
    let sql = `
      SELECT
        p.*,
        (
          SELECT COUNT(*)
          FROM questions q
          WHERE q.paper_id = p.id
        ) AS question_count
      FROM papers p
      WHERE 1 = 1
    `;
    const params: Array<string> = [];

    if (filters.search?.trim()) {
      sql += ' AND (p.paper_title LIKE ? OR p.keywords_text LIKE ?)';
      const like = `%${filters.search.trim()}%`;
      params.push(like, like);
    }

    if (filters.status === 'active' || filters.status === 'inactive') {
      sql += ' AND p.status = ?';
      params.push(filters.status);
    }

    sql += ' ORDER BY p.year DESC, p.id DESC';

    const [rows] = await this.db.execute<PaperRow[]>(sql, params);
    return rows.map((row) => this.mapPaper(row));
  }

  async findOne(id: number) {
    const [rows] = await this.db.execute<PaperRow[]>(
      `
        SELECT
          p.*,
          (
            SELECT COUNT(*)
            FROM questions q
            WHERE q.paper_id = p.id
          ) AS question_count
        FROM papers p
        WHERE p.id = ?
        LIMIT 1
      `,
      [id]
    );

    const row = rows[0];
    if (!row) {
      throw new NotFoundException('Paper not found');
    }

    return this.mapPaper(row);
  }

  async create(createPaperDto: CreatePaperDto) {
    const [result] = await this.db.execute<ResultSetHeader>(
      `
        INSERT INTO papers (paper_title, year, exam_source, keywords_text, status)
        VALUES (?, ?, ?, ?, ?)
      `,
      [
        createPaperDto.paperTitle.trim(),
        createPaperDto.year,
        createPaperDto.examSource,
        this.normalizeKeywords(createPaperDto.keywordsText),
        createPaperDto.status,
      ]
    );

    return { ok: true, id: result.insertId };
  }

  async update(id: number, updatePaperDto: UpdatePaperDto) {
    const existing = await this.findOne(id);

    await this.db.execute(
      `
        UPDATE papers
        SET paper_title = ?, year = ?, exam_source = ?, keywords_text = ?, status = ?
        WHERE id = ?
      `,
      [
        updatePaperDto.paperTitle?.trim() || existing.paperTitle,
        updatePaperDto.year ?? existing.year,
        updatePaperDto.examSource ?? existing.examSource,
        typeof updatePaperDto.keywordsText === 'string'
          ? this.normalizeKeywords(updatePaperDto.keywordsText)
          : existing.keywordsText,
        updatePaperDto.status ?? existing.status,
        id,
      ]
    );

    return { ok: true, id };
  }

  async remove(id: number) {
    const paper = await this.findOne(id);
    if (paper.questionCount > 0) {
      throw new BadRequestException('This paper is linked to existing questions and cannot be deleted');
    }

    await this.db.execute('DELETE FROM papers WHERE id = ?', [id]);
    return { ok: true, id };
  }

  async keywordSuggestions(query?: string) {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      'SELECT keywords_text FROM papers WHERE keywords_text IS NOT NULL AND TRIM(keywords_text) <> ""'
    );

    const suggestions = Array.from(
      new Set(
        rows
          .flatMap((row) => String(row.keywords_text || '').split(','))
          .map((item) => item.trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));

    if (!query?.trim()) {
      return suggestions;
    }

    const search = query.trim().toLowerCase();
    return suggestions.filter((item) => item.toLowerCase().includes(search));
  }

  private normalizeKeywords(raw?: string) {
    return Array.from(
      new Set(
        String(raw || '')
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      )
    ).join(', ');
  }

  private mapPaper(row: PaperRow) {
    return {
      id: row.id,
      paperTitle: row.paper_title,
      year: Number(row.year),
      examSource: row.exam_source,
      keywordsText: row.keywords_text || '',
      keywords: String(row.keywords_text || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      status: row.status,
      createdAt: row.created_at || null,
      questionCount: Number(row.question_count || 0),
    };
  }
}
