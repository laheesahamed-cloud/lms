import { Inject, Injectable, Logger } from '@nestjs/common';
import { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { DATABASE_CONNECTION } from '../../database/database.tokens';
import { computeStreak, localDateKey } from './streak';
import { XP } from './xp.rules';

type XpEntry = { type: string; refId: number; xp: number };

export type XpResult = {
  /** XP actually added by this action. */
  awarded: number;
  /** The daily limit stopped some or all of it. */
  capped: boolean;
  /** Why nothing was paid, when that is the case. */
  reason?: 'low_score' | 'too_fast' | 'unverified' | 'too_soon' | 'nothing_new';
};

const NONE: XpResult = { awarded: 0, capped: false };

/**
 * Saved XP. Points are written once, when earned, into xp_events (one row per
 * reward, with a unique key so the same reward can never be paid twice) and
 * added to a running total in student_xp. Nothing is recalculated, so XP only
 * ever goes up.
 *
 * Every public method swallows its own errors: a problem here must never fail
 * a quiz submit or a lesson completion.
 */
@Injectable()
export class XpService {
  private readonly logger = new Logger(XpService.name);

  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Pool) {}

  /** Called after an exam attempt has been saved and graded. */
  async onExamSubmitted(userId: number, attemptId: number): Promise<XpResult> {
    try {
      const [rows] = await this.db.execute<RowDataPacket[]>(
        `SELECT qa.quiz_id, qa.total_questions, qa.percentage, qa.pass_status,
                (SELECT TIMESTAMPDIFF(SECOND, es.started_at, NOW())
                   FROM exam_sessions es
                  WHERE es.submitted_attempt_id = qa.id
                  LIMIT 1) AS secs
           FROM quiz_attempts qa
          WHERE qa.id = ? AND qa.user_id = ? AND qa.status = 'submitted'
          LIMIT 1`,
        [attemptId, userId]
      );
      const row = rows[0];
      if (!row) return NONE;

      // Each attempt is looked at once. Without this, a second look at the
      // same attempt would take it for a retake and pay again.
      const [marker] = await this.db.execute<ResultSetHeader>(
        `INSERT IGNORE INTO xp_events (user_id, event_type, ref_id, xp, day) VALUES (?, 'exam_attempt', ?, 0, ?)`,
        [userId, attemptId, localDateKey(new Date())]
      );
      if (marker.affectedRows === 0) return { awarded: 0, capped: false, reason: 'nothing_new' };

      if (Number(row.percentage) < XP.MIN_PERCENT) {
        return { awarded: 0, capped: false, reason: 'low_score' };
      }

      // Finished faster than anyone could read the questions: no XP. Only
      // judged when the session start is known.
      const questions = Number(row.total_questions || 0);
      if (row.secs !== null && Number(row.secs) < questions * XP.EXAM_MIN_SECONDS_PER_QUESTION) {
        return { awarded: 0, capped: false, reason: 'too_fast' };
      }

      const quizId = Number(row.quiz_id);
      const entries: XpEntry[] = [];

      const [took] = await this.db.execute<RowDataPacket[]>(
        `SELECT 1 FROM xp_events WHERE user_id = ? AND event_type = 'exam_take' AND ref_id = ? LIMIT 1`,
        [userId, quizId]
      );
      if (!took.length) {
        entries.push({ type: 'exam_take', refId: quizId, xp: XP.EXAM_TAKE });
      } else {
        // A repeat. A few pay a little; after that, nothing. Each paid repeat
        // takes the next slot in quizId*100 .. quizId*100+99.
        const [paid] = await this.db.execute<RowDataPacket[]>(
          `SELECT COUNT(*) AS c FROM xp_events
            WHERE user_id = ? AND event_type = 'exam_retake' AND ref_id >= ? AND ref_id < ?`,
          [userId, quizId * 100, quizId * 100 + 100]
        );
        const used = Number(paid[0]?.c || 0);
        if (used < XP.MAX_PAID_RETAKES) {
          entries.push({ type: 'exam_retake', refId: quizId * 100 + used, xp: XP.EXAM_RETAKE });
        }
      }
      if (String(row.pass_status) === 'pass') {
        entries.push({ type: 'exam_pass', refId: quizId, xp: XP.EXAM_PASS });
      }
      if (!entries.length) {
        return { awarded: 0, capped: false, reason: 'nothing_new' };
      }

      entries.push(...(await this.streakEntries(userId)));
      return await this.award(userId, entries);
    } catch (error) {
      this.logger.error(`XP for exam attempt ${attemptId} failed`, error as Error);
      return NONE;
    }
  }

  /** Called when a lesson has just been marked complete. */
  async onLessonCompleted(userId: number, lessonId: number): Promise<XpResult> {
    try {
      const [rows] = await this.db.execute<RowDataPacket[]>(
        `SELECT TIMESTAMPDIFF(SECOND, last_opened_at, NOW()) AS secs
           FROM lesson_opens WHERE user_id = ? AND lesson_id = ? LIMIT 1`,
        [userId, lessonId]
      );
      // No record of the lesson being opened (an older app, or a request that
      // skipped the screen): the lesson still completes, but pays nothing.
      if (!rows.length) return { awarded: 0, capped: false, reason: 'unverified' };
      if (Number(rows[0].secs) < XP.LESSON_MIN_SECONDS) {
        return { awarded: 0, capped: false, reason: 'too_soon' };
      }

      const entries: XpEntry[] = [{ type: 'lesson', refId: lessonId, xp: XP.LESSON }];
      entries.push(...(await this.streakEntries(userId)));
      const result = await this.award(userId, entries);
      return result.awarded === 0 && !result.capped ? { ...result, reason: 'nothing_new' } : result;
    } catch (error) {
      this.logger.error(`XP for lesson ${lessonId} failed`, error as Error);
      return NONE;
    }
  }

  /** The lesson screen opened. The 60 second clock starts here. */
  async markLessonOpened(userId: number, lessonId: number): Promise<void> {
    try {
      await this.db.execute(
        `INSERT INTO lesson_opens (user_id, lesson_id, last_opened_at)
         VALUES (?, ?, NOW())
         ON DUPLICATE KEY UPDATE last_opened_at = NOW()`,
        [userId, lessonId]
      );
    } catch (error) {
      this.logger.error(`Could not record lesson ${lessonId} opening`, error as Error);
    }
  }

  async getSummary(userId: number) {
    try {
      const [[totalRows], [todayRows]] = await Promise.all([
        this.db.execute<RowDataPacket[]>(`SELECT total_xp FROM student_xp WHERE user_id = ? LIMIT 1`, [userId]),
        this.db.execute<RowDataPacket[]>(
          `SELECT COALESCE(SUM(xp), 0) AS s FROM xp_events
            WHERE user_id = ? AND day = ? AND event_type <> 'starting_xp'`,
          [userId, localDateKey(new Date())]
        ),
      ]);
      const totalXp = Number(totalRows[0]?.total_xp || 0);
      return {
        totalXp,
        xpToday: Number(todayRows[0]?.s || 0),
        xpDailyCap: XP.DAILY_CAP,
        level: Math.floor(totalXp / XP.LEVEL_SIZE) + 1,
      };
    } catch (error) {
      this.logger.error('Could not read XP summary', error as Error);
      return { totalXp: 0, xpToday: 0, xpDailyCap: XP.DAILY_CAP, level: 1 };
    }
  }

  /**
   * The streak rewards for today, or nothing if today's was already paid. The
   * streak days are read only once per student per day.
   */
  private async streakEntries(userId: number): Promise<XpEntry[]> {
    const today = localDateKey(new Date());
    const dayRef = Number(today.replace(/-/g, '')); // 20261111

    const [seen] = await this.db.execute<RowDataPacket[]>(
      `SELECT 1 FROM xp_events WHERE user_id = ? AND event_type = 'streak_day' AND ref_id = ? LIMIT 1`,
      [userId, dayRef]
    );
    if (seen.length) return [];

    const entries: XpEntry[] = [{ type: 'streak_day', refId: dayRef, xp: XP.STREAK_DAY }];

    const [days] = await this.db.execute<RowDataPacket[]>(
      `SELECT attempt_day FROM (
         SELECT DISTINCT DATE(COALESCE(submitted_at, created_at)) AS attempt_day
           FROM quiz_attempts WHERE user_id = ? AND status = 'submitted'
         UNION
         SELECT DISTINCT DATE(created_at) AS attempt_day
           FROM study_activity_events
          WHERE user_id = ? AND activity_type IN ('practice_completed', 'ai_note_viewed')
       ) AS days`,
      [userId, userId]
    );
    const keys = days.map((row) =>
      (row.attempt_day as unknown) instanceof Date
        ? localDateKey(row.attempt_day as Date)
        : String(row.attempt_day).slice(0, 10)
    );
    keys.push(today); // what the student just did counts for today

    const { streak } = computeStreak(keys, today);
    if (streak >= 7) entries.push({ type: 'streak_7', refId: 0, xp: XP.STREAK_7 });
    if (streak >= 30) entries.push({ type: 'streak_30', refId: 0, xp: XP.STREAK_30 });
    return entries;
  }

  /**
   * Pays the entries in order, never past the daily cap and never twice.
   * A reward the cap blocks outright is left unrecorded, so it can still be
   * earned on another day; one the cap only trims is paid in part.
   */
  private async award(userId: number, entries: XpEntry[]): Promise<XpResult> {
    const day = localDateKey(new Date());
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT COALESCE(SUM(xp), 0) AS s FROM xp_events
        WHERE user_id = ? AND day = ? AND event_type <> 'starting_xp'`,
      [userId, day]
    );
    let remaining = Math.max(0, XP.DAILY_CAP - Number(rows[0]?.s || 0));

    let awarded = 0;
    let capped = false;
    for (const entry of entries) {
      if (entry.xp <= 0) continue;
      if (remaining <= 0) {
        capped = true;
        continue;
      }
      const pay = Math.min(entry.xp, remaining);
      const [result] = await this.db.execute<ResultSetHeader>(
        `INSERT IGNORE INTO xp_events (user_id, event_type, ref_id, xp, day) VALUES (?, ?, ?, ?, ?)`,
        [userId, entry.type, entry.refId, pay, day]
      );
      if (result.affectedRows === 1) {
        awarded += pay;
        remaining -= pay;
        if (pay < entry.xp) capped = true;
      }
    }

    if (awarded > 0) {
      await this.db.execute(
        `INSERT INTO student_xp (user_id, total_xp) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE total_xp = total_xp + VALUES(total_xp)`,
        [userId, awarded]
      );
    }
    return { awarded, capped };
  }
}
