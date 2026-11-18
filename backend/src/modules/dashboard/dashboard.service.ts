import { looksLikeAccessToken } from '../../common/auth/access-token';
import { loadQuizInfo, loadRecentResults } from '../../common/utils/recent-results';
import { userFromAccessToken } from '../../common/auth/token-user';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { runInBatches } from '../../common/utils/run-in-batches';
import { createHash } from 'node:crypto';
import { Pool, RowDataPacket } from 'mysql2/promise';
import { DATABASE_CONNECTION } from '../../database/database.tokens';
import { isMobileAppClient } from '../../common/utils/mobile-client.util';
import { AuthService } from '../auth/auth.service';
import { extractBearerToken, hashSessionToken } from '../auth/auth-token.util';
import { CoursesService } from '../courses/courses.service';
import { computeStreak } from '../xp/streak';
import { XpService } from '../xp/xp.service';
import { searchWords, wordSearchFilter } from '../../common/utils/word-search';
import { UsersService } from '../users/users.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { RecordStudyActivityDto } from './dto/record-study-activity.dto';
import { AreaRow, DayRow, StudySummary, StudyStatsService } from '../study-stats/study-stats.service';
import { progressWrite, takeRideAlong, TODAY } from '../../common/utils/progress-write';
import { localDateKey } from '../xp/streak';
import { CourseStructureService } from '../courses/course-structure.service';
import { StudentCatalogueService } from '../courses/student-catalogue.service';
import { optionsOf, sqlCorrectCount, sqlOptionCount } from '../../common/utils/question-content';
import { getContentVersion } from '../../common/utils/content-version';

type AreaNames = {
  course: Map<number, string>;
  subject: Map<number, string>;
  topic: Map<number, string>;
  lessonSubject: Map<number, number>;
};

type StudentCourseProgress = Awaited<ReturnType<CoursesService['findStudentCourses']>>[number];

type CountRow = RowDataPacket & {
  users_count?: number;
  courses_count?: number;
  topics_count?: number;
  quizzes_count?: number;
  questions_count?: number;
  lessons_count?: number;
  total_quizzes?: number;
  total_attempts?: number;
  average_percentage?: number | null;
  total_passed?: number;
  total_smart_notes?: number;
  generated_smart_notes?: number;
};

type StudentUserRow = RowDataPacket & {
  id: number;
  role: 'admin' | 'student';
  status: 'active' | 'inactive';
  full_name?: string;
};

type RecentAttemptRow = RowDataPacket & {
  id: number;
  quiz_title: string;
  quiz_number: number | null;
  display_title_mode: string | null;
  course_title: string | null;
  topic_name: string | null;
  score: number;
  total_questions: number;
  percentage: number;
  pass_status: string;
  submitted_at: string | null;
};

type TopicInsightRow = RowDataPacket & {
  topic_name: string | null;
  course_title: string | null;
  average_percentage: number | null;
  attempts_count: number;
};

type TopicMastery = {
  topicName: string;
  courseTitle: string;
  averagePercentage: number;
  attemptsCount: number;
  mastery: 'weak' | 'improving' | 'strong';
  masteryLabel: 'Weak' | 'Improving' | 'Strong';
  masteryNote: string;
};

type SmartNoteInsightRow = RowDataPacket & {
  id: number;
  title: string;
  updated_at: string;
  has_visual: number;
};

type AttemptDayRow = RowDataPacket & {
  attempt_day: string;
};

type PerformanceWindowRow = RowDataPacket & {
  window_key: 'last_7' | 'previous_7';
  attempts_count: number;
  average_percentage: number | null;
};

type MissedPatternRow = RowDataPacket & {
  course_title: string | null;
  subject_name: string | null;
  topic_name: string | null;
  lesson_title: string | null;
  question_type: 'sba' | 'true_false';
  miss_count: number;
  latest_missed_at: string | null;
};

type NoteReviewRow = RowDataPacket & {
  id: number;
  course_title: string | null;
  topic_name: string | null;
};

type DashboardQuestionRow = RowDataPacket & {
  id: number;
  question_text: string;
  question_type: 'sba' | 'true_false';
  course_title: string | null;
  subject_name: string | null;
  topic_name: string | null;
};

type DashboardQuestionOptionRow = RowDataPacket & {
  id: number;
  question_id: number;
  option_label: string;
  option_text: string;
  is_correct: number;
};

