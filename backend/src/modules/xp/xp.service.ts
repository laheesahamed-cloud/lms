import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { StudyStatsService } from '../study-stats/study-stats.service';
import { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { DATABASE_CONNECTION } from '../../database/database.tokens';
import { localDateKey } from './streak';
import { progressWrite, returnRideAlong, takeRideAlong, TODAY } from '../../common/utils/progress-write';
import { XP } from './xp.rules';
import { setLessonBitSql } from '../../common/utils/lesson-bits';

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
 * Saved XP (OPTIMIZE 10.12). XP has ONE home: the student's summary row
 * (student_study_summary: xp_total, xp_today + xp_day, streak XP paid for the
 * day, the 7/30-day bonuses). What was already paid is marked on the row the
 * reward belongs to: a lesson's own progress row (a new completion pays once),
 * an exam's quiz progress row (take / retakes / pass; written by the submit's
 * own quiz-row upsert in StudyStatsService.recordExam, OPTIMIZE 10.13).
 * Every payment is one UPDATE of the summary row that works out the daily cap
 * and the streak XP inside the statement and hands the amount back through
 * LAST_INSERT_ID (no read). student_xp and xp_events are no longer written.
 *
 * Every public method swallows its own errors: a problem here must never fail
 * a quiz submit or a lesson completion.
 */
@Injectable()
export class XpService {
  private readonly logger = new Logger(XpService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Pool,
    @Optional() private readonly studyStats?: StudyStatsService,
  ) {}

  /**
   * "Done" (OPTIMIZE 10.15): ONE statement on the student's summary row —
   * the streak (a finished lesson is an active day), the progress version,
   * the XP, today's lesson count and the lesson's bit — and only when the bit
   * is still off, so a lesson finishes (and pays) once. The new version and the
   * XP come back together in one LAST_INSERT_ID (version × 1000 + XP).
   * [readSeconds]: the phone's timer; without it (older builds, the website)
   * the server's own opening stamp is read as before.
   */
  async onLessonCompleted(userId: number, lessonId: number, readSeconds?: number): Promise<XpResult & { progressVersion?: number }> {
    // The app sends how long the lesson was open; without it nothing is paid
    // (10.28: no lesson-open rows are kept to check it).
    let reason: XpResult['reason'];
    if (readSeconds !== undefined && Number.isFinite(readSeconds)) {
      if (readSeconds < XP.LESSON_MIN_SECONDS) reason = 'too_soon';
    } else {
      reason = 'unverified';
    }
    const base = reason ? 0 : XP.LESSON;
    await this.studyStats?.ensureBuilt(userId);
    const day = localDateKey(new Date());
    // ONE update of the student's row (10.28): the lesson's bit, XP, and
    // whatever rode along (practices, a day-done mark that moves the streak, 10.30).
    const w = progressWrite(day, { baseXpSql: '?', baseXpParams: [base], practices: takeRideAlong() });
    const bit = setLessonBitSql('lessons_done');
    const idx = Math.floor(lessonId / 8);
    const mask = 1 << (lessonId % 8);
    const [res] = await this.db.execute<ResultSetHeader>(
      `UPDATE student_study_summary
          SET ${w.streak.sql},
              progress_version = LAST_INSERT_ID((progress_version + 1) * 1000 + ${w.amount.sql}) DIV 1000,
              ${w.pay.sql},
              lessons_done = ${bit.sql},
              ${w.seq.sql}
        WHERE user_id = ?
          AND (LENGTH(COALESCE(lessons_done, '')) <= ? OR (ORD(SUBSTRING(lessons_done, ? + 1, 1)) & ?) = 0)`,
      [...w.streak.params, ...w.amount.params, ...w.pay.params, ...bit.params(lessonId), ...w.seq.params, userId, idx, idx, mask],
    );
    if (!res.affectedRows) {
      returnRideAlong(); // nothing written: the practices are saved on their own
      return { awarded: 0, capped: false, reason: 'nothing_new' };
    }
    const packed = Number(res.insertId || 0);
    const progressVersion = Math.floor(packed / 1000);
    const awarded = packed % 1000;
    return reason
      ? { awarded: 0, capped: false, reason, progressVersion }
      : { awarded, capped: awarded < base, progressVersion };
  }

  /** The lesson screen opened. The 60 second clock starts here. */
  async markLessonOpened(_userId: number, _lessonId: number): Promise<void> {
    // 10.28: nothing is stored when a lesson opens (the app sends how long it
    // was open with "Done").
  }

  /** totalXp / xpToday: pass them when already known (the Study Hub read the summary row), to skip the read. */
  async getSummary(userId: number, xpToday?: number, knownTotalXp?: number) {
    try {
      let totalXp = knownTotalXp;
      let today = xpToday;
      if (totalXp === undefined || today === undefined) {
        const [rows] = await this.db.execute<RowDataPacket[]>(
          `SELECT xp_total, IF(xp_day = ?, xp_today, 0) AS xp_today FROM student_study_summary WHERE user_id = ? LIMIT 1`,
          [localDateKey(new Date()), userId]
        );
        totalXp = totalXp ?? Number(rows[0]?.xp_total || 0);
        today = today ?? Number(rows[0]?.xp_today || 0);
      }
      return {
        totalXp,
        xpToday: today,
        xpDailyCap: XP.DAILY_CAP,
        level: Math.floor(totalXp / XP.LEVEL_SIZE) + 1,
      };
    } catch (error) {
      this.logger.error('Could not read XP summary', error as Error);
      return { totalXp: 0, xpToday: 0, xpDailyCap: XP.DAILY_CAP, level: 1 };
    }
  }
}
