import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Pool, RowDataPacket } from 'mysql2/promise';
import { DATABASE_CONNECTION } from '../../database/database.tokens';
import { getContentVersion, onContentVersionChange } from '../../common/utils/content-version';
import { sortByName } from '../../common/utils/general-ci-sort';

/**
 * The course structure every student sees (OPTIMIZE 10, step 3a): active
 * courses, active subjects, active topics and the lessons that are ready to
 * study (active, public, with notes or a PDF). It is the same for every
 * student, so it is built once per catalogue version instead of per request.
 *
 * - A single background worker builds it, reading each table in id order in
 *   slices of at most 1,000 rows with a pause between slices (no bursts).
 * - An admin save raises the catalogue version; the worker rebuilds. Requests
 *   keep the current snapshot meanwhile (about a second). A save that lands
 *   during a rebuild just makes the worker go once more when it finishes.
 * - Kept in memory and in a small JSON file, so a restart reads the file
 *   (0 database rows) when the version still matches.
 */
export type StructureCourse = RowDataPacket & {
  id: number; course_title: string; course_code: string; description: string | null;
  exam_type: string; status: 'active' | 'inactive'; created_at?: string | null;
};
export type StructureSubject = RowDataPacket & { id: number; course_id: number; topic_name: string; status?: string | null };
export type StructureTopic = RowDataPacket & { id: number; topic_id: number; subtopic_name: string; status?: string | null; course_id: number };
export type StructureLesson = RowDataPacket & {
  id: number; course_id: number; topic_id: number; subtopic_id: number | null; lesson_title: string;
  video_url: string | null; is_free: number; status: 'active' | 'inactive';
  has_note?: number; has_pdf?: number; engine_key?: string; updated_ts?: number;
};
export type CourseStructure = {
  format?: number;
  version: number;
  builtAt: string;
  courses: StructureCourse[];   // active, by title
  subjects: StructureSubject[]; // active, by sort order then id
  topics: StructureTopic[];     // active, by sort order then id (course_id from their subject)
  lessons: StructureLesson[];   // ready to study, by sort order then id
};

const SLICE = 1000;
/** Raised when the snapshot's shape changes, so an older file is rebuilt. */
const FORMAT = 3;
const PAUSE_MS = 250;

@Injectable()
export class CourseStructureService implements OnModuleInit {
  private readonly logger = new Logger(CourseStructureService.name);
  private snapshot: CourseStructure | null = null;
  private building: Promise<CourseStructure> | null = null;
  private again = false;
  private readonly file = join(process.env.CACHE_DIR || join(process.cwd(), 'storage', 'cache'), 'course-structure.json');

  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Pool) {}

  onModuleInit() {
    onContentVersionChange(() => { this.rebuild(); });
  }

  /** The current snapshot. Waits only when there is none yet (first start without a file). */
  async get(): Promise<CourseStructure> {
    const version = await getContentVersion(this.db);
    if (!this.snapshot) await this.loadFile(version);
    if (this.snapshot && this.snapshot.format === FORMAT && this.snapshot.version === version) return this.snapshot;
    const build = this.rebuild();
    return this.snapshot ?? build;
  }

  /** One worker: a call during a build schedules exactly one more build after it. */
  rebuild(): Promise<CourseStructure> {
    if (this.building) {
      this.again = true;
      return this.building;
    }
    this.building = (async () => {
      try {
        let built: CourseStructure;
        do {
          this.again = false;
          built = await this.build();
          this.snapshot = built;
          await this.saveFile(built);
        } while (this.again);
        return built;
      } finally {
        this.building = null;
      }
    })();
    this.building.catch((error) => this.logger.warn(`Course structure rebuild failed: ${error?.message || error}`));
    return this.building;
  }

  private readsInBuild = 0;

  private async build(): Promise<CourseStructure> {
    this.readsInBuild = 0;
    const version = await getContentVersion(this.db);
    const courses = (await this.slices<StructureCourse>(
      'SELECT id, course_title, course_code, description, exam_type, status, created_at FROM courses',
    )).filter((c) => c.status === 'active');
    sortByName(courses, (c) => String(c.course_title));

    const allSubjects = await this.slices<StructureSubject & { sort_order: number }>(
      'SELECT id, course_id, topic_name, status, sort_order FROM topics',
    );
    const subjectCourse = new Map(allSubjects.map((s) => [Number(s.id), Number(s.course_id)]));
    const subjects = allSubjects.filter((s) => s.status === 'active').sort(bySortThenId);

    const topics = (await this.slices<StructureTopic & { sort_order: number }>(
      'SELECT id, topic_id, subtopic_name, status, sort_order FROM subtopics',
    ))
      .filter((t) => t.status === 'active' && subjectCourse.has(Number(t.topic_id)))
      .map((t) => ({ ...t, course_id: subjectCourse.get(Number(t.topic_id))! }))
      .sort(bySortThenId);

    const lessons = (await this.slices<StructureLesson & { sort_order: number; is_public: number; ready: number }>(
      `SELECT id, course_id, topic_id, subtopic_id, lesson_title, video_url, is_free, status, sort_order, is_public,
              (note_data IS NOT NULL) AS has_note, (pdf_url IS NOT NULL AND pdf_url <> '') AS has_pdf, engine_key,
              UNIX_TIMESTAMP(updated_at) AS updated_ts,
              (note_data IS NOT NULL OR pdf_url IS NOT NULL) AS ready
       FROM lessons`,
    ))
      .filter((l) => l.status === 'active' && Number(l.is_public) === 1 && Number(l.ready) === 1)
      .sort(bySortThenId)
      .map(({ is_public: _p, ready: _r, ...l }) => ({ ...l, has_note: Number(l.has_note), has_pdf: Number(l.has_pdf), updated_ts: Math.floor(Number(l.updated_ts) || 0) }) as StructureLesson);

    this.logger.log(`Course structure v${version}: ${courses.length} courses, ${subjects.length} subjects, ${topics.length} topics, ${lessons.length} lessons`);
    return { format: FORMAT, version, builtAt: new Date().toISOString(), courses, subjects, topics, lessons };
  }

  /** A whole table in id order, at most 1,000 rows per read, a pause between reads. */
  private async slices<T extends RowDataPacket>(select: string): Promise<T[]> {
    const out: T[] = [];
    let after = 0;
    // A pause before every read except the build's first, so the build is a
    // few small reads spread out, never a burst.
    if (this.readsInBuild++ > 0) await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
    for (;;) {
      const [rows] = await this.db.query<T[]>(`${select} WHERE id > ? ORDER BY id LIMIT ${SLICE}`, [after]);
      out.push(...rows);
      if (rows.length < SLICE) return out;
      after = Number(rows[rows.length - 1].id);
      await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
    }
  }

  private async loadFile(version: number) {
    try {
      const saved = JSON.parse(await readFile(this.file, 'utf8')) as CourseStructure;
      if (saved && saved.format === FORMAT && saved.version === version && Array.isArray(saved.lessons)) this.snapshot = saved;
    } catch { /* no file yet */ }
  }

  private async saveFile(structure: CourseStructure) {
    try {
      await mkdir(join(this.file, '..'), { recursive: true });
      const tmp = `${this.file}.${process.pid}.tmp`;
      await writeFile(tmp, JSON.stringify(structure));
      await rename(tmp, this.file); // atomic replace
    } catch (error: any) {
      this.logger.warn(`Course structure file not saved: ${error?.message || error}`);
    }
  }
}

function bySortThenId(a: { sort_order?: number; id: number }, b: { sort_order?: number; id: number }) {
  return Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0) || Number(a.id) - Number(b.id);
}