@Injectable()
export class DashboardService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Pool,
    private readonly authService: AuthService,
    private readonly coursesService: CoursesService,
    private readonly xpService: XpService,
    private readonly usersService: UsersService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly studyStats: StudyStatsService,
    private readonly courseStructure: CourseStructureService,
    private readonly studentCatalogue: StudentCatalogueService,
  ) {}

  // Content "added per day" charts are remembered (admin-read-cache.ts) and
  // cleared on any content save; users and attempts stay live.
  /**
   * Admin Hub: everything the page shows, in one request on one connection.
   * Totals come from the course rows' stored counters (lessons = published,
   * questions and assessments = all), user numbers from the users summary
   * (index reads), money numbers only for staff who manage subscriptions.
   * `today` is the admin's own date (YYYY-MM-DD) for "today" numbers.
   */
  async getAdminDashboard(authorization?: string, today?: string) {
    const admin = await this.authService.requireAdmin(authorization);
    const day = typeof today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(today) ? today : null;
    const canSeeMoney = admin.role === 'admin' || Boolean(admin.permissions?.includes('subscriptions.manage'));
    const conn = await this.db.getConnection();
    try {
      const [courseRows] = await conn.query<RowDataPacket[]>('SELECT lesson_count, question_total, quiz_total FROM courses');
      const users = await this.usersService.summary(admin, day ?? undefined, conn);
      const finance = canSeeMoney ? await this.subscriptionsService.adminDashboardFinance(conn, day) : null;
      return {
        totals: {
          courses: courseRows.length,
          lessons: courseRows.reduce((t, c) => t + Number(c.lesson_count || 0), 0),
          questions: courseRows.reduce((t, c) => t + Number(c.question_total || 0), 0),
          quizzes: courseRows.reduce((t, c) => t + Number(c.quiz_total || 0), 0),
        },
        users,
        finance,
        generatedAt: new Date().toISOString(),
      };
    } finally {
      conn.release();
    }
  }

  /**
   * Admin search (header search box and the Structure page's lesson search).
   * Replaces downloading every lesson (8,960 rows, 952 KB), the first 100
   * assessments and the first 100 students to filter them in the browser.
   * At least 2 characters; lessons, assessments and students by word start on
   * FULLTEXT indexes (only matching rows are read), courses (4 rows) by
   * "contains"; each group stops at `limit`; only the groups the staff member
   * may open. One connection, a few small reads.
   */
  async adminSearch(authorization: string | undefined, query: string | undefined, only?: string) {
    const admin = await this.authService.requireAdmin(authorization);
    const q = String(query || '').trim().slice(0, 100);
    const empty = { courses: [], lessons: [], quizzes: [], students: [] };
    if (q.length < 2) return empty;
    const can = (permission: string) => admin.role === 'admin' || Boolean((admin.permissions as string[] | undefined)?.includes(permission));
    const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    // Word-start search on the FULLTEXT indexes (see word-search.ts).
    const words = searchWords(q);
    if (!words.length) return empty;
    const textFilter = (columns: string[]) => wordSearchFilter(columns, words)!;
    const lessonsOnly = only === 'lessons';
    // `only: 'students'` = the Reports student filter (up to 10 students).
    const studentsOnly = only === 'students';
    const limit = lessonsOnly || studentsOnly ? 10 : 4;
    const conn = await this.db.getConnection();
    try {
      const result: Record<string, unknown[]> = { ...empty };
      if (can('content.manage') && !lessonsOnly && !studentsOnly) {
        const [rows] = await conn.query<RowDataPacket[]>(
          'SELECT id, course_title FROM courses WHERE course_title LIKE ? OR description LIKE ? LIMIT ?', [like, like, limit]);
        result.courses = rows.map((r) => ({ id: Number(r.id), title: String(r.course_title || '') }));
      }
      if (can('content.manage') && !studentsOnly) {
        // Names for the few rows found come by primary key.
        const lessonText = textFilter(['l.lesson_title']);
        const [rows] = await conn.query<RowDataPacket[]>(
          `SELECT l.id, l.lesson_title, l.status, l.course_id, l.topic_id, l.subtopic_id,
             c.course_title, t.topic_name, s.subtopic_name
           FROM lessons l
           LEFT JOIN courses c ON c.id = l.course_id
           LEFT JOIN topics t ON t.id = l.topic_id
           LEFT JOIN subtopics s ON s.id = l.subtopic_id
           WHERE ${lessonText.sql}
             AND l.is_public = 1 AND l.engine_key = 'gemini'
           LIMIT ?`, [...lessonText.params, limit]);
        result.lessons = rows.map((r) => ({
          id: Number(r.id),
          title: String(r.lesson_title || ''),
          status: String(r.status || 'active'),
          courseId: r.course_id == null ? null : Number(r.course_id),
          topicId: r.topic_id == null ? null : Number(r.topic_id),
          subtopicId: r.subtopic_id == null ? null : Number(r.subtopic_id),
          courseTitle: String(r.course_title || ''),
          topicName: String(r.topic_name || ''),
          subtopicName: String(r.subtopic_name || ''),
        }));
      }
      if (can('quizzes.manage') && !lessonsOnly && !studentsOnly) {
        const quizText = textFilter(['q.quiz_title']); // 10.54: one name column
        const [rows] = await conn.query<RowDataPacket[]>(
          `SELECT q.id, q.quiz_title AS title, c.course_title, t.topic_name
           FROM quizzes q
           LEFT JOIN courses c ON c.id = q.course_id
           LEFT JOIN topics t ON t.id = q.topic_id
           WHERE ${quizText.sql}
           LIMIT ?`, [...quizText.params, limit]);
        result.quizzes = rows.map((r) => ({
          id: Number(r.id), title: String(r.title || ''), courseTitle: String(r.course_title || ''), topicName: String(r.topic_name || ''),
        }));
      }
      if (can('students.manage') && !lessonsOnly) {
        const userText = textFilter(['full_name', 'email']);
        const [rows] = await conn.query<RowDataPacket[]>(
          `SELECT id, full_name, email, status FROM users
           WHERE ${userText.sql} AND role = 'student' AND deleted_at IS NULL
           LIMIT ?`, [...userText.params, limit]);
        result.students = rows.map((r) => ({
          id: Number(r.id), fullName: String(r.full_name || ''), email: String(r.email || ''), status: String(r.status || ''),
        }));
      }
      return result;
    } finally {
      conn.release();
    }
  }

  /**
   * The whole Study Hub in one answer: the website and older app builds.
   * New app builds get the top part with the start-up request and the lower
   * cards with getStudentHubMore when they are scrolled near (design A).
   */
  async getStudentDashboard(authorization?: string, appClient?: string) {
    const student = await this.findActiveStudentByToken(this.extractToken(authorization));
    const top = await this.hubTop(student, authorization);
    const more = await this.hubMore(student, appClient, top.__stats);
    const { __stats: _s, ...rest } = top;
    return { ...rest, ...more };
  }

  /** Study Hub top part: greeting, streak, level, continue card, chips, course progress. */
  /**
   * lite (the phone, step 5): no course progress and no latest attempt — the
   * app builds both from the catalogue, its progress and its results list —
   * so no lesson-progress rows and no attempt reads here.
   */
  async getStudentHubTop(authorization?: string, lite = false) {
    const student = await this.findActiveStudentByToken(this.extractToken(authorization));
    const { __stats: _s, ...top } = await this.hubTop(student, authorization, lite);
    return top;
  }

  /** Study Hub lower cards: plan, analytics, question of the day, weak areas, recent results. */
  async getStudentHubMore(authorization?: string, appClient?: string, webLite = false) {
    const student = await this.findActiveStudentByToken(this.extractToken(authorization));
    // The phone takes its recent attempts from the results list it keeps; the
    // light website (10.22) too, and it picks its own question of the day.
    // 10.31: the app's Question of the Day is kept and picked on the phone
    // (GET /student/dashboard/question only when it has nothing saved), so
    // the lower cards no longer carry one for the app.
    const phoneOrLite = isMobileAppClient(appClient) || webLite;
    return this.hubMore(student, appClient, undefined, phoneOrLite, phoneOrLite);
  }

  /**
   * 10.31: one question + its 5 options for the app's Question of the Day.
   * One statement: the question picked by index (status, type, id >= x,
   * LIMIT 1 off idx_questions_status_type_id) joined to its options by
   * row (10.43: options are in questions.options_json) — 1 row. No
   * explanation. Kept per student for the day (a retry costs nothing).
   */
  async getStudentQuestionOfDay(authorization?: string) {
    const student = await this.findActiveStudentByToken(this.extractToken(authorization));
    return this.getRandomDashboardQuestion(student.id, 'xyndrome-mobile-app');
  }

  private async hubTop(student: { id: number; full_name?: string }, authorization?: string, lite = false) {
    const serverClock = this.buildServerClock(new Date());
    // Stored numbers: summary + today's row (1 row each), active days of the
    // last 14 days (≤14 rows), the 3 weakest subjects (3 rows off the index).
    const stats = await this.studyStats.summary(student.id);
    // 10.17: the active days and exam windows come from the ring on the summary
    // row; weak areas are worked out on the phone (none from the server).
    const recentDays = stats.recentDays || [];
    const weakAreas: AreaRow[] = [];
    const [courseProgress, xpSummary, totalQuizzes, names, latestAttempt] = await Promise.all([
      lite ? Promise.resolve([] as StudentCourseProgress[]) : this.coursesService.findStudentCourses(authorization),
      this.xpService.getSummary(student.id, stats.today.xp, stats.totalXp),
      this.activeQuizCount(),
      this.areaNames(),
      // The continue card points at the newest attempt (2 rows); the phone
      // has it in its results list.
      lite ? Promise.resolve([]) : this.recentAttempts(student.id, 1),
    ]);

    const totalAttempts = stats.attemptsTotal;
    const totalPassed = stats.passedTotal;
    const averagePercentage = stats.averagePercentage;
    const passRate = totalAttempts > 0 ? (totalPassed / totalAttempts) * 100 : 0;
    const weekStart = this.shiftDayKey(stats.today.day, -6);
    // 10.28: this week's active days from the streak itself — the last
    // `streak` days ending on the last active day (no day rows are kept).
    const recentActiveDays: string[] = [];
    if (stats.streak > 0 && stats.lastActiveDay && stats.lastActiveDay >= this.shiftDayKey(stats.today.day, -1)) {
      for (let i = 0; i < stats.streak; i++) {
        const day = this.shiftDayKey(stats.lastActiveDay, -i);
        if (day < weekStart) break;
        recentActiveDays.unshift(day);
      }
    }
    const weakTopics = weakAreas.map((area) => this.subjectInsight(area, names));
    // 10.28: the streak is extended today once all four goals are done.
    const quizDoneToday = stats.todayBits === TODAY.ALL;
    const { dailyGoals, completedGoals, performanceSnapshot } = this.goalsAndSnapshot(stats, recentDays, weakAreas[0] || null, weakTopics[0] || null);

    return {
      __stats: { stats, recentDays, weakAreas },
      user: { id: student.id, fullName: student.full_name || '' },
      serverClock,
      totalQuizzes,
      totalCourses: lite ? (await this.courseStructure.get()).courses.length : courseProgress.length,
      totalAttempts,
      quizDayStreak: stats.streak,
      // Whether the streak was already extended today — the app uses it to
      // decide on a "your streak ends tonight" reminder.
      quizDoneToday,
      // 10.28: today's 4 goals as bits (lesson 1 · exam 2 · practice 4 · flashcards 8).
      todayBits: stats.todayBits,
      streakGraceActive: stats.streakGraceActive,
      // Saved XP: only ever goes up.
      totalXp: xpSummary.totalXp,
      xpToday: xpSummary.xpToday,
      xpDailyCap: xpSummary.xpDailyCap,
      level: xpSummary.level,
      recentActiveDays,
      avgScore: Number(averagePercentage.toFixed(2)),
      totalPassed,
      passRate: Number(passRate.toFixed(2)),
      courseProgress: courseProgress.map((course) => ({
        id: Number(course.id),
        courseTitle: course.courseTitle,
        courseCode: course.courseCode,
        examType: course.examType,
        subjectCount: Number(course.subjectCount || 0),
        progressPercent: Number(course.progressPercent || 0),
        completedLessonsCount: Number(course.completedLessonsCount || 0),
        totalLessonsCount: Number(course.totalLessonsCount || 0),
        actionLabel: course.actionLabel || 'View Course',
      })),
      courseProgressSummary: this.buildCourseProgressSummary(courseProgress),
      weakTopics,
      dailyGoals,
      dailyGoalsCompleted: completedGoals,
      performanceSnapshot,
      // The newest attempt only; the lower cards bring the last 5.
      recentAttempts: latestAttempt,
      focusTopic: weakTopics[0]?.topicName || 'Start your first quiz',
      focusCourse: weakTopics[0]?.courseTitle || 'No course data yet',
      progressTone: averagePercentage >= 75 ? 'strong' : averagePercentage >= 50 ? 'steady' : 'focus',
      progressNote:
        totalAttempts === 0
          ? 'No submitted quizzes yet. Start with one short quiz to build your baseline.'
          : averagePercentage >= 70
            ? 'You are moving well. Keep revising your weakest subject to stay consistent.'
            : averagePercentage >= 50
              ? 'You are building momentum. Focus on one weak topic and one recent review each day.'
              : 'Your recent results point to one focused review block. Revisit lessons first, then use practice mode before full exams.',
    };
  }

  private async hubMore(
    student: { id: number },
    appClient?: string,
    known?: { stats: StudySummary; recentDays: DayRow[]; weakAreas: AreaRow[] },
    lite = false,
    noQuestion = false,
  ) {
    const stats = known?.stats ?? await this.studyStats.summary(student.id);
    // 10.17: weak / strong / missed areas are the phone's (none from the server).
    const ranked = { weakest: [] as AreaRow[], strongest: [] as AreaRow[], missed: [] as AreaRow[] };
    const [recentAttempts, noteRows, questionOfDay, names] = await Promise.all([
      lite ? Promise.resolve([]) : this.recentAttempts(student.id),
      Promise.resolve([] as RowDataPacket[]), // 10.41: smart notes removed
      noQuestion ? Promise.resolve(null) : this.getRandomDashboardQuestion(student.id, appClient),
      this.areaNames(),
    ]);
    const { weakest, strongest, missed: missedTopics } = ranked;

    const today = stats.today;
    const totalAttempts = stats.attemptsTotal;

    const insights = weakest.map((area) => this.subjectInsight(area, names));
    const weakTopics = insights.slice(0, 3);
    const weakIds = new Set(weakest.slice(0, 3).map((a) => a.area_id));
    const strongTopics = strongest.filter((a) => !weakIds.has(a.area_id)).map((area) => this.subjectInsight(area, names));
    const topicMastery = insights.map((topic) => ({ ...topic, ...this.classifyTopicMastery(topic.averagePercentage) }));
    const weakestTopic = weakTopics[0] || null;
    const todayQuizCount = today.exams + today.practice;
    const todayNoteCount = today.lessons;
    const adaptivePlan = this.buildStudentAdaptivePlan({
      totalAttempts,
      weakestTopic,
      recommendedNoteTitle: String(noteRows[0]?.title || ''),
      todayQuizCount,
      todayNoteCount,
      todayResultViewCount: today.results_viewed,
    });

    return {
      recentAttempts,
      topicMastery,
      weakTopics,
      strongTopics,
      adaptivePlan,
      questionOfDay,
      // Each question's deepest area (topic, else subject, else course),
      // weakest first by wrong-answer rate, with at least MIN_ANSWERED answers
      // in the last 45 days.
      missedPatterns: missedTopics.map((area) => ({
        courseTitle: names.course.get(area.course_id) || 'General',
        subjectName: names.subject.get(area.subject_id) || '',
        topicName: (area.area_id > 0 ? names.topic.get(area.area_id) : '')
          || names.subject.get(area.subject_id) || 'General',
        lessonTitle: '',
        questionType: '',
        missCount: area.wrong,
        answeredCount: area.answered,
        missRate: Math.round(area.wrong_rate * 100),
        latestMissedAt: area.last_wrong_at,
        patternLabel: `${Math.round(area.wrong_rate * 100)}% wrong of ${area.answered}`,
      })),
    };
  }

  /** Today's goals and the 7-day snapshot, from stored rows already read. */
  private goalsAndSnapshot(stats: StudySummary, recentDays: DayRow[], weakestArea: AreaRow | null, weakestTopic: { topicName: string; courseTitle: string } | null) {
    // 10.30: the phone counts today's 4 goals; the server only knows whether
    // the day was done (all 4 → the day-done mark → last_active_day = today).
    const today = stats.today;
    const bits = stats.todayBits || 0;
    const goal = (key: string, bit: number, title: string, description: string) => ({
      key, title, description, completed: (bits & bit) !== 0, progressText: `${(bits & bit) !== 0 ? 1 : 0}/1 done`,
    });
    const dailyGoals = [
      goal('lesson_today', TODAY.LESSON, 'Finish 1 lesson', 'Read a lesson to the end and tap Done.'),
      goal('exam_today', TODAY.EXAM, 'Finish 1 exam', 'Sit one exam from the Q-Bank.'),
      goal('practice_today', TODAY.PRACTICE, 'Finish 1 practice', 'Complete one practice set.'),
      goal('flashcards_today', TODAY.FLASHCARDS, 'Review flashcards', 'Study at least one flashcard.'),
    ];
    const completedGoals = dailyGoals.filter((goal) => goal.completed).length;

    // 7/14-day windows from the 5 recent exam results on the row (10.28: no
    // day rows): each result's % and the day it was sat.
    const weekStart = this.shiftDayKey(today.day, -6);
    const twoWeeksStart = this.shiftDayKey(today.day, -13);
    const windows: PerformanceWindowRow[] = [];
    for (const key of ['last_7', 'previous_7'] as const) {
      const list = (stats.recentResults || []).filter((r) => {
        const day = localDateKey(new Date(r.at));
        return key === 'last_7' ? day >= weekStart : day >= twoWeeksStart && day < weekStart;
      });
      if (!list.length) continue;
      const pct = list.reduce((sum, r) => sum + r.pct, 0);
      windows.push({ window_key: key, attempts_count: list.length, average_percentage: pct / list.length } as PerformanceWindowRow);
    }
    const totalAttempts = stats.attemptsTotal;
    const performanceSnapshot = this.buildStudentPerformanceSnapshot({
      totalAttempts,
      averagePercentage: stats.averagePercentage,
      passRate: totalAttempts > 0 ? (stats.passedTotal / totalAttempts) * 100 : 0,
      quizDayStreak: stats.streak,
      dailyGoalsCompleted: completedGoals,
      dailyGoalsTotal: dailyGoals.length,
      performanceWindows: windows,
    });
    return { dailyGoals, completedGoals, performanceSnapshot };
  }

  /** A subject's stored numbers in the shape the apps already read. */
  private subjectInsight(area: AreaRow, names: AreaNames) {
    return {
      topicName: names.subject.get(area.area_id) || 'General',
      courseTitle: names.course.get(area.course_id) || 'General',
      averagePercentage: Number(((1 - area.wrong_rate) * 100).toFixed(2)),
      attemptsCount: area.answered,
    };
  }

  /**
   * The newest results (up to 5) from the student's summary row (10.44: the
   * old attempts table is gone), titles by quiz id. The id is the quiz id —
   * the result and review screens open by it (one recent result per quiz).
   */
  private async recentAttempts(userId: number, limit = 5) {
    const attempts = (await loadRecentResults(this.db, userId))
      .slice(0, Math.max(1, Math.min(5, limit)))
      .map((r) => ({
        id: r.quizId, quiz_id: r.quizId, score: r.correct ?? Math.round((r.pct / 100) * r.questionCount),
        total_questions: r.questionCount, percentage: r.pct, pass_status: r.passed ? 'pass' : 'fail', submitted_at: r.at,
      }));
    if (!attempts.length) return [];
    const byId = await loadQuizInfo(this.db, attempts.map((a) => a.quiz_id));
    const names = await this.areaNames();
    return attempts.map((row) => {
      const quiz = byId.get(Number(row.quiz_id));
      return {
        id: row.id,
        quizTitle: (quiz?.student_title || '').trim() || quiz?.quiz_title || '',
        // The client names a quiz "Quiz N" in number mode.
        quizNumber: Number(quiz?.quiz_number || 0),
        displayTitleMode: quiz?.display_title_mode === 'title' ? 'title' : 'number',
        courseTitle: names.course.get(Number(quiz?.course_id)) || '',
        topicName: names.subject.get(Number(quiz?.topic_id)) || '',
        score: row.score,
        totalQuestions: row.total_questions,
        percentage: Number(row.percentage || 0),
        passStatus: row.pass_status,
        submittedAt: row.submitted_at,
      };
    });
  }

  // Course, subject and topic names from the shared course-structure snapshot
  // (0 database rows), rebuilt only when the snapshot changes.
  private namesCache: { builtAt: string; names: AreaNames } | null = null;
  private async areaNames(): Promise<AreaNames> {
    const structure = await this.courseStructure.get();
    if (this.namesCache?.builtAt === structure.builtAt) return this.namesCache.names;
    const names: AreaNames = {
      course: new Map(structure.courses.map((c) => [Number(c.id), String(c.course_title)])),
      subject: new Map(structure.subjects.map((s) => [Number(s.id), String(s.topic_name)])),
      topic: new Map(structure.topics.map((t) => [Number(t.id), String(t.subtopic_name)])),
      lessonSubject: new Map(structure.lessons.map((l) => [Number(l.id), Number(l.topic_id) || 0])),
    };
    this.namesCache = { builtAt: structure.builtAt, names };
    return names;
  }

  // Active quiz sets: from the shared student catalogue in memory (0 rows).
  // It used to count every active quiz row (649) after each restart.
  private async activeQuizCount() {
    return (await this.studentCatalogue.get()).quizCount;
  }

  private shiftDayKey(key: string, days: number) {
    const [y, m, d] = key.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d + days));
    return date.toISOString().slice(0, 10);
  }

  async recordStudentActivity(authorization: string | undefined, dto: RecordStudyActivityDto) {
    const student = await this.findActiveStudentByToken(this.extractToken(authorization));

    // 10.28: no activity log. A practice finished by an older build sets
    // today's practice goal on the student's row (1 statement, no XP — the new
    // app sends practices along with its next request instead). Lesson and
    // result views need nothing stored.
    if (dto.activityType === 'practice_completed') {
      await this.studyStats.ensureBuilt(student.id);
      const day = StudyStatsService.todayKey();
      const w = progressWrite(day, { practices: takeRideAlong() });
      if (w.seq.params.length) await this.db.execute(
        `UPDATE student_study_summary SET ${w.streak.sql}, ${w.pay.sql}, ${w.seq.sql} WHERE user_id = ?`,
        [...w.streak.params, ...w.pay.params, ...w.seq.params, student.id],
      );
    }

    if (dto.activityType.endsWith('_protection_attempt')) {
      console.warn(JSON.stringify({
        event: 'content_protection_attempt',
        userId: student.id,
        activityType: dto.activityType,
        itemId: dto.itemId ?? null,
        eventType: dto.eventType || '',
      }));
    }

    return { ok: true };
  }

  private buildStudentPerformanceSnapshot({
    totalAttempts,
    averagePercentage,
    passRate,
    quizDayStreak,
    dailyGoalsCompleted,
    dailyGoalsTotal,
    performanceWindows,
  }: {
    totalAttempts: number;
    averagePercentage: number;
    passRate: number;
    quizDayStreak: number;
    dailyGoalsCompleted: number;
    dailyGoalsTotal: number;
    performanceWindows: PerformanceWindowRow[];
  }) {
    const last7 = performanceWindows.find((row) => row.window_key === 'last_7');
    const previous7 = performanceWindows.find((row) => row.window_key === 'previous_7');
    const last7Attempts = Number(last7?.attempts_count || 0);
    const previous7Attempts = Number(previous7?.attempts_count || 0);
    const last7Average = Number(last7?.average_percentage || 0);
    const previous7Average = Number(previous7?.average_percentage || 0);
    const scoreDelta = previous7Attempts > 0
      ? Math.round(last7Average - previous7Average)
      : last7Attempts > 0 ? Math.round(last7Average) : 0;
    const goalCompletionRate = dailyGoalsTotal > 0 ? dailyGoalsCompleted / dailyGoalsTotal : 0;
    const readinessScore = totalAttempts === 0
      ? 0
      : Math.round(
          Math.min(100, Math.max(0,
            averagePercentage * 0.5 +
            passRate * 0.25 +
            Math.min(quizDayStreak, 7) * 3 +
            goalCompletionRate * 20
          ))
        );

    return {
      windowLabel: 'Last 7 days',
      comparisonLabel: 'Previous 7 days',
      dateRangeLabel: 'Server calendar: last 7 days',
      sourceLabel: 'Submitted quiz attempts',
      emptyState: 'No submitted quiz attempts in this window yet.',
      readinessScore,
      readinessLabel:
        readinessScore >= 75 ? 'Ready to advance' :
        readinessScore >= 50 ? 'Building steadily' :
        totalAttempts > 0 ? 'Focus review recommended' : 'Baseline not set',
      weeklyAttempts: last7Attempts,
      weeklyAverage: Number(last7Average.toFixed(2)),
      previousWeeklyAverage: Number(previous7Average.toFixed(2)),
      scoreDelta,
      scoreTrend:
        previous7Attempts === 0
          ? last7Attempts > 0 ? 'new' : 'empty'
          : scoreDelta > 3 ? 'up'
            : scoreDelta < -3 ? 'down'
              : 'steady',
      trendLabel:
        previous7Attempts === 0
          ? last7Attempts > 0 ? 'New activity this week' : 'No quiz activity yet'
          : scoreDelta > 3 ? `+${scoreDelta} pts vs last week`
            : scoreDelta < -3 ? `${scoreDelta} pts vs last week`
              : 'Stable vs last week',
      consistencyLabel:
        quizDayStreak >= 5 ? 'Excellent consistency' :
        quizDayStreak >= 2 ? 'Momentum building' :
        last7Attempts > 0 ? 'Keep the rhythm going' : 'Start today',
    };
  }

  private buildServerClock(now: Date) {
    return {
      nowIso: now.toISOString(),
      dateKey: this.formatDateKey(now),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'server-local',
      source: 'api-server',
    };
  }

  private formatDateKey(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private buildCourseProgressSummary(courses: StudentCourseProgress[]) {
    const completedLessons = courses.reduce(
      (sum, course) => sum + Number(course.completedLessonsCount || 0),
      0
    );
    const totalLessons = courses.reduce(
      (sum, course) => sum + Number(course.totalLessonsCount || 0),
      0
    );
    const overallProgressPercent = totalLessons > 0
      ? Math.round((completedLessons / totalLessons) * 100)
      : 0;

    return {
      visibleCourses: courses.length,
      completedLessons,
      totalLessons,
      overallProgressPercent,
      sourceLabel: 'Course lesson progress',
    };
  }

  private buildStudentAdaptivePlan({
    totalAttempts,
    weakestTopic,
    recommendedNoteTitle,
    todayQuizCount,
    todayNoteCount,
    todayResultViewCount,
  }: {
    totalAttempts: number;
    weakestTopic: { topicName: string; courseTitle: string; averagePercentage: number; attemptsCount: number } | null;
    recommendedNoteTitle: string;
    todayQuizCount: number;
    todayNoteCount: number;
    todayResultViewCount: number;
  }) {
    if (totalAttempts === 0) {
      return [
        {
          key: 'baseline',
          title: 'Set your baseline',
          description: 'Take one practice quiz so the LMS can start personalizing your revision.',
          actionType: 'quiz',
          status: todayQuizCount > 0 ? 'done' : 'next',
        },
        {
          key: 'first-review',
          title: 'Review immediately',
          description: 'Open the result after your first quiz and mark the questions that felt uncertain.',
          actionType: 'results',
          status: todayResultViewCount > 0 ? 'done' : 'queued',
        },
        {
          key: 'lesson-primer',
          title: recommendedNoteTitle || 'Read one lesson',
          description: 'Pair quiz practice with one short lesson review to make the first score useful.',
          actionType: 'note',
          status: todayNoteCount > 0 ? 'done' : 'queued',
        },
      ];
    }

    return [
      {
        key: 'weak-topic-practice',
        title: weakestTopic ? `Practice ${weakestTopic.topicName}` : 'Practice your next quiz',
        description: weakestTopic
          ? `${weakestTopic.courseTitle} is the clearest place to gain points right now.`
          : 'Keep your quiz rhythm active with one focused practice session.',
        actionType: 'quiz',
        status: todayQuizCount > 0 ? 'done' : 'next',
      },
      {
        key: 'lesson-review',
        title: weakestTopic ? `Review ${weakestTopic.topicName}` : recommendedNoteTitle || 'Review one lesson',
        description: todayNoteCount > 0
          ? 'Lesson review is already logged today. Use the next step for recall.'
          : 'Read the matching lesson before repeating questions from memory.',
        actionType: 'note',
        status: todayNoteCount > 0 ? 'done' : 'next',
      },
      {
        key: 'result-loop',
        title: 'Close the feedback loop',
        description: 'Open your latest result and compare missed questions with the lesson notes.',
        actionType: 'results',
        status: todayResultViewCount > 0 || todayQuizCount > 0 ? 'done' : 'queued',
      },
    ];
  }

  // Question of the day is the same for a student all day (it is picked from a
  // hash of the date and the student id). Each student's answer is kept until
  // midnight, so after the first dashboard of the day it costs no database work
  // (until the process restarts).
  private readonly questionOfDayCache = new Map<string, { value: unknown; expiresAt: number }>();
  private readonly questionOfDayInflight = new Map<string, Promise<unknown>>();
  private webQuestionPoolCache: { ids: number[]; expiresAt: number } | null = null;
  private webQuestionPoolInflight: Promise<number[]> | null = null;
  private static readonly WEB_QUESTION_POOL_TTL_MS = 60 * 60 * 1000;

  // A question the widget can show: an active single-best-answer question with
  // five options, exactly one of them correct.
  // 10.43: options are in questions.options_json.
  private static readonly DASHBOARD_QUESTION_ELIGIBLE = `
       q.status = 'active'
         AND q.question_type = 'sba'
         AND ${sqlOptionCount('q')} = 5
         AND ${sqlCorrectCount('q')} = 1`;

  private async getRandomDashboardQuestion(studentId: number, appClient?: string) {
    const client = isMobileAppClient(appClient) ? 'app' : 'web';
    const today = new Date();
    const dayKey = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
    const key = `${dayKey}:${studentId}:${client}`;
    const now = Date.now();
    const cached = this.questionOfDayCache.get(key);
    if (cached && cached.expiresAt > now) {
      return cached.value as Awaited<ReturnType<DashboardService['computeRandomDashboardQuestion']>>;
    }
    // Two dashboard loads at once share one computation instead of two.
    const running = this.questionOfDayInflight.get(key);
    if (running) {
      return running as ReturnType<DashboardService['computeRandomDashboardQuestion']>;
    }
    const task = this.computeRandomDashboardQuestion(studentId, appClient)
      .then((value) => {
        if (this.questionOfDayCache.size > 5000) {
          for (const [k, entry] of this.questionOfDayCache) {
            if (entry.expiresAt <= Date.now()) this.questionOfDayCache.delete(k);
          }
        }
        const midnight = new Date();
        midnight.setHours(24, 0, 0, 0);
        this.questionOfDayCache.set(key, { value, expiresAt: midnight.getTime() });
        return value;
      })
      .finally(() => this.questionOfDayInflight.delete(key));
    this.questionOfDayInflight.set(key, task);
    return task;
  }

  // Website pool: eligible questions that also appear in a free quiz, in id
  // order. Read from the free quizzes' links (a few hundred rows), not from the
  // whole bank, and shared for an hour.
  private async getWebQuestionPool(): Promise<number[]> {
    const cached = this.webQuestionPoolCache;
    if (cached && cached.expiresAt > Date.now()) return cached.ids;
    if (this.webQuestionPoolInflight) return this.webQuestionPoolInflight;
    const task = this.db.execute<(RowDataPacket & { id: number })[]>(
      `SELECT DISTINCT q.id
       FROM quizzes free_quiz
       -- STRAIGHT_JOIN keeps this order (free quizzes first). Left to itself the
       -- optimizer started from questions and checked the whole bank.
       STRAIGHT_JOIN question_quizzes qqf ON qqf.quiz_id = free_quiz.id
       STRAIGHT_JOIN questions q ON q.id = qqf.question_id
       WHERE free_quiz.status = 'active' AND free_quiz.is_free = 1
         AND ${DashboardService.DASHBOARD_QUESTION_ELIGIBLE}
       ORDER BY q.id ASC`
    )
      .then(([rows]) => {
        const ids = rows.map((row) => Number(row.id));
        this.webQuestionPoolCache = { ids, expiresAt: Date.now() + DashboardService.WEB_QUESTION_POOL_TTL_MS };
        return ids;
      })
      .finally(() => {
        this.webQuestionPoolInflight = null;
      });
    this.webQuestionPoolInflight = task;
    return task;
  }

  // App: a random question from the whole bank, by index. The day's hash
  // (date + student) picks a point between the lowest and highest question
  // id; the first active single-best-answer question from there is read with
  // LIMIT 1 off idx_questions_status_type_id (1 row), then its options by
  // question id. A question without exactly 5 options and 1 right answer is
  // skipped (the next one is tried). The id range is kept per catalogue version.
  private questionIdRange: { version: number; min: number; max: number } | null = null;

  private async appQuestionIdRange() {
    const version = await getContentVersion(this.db);
    if (this.questionIdRange?.version === version) return this.questionIdRange;
    const [[range]] = await this.db.execute<(RowDataPacket & { min_id: number | null; max_id: number | null })[]>(
      `SELECT MIN(id) AS min_id, MAX(id) AS max_id FROM questions`
    );
    this.questionIdRange = { version, min: Number(range?.min_id || 0), max: Number(range?.max_id || 0) };
    return this.questionIdRange;
  }

  private async computeAppQuestion(studentId: number) {
    const { min, max } = await this.appQuestionIdRange();
    if (!min || !max) return null;
    let from = min + this.getDashboardQuestionOffset(studentId, max - min + 1);
    let wrapped = false;
    for (let tries = 0; tries < 6; tries += 1) {
      // 10.43: ONE row — the question and its options together
      // (questions.options_json), off idx_questions_status_type_id (id >= ?, LIMIT 1).
      const [rows] = await this.db.execute<RowDataPacket[]>(
        `SELECT id, question_text, question_type, course_id, topic_id, subtopic_id, options_json
           FROM questions FORCE INDEX (idx_questions_status_type_id)
          WHERE status = 'active' AND question_type = 'sba' AND id >= ?
          ORDER BY id ASC
          LIMIT 1`,
        [from]
      );
      const question = rows[0];
      if (!question) {
        if (wrapped) return null;
        wrapped = true;
        from = min;
        continue;
      }
      const options = optionsOf(Number(question.id), question.options_json);
      const correct = options.filter((o) => o.is_correct === 1).length;
      if (options.length !== 5 || correct !== 1) {
        from = Number(question.id) + 1;
        continue;
      }
      const names = await this.areaNames();
      return {
        id: Number(question.id),
        questionType: question.question_type,
        questionText: question.question_text,
        courseTitle: names.course.get(Number(question.course_id)) || '',
        subjectName: names.subject.get(Number(question.topic_id)) || '',
        topicName: names.topic.get(Number(question.subtopic_id)) || names.subject.get(Number(question.topic_id)) || '',
        options: options.map((o) => ({
          id: Number(o.id),
          optionLabel: String(o.option_label ?? ''),
          optionText: String(o.option_text ?? ''),
          isCorrect: Number(o.is_correct) === 1,
        })),
      };
    }
    return null;
  }

  private async computeRandomDashboardQuestion(studentId: number, appClient?: string) {
    // The app may show premium content, so it draws from the whole bank. The
    // website only from questions that also appear in a free quiz.
    if (isMobileAppClient(appClient)) {
      return this.computeAppQuestion(studentId);
    }
    const pool = await this.getWebQuestionPool();
    const pickedId = pool.length ? pool[this.getDashboardQuestionOffset(studentId, pool.length)] : null;
    if (!pickedId) {
      return null;
    }
    const [questionRows] = await this.db.execute<DashboardQuestionRow[]>(
      `SELECT
         q.id,
         q.question_text,
         q.question_type,
         c.course_title,
         subj.topic_name AS subject_name,
         sub.subtopic_name AS topic_name,
         q.options_json
       FROM questions q
       LEFT JOIN courses c ON c.id = q.course_id
       LEFT JOIN topics subj ON subj.id = q.topic_id
       LEFT JOIN subtopics sub ON sub.id = q.subtopic_id
       WHERE q.id = ?
       LIMIT 1`,
      [pickedId]
    );
    const question = questionRows[0];
    if (!question) {
      return null;
    }

    const optionRows = optionsOf(Number(question.id), (question as any).options_json); // 10.43

    return {
      id: Number(question.id),
      questionType: question.question_type,
      questionText: question.question_text,
      courseTitle: question.course_title || '',
      subjectName: question.subject_name || '',
      topicName: question.topic_name || question.subject_name || '',
      options: optionRows.map((option) => ({
        id: Number(option.id),
        optionLabel: option.option_label,
        optionText: option.option_text,
        isCorrect: Number(option.is_correct) === 1,
      })),
    };
  }

  private getDashboardQuestionOffset(studentId: number, totalQuestions: number) {
    const today = new Date();
    const dayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const seed = createHash('sha256').update(`${dayKey}:${studentId}`).digest('hex').slice(0, 12);
    return parseInt(seed, 16) % totalQuestions;
  }

  private extractToken(authorization?: string) {
    const token = extractBearerToken(authorization);

    if (!token) {
      throw new UnauthorizedException('Authentication token is missing');
    }

    return token;
  }

  private async findActiveStudentByToken(sessionToken: string) {
    if (looksLikeAccessToken(sessionToken)) {
      const user = userFromAccessToken(sessionToken);
      if (user.role !== 'student') throw new UnauthorizedException('Student access required');
      if (user.status !== 'active') throw new UnauthorizedException('Your student account is not active yet');
      return user as any;
    }
    const [rows] = await this.db.execute<StudentUserRow[]>(
      `SELECT id, role, status, full_name
       FROM users
       WHERE session_token = ?
         AND session_expires_at > NOW()
       LIMIT 1`,
      [hashSessionToken(sessionToken)]
    );
    const user = rows[0];

    if (!user || user.role !== 'student') {
      throw new UnauthorizedException('Student access required');
    }

    if (user.status !== 'active') {
      throw new UnauthorizedException('Your student account is not active yet');
    }

    return user;
  }

  /**
   * The student's daily streak (with its grace day). The rules live in
   * ../xp/streak.ts so the XP service uses exactly the same ones.
   */
  private calculateQuizDayStreak(days: Array<string | Date>, todayKey?: string) {
    const keys = days
      .filter(Boolean)
      .map((day) => this.normalizeDateKey(day))
      .filter(Boolean);
    return computeStreak(keys, todayKey || this.localDateKey(new Date()));
  }

  /**
   * YYYY-MM-DD for the date as the server's own calendar shows it.
   *
   * toISOString() converts to UTC first. On a server whose clock is ahead of
   * UTC, local midnight is still "yesterday" in UTC, so every day key came out
   * one day early: a quiz done on Wednesday was ticked on Tuesday's circle, and
   * the streak could reset a day too soon.
   */
  private localDateKey(d: Date) {
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  }

  private normalizeDateKey(day: string | Date) {
    if (day instanceof Date) {
      return this.localDateKey(day);
    }

    return String(day).slice(0, 10);
  }

  // Share of answers right in the last 45 days (the area already has at
  // least MIN_ANSWERED answers, so it is not a one-off).
  private classifyTopicMastery(averagePercentage: number): Omit<TopicMastery, 'topicName' | 'courseTitle' | 'averagePercentage' | 'attemptsCount'> {
    if (averagePercentage >= 75) {
      return {
        mastery: 'strong',
        masteryLabel: 'Strong',
        masteryNote: 'Mostly right answers across your recent questions.',
      };
    }

    if (averagePercentage >= 50) {
      return {
        mastery: 'improving',
        masteryLabel: 'Improving',
        masteryNote: 'Building consistency, but still worth revising.',
      };
    }

    return {
      mastery: 'weak',
      masteryLabel: 'Weak',
      masteryNote: 'Needs focused revision and more repetition.',
    };
  }

  private getMasteryRank(mastery: TopicMastery['mastery']) {
    if (mastery === 'weak') return 0;
    if (mastery === 'improving') return 1;
    return 2;
  }

  private getTopicKey(courseTitle: string, topicName: string) {
    return `${courseTitle.trim().toLowerCase()}::${topicName.trim().toLowerCase()}`;
  }
}
