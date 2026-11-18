import { Inject, Injectable } from '@nestjs/common';
import { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { DATABASE_CONNECTION } from '../../database/database.tokens';
import { rememberSummaryRow } from '../../common/auth/subscription-scope';
import { localDateKey } from '../xp/streak';
import { XP } from '../xp/xp.rules';
import { streakShown } from '../xp/streak-sql';
import { progressWrite, takeRideAlong, TODAY } from '../../common/utils/progress-write';

/**
 * A student's progress lives in ONE row (OPTIMIZE 10.28): `student_study_summary`.
 *
 *  - totals: attempts, passes, the sum of percentages (average = sum / attempts);
 *  - XP: total, today's (with its day), the streak-day / 7 / 30 bonuses paid;
 *  - streak: `streak`, `last_active_day`, the grace-day columns — a day counts
 *    once all four of today's goals are done;
 *  - today's 4 goals are counted on the phone (10.30); the day counts when its
 *    day-done mark rides along (`last_active_day`);
 *  - `lessons_done` (one bit per lesson), `quiz_marks` (one byte per quiz:
 *    passed + best %), `recent_results` (the 5 recent exams), `progress_version`;
 *  - `practice_seq` (the last ride-along practice applied), `flash_history`.
 *
 * Every write is one `UPDATE` of that row. No other per-student table is used:
 * the activity log, the daily rows, the per-quiz and per-lesson rows and the
 * topic stats were removed (weak topics are worked out on the phone).
 */
export const MIN_ANSWERED = 10;

export type AreaLevel = 1 | 2 | 3; // course, subject, topic
export type AnswerStatus = 'correct' | 'wrong' | 'unanswered';
export type MarkedQuestion = {
  course_id: number | null;
  topic_id: number | null;    // subject
  subtopic_id?: number | null; // topic
  status: AnswerStatus;
};

/** Kept as a type for the Study Hub's (empty) server-side area lists. */
export type AreaRow = {
  level: AreaLevel;
  area_id: number;
  course_id: number;
  subject_id: number;
  correct: number;
  wrong: number;
  answered: number;
  wrong_rate: number;
  last_wrong_at: string | null;
};

/** Today, as the Study Hub reads it — from today's bits on the row. */
export type DayRow = {
  day: string;
  exams: number;
  exam_pct_sum: number;
  practice: number;
  lessons: number;
  results_viewed: number;
  subject_ids: string;
  xp: number;
  active: number;
  flashcards?: number;
};

export type StudySummary = {
  attemptsTotal: number;
  passedTotal: number;
  averagePercentage: number;
  streak: number;
  streakGraceActive: boolean;
  today: DayRow;
  todayBits: number;
  totalXp: number;
  recentDays?: DayRow[];
  /** The last day the streak counted (YYYY-MM-DD) — the Study Hub's week dots. */
  lastActiveDay: string;
  /** The 5 recent exam results (% and when) — the Readiness card's 7-day numbers. */
  recentResults: Array<{ pct: number; at: string }>;
};

@Injectable()
export class StudyStatsService {
  /** Students whose summary row is known to exist (skips the insert). */
  private readonly built = new Set<number>();
  private readonly building = new Map<number, Promise<void>>();

  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Pool) {}

  static todayKey() {
    return localDateKey(new Date());
  }

  /**
   * The student's row exists (created empty the first time; once per student
   * per server process). Every student starts fresh (10.28).
   */
  async ensureBuilt(userId: number) {
    if (this.built.has(userId)) return;
    const running = this.building.get(userId);
    if (running) return running;
    const task = (async () => {
      await this.db.execute('INSERT IGNORE INTO student_study_summary (user_id) VALUES (?)', [userId]);
      this.built.add(userId);
    })().finally(() => this.building.delete(userId));
    this.building.set(userId, task);
    return task;
  }

  /**
   * An exam submitted through the older attempt path (inside its transaction):
   * the row's totals, the exam goal for today, XP (first take / first pass, as
   * the attempt path can't see earlier attempts any more) — one statement.
   */
  async recordExam(
    conn: PoolConnection,
    userId: number,
    exam: {
      quizId?: number; attemptId?: number; courseId?: number; subjectId: number | null; percentage: number; passed: boolean;
      questions: MarkedQuestion[]; isGeneral?: boolean; eligible?: boolean;
    },
  ): Promise<{ examAttempts: number; xpBase: number; xpAwarded: number }> {
    const day = StudyStatsService.todayKey();
    const passed = exam.passed ? 1 : 0;
    const xpBase = exam.eligible ? XP.EXAM_TAKE + (passed ? XP.EXAM_PASS : 0) : 0;
    const w = progressWrite(day, { baseXpSql: '?', baseXpParams: [xpBase], practices: takeRideAlong(), captureXp: true });
    // 10.29: no all-time totals on the row any more (the averages come from quiz_marks).
    const [sum] = await conn.execute<any>(
      `INSERT INTO student_study_summary (user_id)
       VALUES (?)
       ON DUPLICATE KEY UPDATE
         ${w.streak.sql},
         ${w.pay.sql},
         ${w.seq.sql}`,
      [userId, ...w.streak.params, ...w.pay.params, ...w.seq.params],
    );
    const xpAwarded = Number(sum?.affectedRows) === 2 ? Number(sum?.insertId || 0) : 0;
    return { examAttempts: 1, xpBase, xpAwarded };
  }

  /** Kept for the older attempt path's pruning; nothing per quiz is stored any more. */
  async attemptsPruned(_conn: PoolConnection, _userId: number, _quizId: number, _pruned: number) {
    return;
  }

  /** Older builds asked for per-quiz rows; the row's quiz marks replace them. */
  async quizProgress(_userId: number): Promise<unknown[]> {
    return [];
  }

  /**
   * The Study Hub's numbers from the ONE row (by primary key). The progress
   * part of the same reply reuses it (no second read).
   */
  async summary(userId: number): Promise<StudySummary> {
    await this.ensureBuilt(userId);
    const today = StudyStatsService.todayKey();
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT streak,
              DATE_FORMAT(last_active_day, '%Y-%m-%d') AS last_active_day,
              DATE_FORMAT(streak_forgiven_day, '%Y-%m-%d') AS streak_forgiven_day, streak_after_forgiven,
              IF(last_active_day <=> ?, 15, 0) AS today_bits,
              xp_total AS total_xp, IF(xp_day = ?, xp_today, 0) AS d_xp,
              lessons_done, quiz_marks, recent_results, progress_version, flash_history, practice_seq
         FROM student_study_summary
        WHERE user_id = ?
        LIMIT 1`,
      [today, today, userId],
    );
    const s = rows[0];
    rememberSummaryRow(userId, s as unknown as Record<string, unknown>);
    const bits = Number(s?.today_bits || 0);
    const todayRow: DayRow = {
      day: today,
      exams: bits & TODAY.EXAM ? 1 : 0,
      exam_pct_sum: 0,
      practice: bits & TODAY.PRACTICE ? 1 : 0,
      lessons: bits & TODAY.LESSON ? 1 : 0,
      flashcards: bits & TODAY.FLASHCARDS ? 1 : 0,
      results_viewed: 0,
      subject_ids: '',
      xp: Number(s?.d_xp || 0),
      active: bits === TODAY.ALL ? 1 : 0,
    };
    const { streak, graceActive } = streakShown(s as any, today);
    // 10.29: exams taken / passed / average from the quiz marks (one byte per
    // quiz: top bit passed, 7 bits best % + 1, 0 = not taken).
    const marks = s?.quiz_marks ? Buffer.from(s.quiz_marks as Buffer) : Buffer.alloc(0);
    let attempts = 0, passedQuizzes = 0, bestSum = 0;
    for (const b of marks) {
      if (!b) continue;
      attempts++;
      if (b & 128) passedQuizzes++;
      bestSum += (b & 127) - 1;
    }
    let recent: Array<{ pct: number; at: string }> = [];
    try {
      recent = (JSON.parse(String(s?.recent_results || '[]')) as any[])
        .map((e) => ({ pct: Number(e?.pct) || 0, at: String(e?.at || '') }))
        .filter((e) => e.at);
    } catch { recent = []; }
    return {
      attemptsTotal: attempts,
      passedTotal: passedQuizzes,
      averagePercentage: attempts ? bestSum / attempts : 0,
      streak,
      streakGraceActive: graceActive,
      today: todayRow,
      todayBits: bits,
      totalXp: Number(s?.total_xp || 0),
      recentDays: [],
      lastActiveDay: String(s?.last_active_day || ''),
      recentResults: recent,
    };
  }
}
