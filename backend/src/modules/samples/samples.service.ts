import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { Pool } from 'mysql2/promise';
import { DATABASE_CONNECTION } from '../../database/database.tokens';
import { getContentVersion, onContentVersionChange } from '../../common/utils/content-version';
import { LessonsService } from '../lessons/lessons.service';
import { QuizAttemptsService } from '../quiz-attempts/quiz-attempts.service';
import { CourseStructureService } from '../courses/course-structure.service';

type Body = { json: string; gzip: Buffer };
type Bundle = {
  v: number;
  index: Body;
  lessons: Map<number, Body>;
  quizzes: Map<number, Body>;
  decks: Map<number, Body>;
};

const FILE_FORMAT = 3;

/**
 * Free samples for the light student website (OPTIMIZE 10.21): the free
 * lessons, quizzes and flashcard decks, built once per content version into a
 * file (backend/storage/cache, not in git) and served from memory. Opening any
 * of them costs no database work and needs no sign-in. Premium content is
 * never in here (the website says "+ more in the app"; nothing is counted).
 */
@Injectable()
export class SamplesService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SamplesService.name);
  private current: Bundle | null = null;
  private building: Promise<Bundle> | null = null;
  private readonly file = join(process.env.CACHE_DIR || join(process.cwd(), 'storage', 'cache'), 'public-samples.json');

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Pool,
    private readonly lessons: LessonsService,
    private readonly quizzes: QuizAttemptsService,
    private readonly structure: CourseStructureService,
  ) {}

  onApplicationBootstrap() {
    // A publish raises the content version: rebuild once, in the background.
    // Built on first use (after a restart: read back from the saved file), and
    // dropped when a publish raises the content version — the next request
    // rebuilds it. Nothing runs at boot.
    onContentVersionChange(() => { this.current = null; });
  }

  async get(): Promise<Bundle> {
    const version = await getContentVersion(this.db);
    if (this.current && this.current.v === version) return this.current;
    if (!this.building) {
      this.building = this.load(version).finally(() => { this.building = null; });
    }
    return this.building;
  }

  private body(value: unknown): Body {
    const json = JSON.stringify(value);
    return { json, gzip: gzipSync(Buffer.from(json), { level: 9 }) };
  }

  private async load(version: number): Promise<Bundle> {
    // After a host restart: the file for this version, no database work.
    try {
      const saved = JSON.parse(await readFile(this.file, 'utf8'));
      if (saved?.format === FILE_FORMAT && Number(saved.v) === version) {
        this.current = this.fromData(version, saved.data);
        return this.current;
      }
    } catch { /* no file yet */ }
    const data = await this.build(version);
    this.current = this.fromData(version, data);
    try {
      await mkdir(join(this.file, '..'), { recursive: true });
      const tmp = `${this.file}.tmp`;
      await writeFile(tmp, JSON.stringify({ format: FILE_FORMAT, v: version, data }));
      await rename(tmp, this.file);
    } catch (e: any) {
      this.logger.warn(`Samples file not written: ${e?.message || e}`);
    }
    return this.current;
  }

  private fromData(version: number, data: any): Bundle {
    return {
      v: version,
      index: this.body(data.index),
      lessons: new Map(Object.entries(data.lessons || {}).map(([id, v]) => [Number(id), this.body(v)])),
      quizzes: new Map(Object.entries(data.quizzes || {}).map(([id, v]) => [Number(id), this.body(v)])),
      decks: new Map(Object.entries(data.decks || {}).map(([id, v]) => [Number(id), this.body(v)])),
    };
  }

  private async build(version: number) {
    const snapshot = await this.structure.get();
    const freeLessons = await this.lessons.freeSamples();
    const freeQuizzes = await this.quizzes.freeSamples();
    const deckIds = new Set(freeLessons.decks.map((d) => d.lessonId));
    const courses = snapshot.courses.map((c: any) => {
      const id = Number(c.id);
      const lessons = freeLessons.lessons.filter((l) => Number(l.item.courseId) === id).map((l) => l.item);
      const quizzes = freeQuizzes.quizzes.filter((q) => Number(q.item.courseId) === id).map((q) => q.item);
      const decks = lessons.filter((l: any) => deckIds.has(Number(l.id)));
      return {
        id,
        courseTitle: String(c.course_title || ''),
        examType: String(c.exam_type || ''),
        lessons,
        quizzes,
        decks,
      };
    });
    this.logger.log(`Public samples v${version}: ${freeLessons.lessons.length} lessons, ${freeQuizzes.quizzes.length} quizzes, ${freeLessons.decks.length} decks`);
    // The Study Hub's question of the day (10.22) is picked in the browser from
    // these — one question per free quiz, inside the index the website already
    // holds, so it needs no extra file.
    const dailyQuestions = freeQuizzes.quizzes.flatMap((q: any) => {
      const question = (q.full.questions || []).find((x: any) => x.questionType === 'sba');
      if (!question) return [];
      return [{
        id: Number(question.id),
        questionType: question.questionType,
        questionText: question.questionText,
        courseTitle: String(q.item.courseTitle || ''),
        subjectName: String(q.item.subjectName || ''),
        topicName: String(q.item.topicName || q.item.subjectName || ''),
        options: (question.options || []).map((o: any) => ({
          id: Number(o.id), optionLabel: o.optionLabel, optionText: o.optionText, isCorrect: Number(o.isCorrect) === 1,
        })),
      }];
    });
    return {
      index: { v: version, courses, dailyQuestions },
      lessons: Object.fromEntries(freeLessons.lessons.map((l) => [Number(l.item.id), l.full])),
      quizzes: Object.fromEntries(freeQuizzes.quizzes.map((q) => [Number(q.item.id), q.full])),
      decks: Object.fromEntries(freeLessons.decks.map((d) => [d.lessonId, { lessonId: d.lessonId, flashcards: d.flashcards }])),
    };
  }
}
