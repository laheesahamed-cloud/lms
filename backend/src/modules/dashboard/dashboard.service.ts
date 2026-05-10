import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Pool, RowDataPacket } from 'mysql2/promise';
import { DATABASE_CONNECTION } from '../../database/database.tokens';
import { extractBearerToken, hashSessionToken } from '../auth/auth-token.util';
import { RecordStudyActivityDto } from './dto/record-study-activity.dto';

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

type NoteReviewRow = RowDataPacket & {
  id: number;
  course_title: string | null;
  topic_name: string | null;
};

type DailyCountRow = RowDataPacket & {
  day_key: string;
  count_value: number;
};

type ActivityFeedRow = RowDataPacket & {
  item_type: string;
  item_id: number;
  title: string | null;
  subtitle: string | null;
  status: string | null;
  created_at: string | null;
};

@Injectable()
export class DashboardService {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Pool) {}

  async getAdminDashboard() {
    const [[summary]] = await this.db.query<CountRow[]>(
      `SELECT
        (SELECT COUNT(*) FROM users) AS users_count,
        (SELECT COUNT(*) FROM courses) AS courses_count,
        (SELECT COUNT(*) FROM topics) AS topics_count,
        (SELECT COUNT(*) FROM quizzes) AS quizzes_count,
        (SELECT COUNT(*) FROM questions) AS questions_count,
        (SELECT COUNT(*) FROM lessons) AS lessons_count`
    );

    const [userGrowthRows] = await this.db.query<DailyCountRow[]>(
      `SELECT DATE(created_at) AS day_key, COUNT(*) AS count_value
       FROM users
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 89 DAY)
       GROUP BY DATE(created_at)
       ORDER BY DATE(created_at) ASC`
    );
    const [courseGrowthRows] = await this.db.query<DailyCountRow[]>(
      `SELECT DATE(created_at) AS day_key, COUNT(*) AS count_value
       FROM courses
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 89 DAY)
       GROUP BY DATE(created_at)
       ORDER BY DATE(created_at) ASC`
    );
    const [lessonGrowthRows] = await this.db.query<DailyCountRow[]>(
      `SELECT DATE(created_at) AS day_key, COUNT(*) AS count_value
       FROM lessons
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 89 DAY)
       GROUP BY DATE(created_at)
       ORDER BY DATE(created_at) ASC`
    );
    const [quizGrowthRows] = await this.db.query<DailyCountRow[]>(
      `SELECT DATE(created_at) AS day_key, COUNT(*) AS count_value
       FROM quizzes
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 89 DAY)
       GROUP BY DATE(created_at)
       ORDER BY DATE(created_at) ASC`
    );
    const [questionGrowthRows] = await this.db.query<DailyCountRow[]>(
      `SELECT DATE(created_at) AS day_key, COUNT(*) AS count_value
       FROM questions
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 89 DAY)
       GROUP BY DATE(created_at)
       ORDER BY DATE(created_at) ASC`
    );
    const [attemptRows] = await this.db.query<DailyCountRow[]>(
      `SELECT DATE(COALESCE(submitted_at, created_at)) AS day_key, COUNT(*) AS count_value
       FROM quiz_attempts
       WHERE COALESCE(submitted_at, created_at) >= DATE_SUB(CURDATE(), INTERVAL 89 DAY)
       GROUP BY DATE(COALESCE(submitted_at, created_at))
       ORDER BY DATE(COALESCE(submitted_at, created_at)) ASC`
    );
    const [recentUsers] = await this.db.query<ActivityFeedRow[]>(
      `SELECT
         'user' AS item_type,
         id AS item_id,
         full_name AS title,
         email AS subtitle,
         status,
         created_at
       FROM users
       ORDER BY created_at DESC, id DESC
       LIMIT 4`
    );
    const [recentCourses] = await this.db.query<ActivityFeedRow[]>(
      `SELECT
         'course' AS item_type,
         id AS item_id,
         course_title AS title,
         course_code AS subtitle,
         status,
         created_at
       FROM courses
       ORDER BY created_at DESC, id DESC
       LIMIT 4`
    );
    const [recentLessons] = await this.db.query<ActivityFeedRow[]>(
      `SELECT
         'lesson' AS item_type,
         l.id AS item_id,
         l.lesson_title AS title,
         CONCAT_WS(' / ', c.course_title, t.topic_name, s.subtopic_name) AS subtitle,
         l.status,
         l.created_at
       FROM lessons l
       LEFT JOIN courses c ON c.id = l.course_id
       LEFT JOIN topics t ON t.id = l.topic_id
       LEFT JOIN subtopics s ON s.id = l.subtopic_id
       ORDER BY l.created_at DESC, l.id DESC
       LIMIT 4`
    );
    const [recentAttempts] = await this.db.query<ActivityFeedRow[]>(
      `SELECT
         'attempt' AS item_type,
         qa.id AS item_id,
         COALESCE(NULLIF(q.student_title, ''), q.quiz_title) AS title,
         CONCAT('Score ', qa.score, '/', qa.total_questions) AS subtitle,
         qa.pass_status AS status,
         COALESCE(qa.submitted_at, qa.created_at) AS created_at
       FROM quiz_attempts qa
       INNER JOIN quizzes q ON q.id = qa.quiz_id
       ORDER BY COALESCE(qa.submitted_at, qa.created_at) DESC, qa.id DESC
       LIMIT 6`
    );

    const totals = {
      users: Number(summary?.users_count || 0),
      courses: Number(summary?.courses_count || 0),
      subjects: Number(summary?.topics_count || 0),
      quizzes: Number(summary?.quizzes_count || 0),
      questions: Number(summary?.questions_count || 0),
      lessons: Number(summary?.lessons_count || 0),
    };

    const userSeries = this.buildDailySeries(userGrowthRows);
    const courseSeries = this.buildDailySeries(courseGrowthRows);
    const lessonSeries = this.buildDailySeries(lessonGrowthRows);
    const quizSeries = this.buildDailySeries(quizGrowthRows);
    const questionSeries = this.buildDailySeries(questionGrowthRows);
    const attemptSeries = this.buildDailySeries(attemptRows);

    const engagementScore = this.calculateAdminEngagementScore({
      attemptsSeries: attemptSeries,
      totals,
    });
    const recommendations = this.buildAdminRecommendations({
      totals,
      engagementScore,
      questionSeries,
      quizSeries,
      lessonSeries,
    });
    const aiInsights = this.buildAdminAiInsights({
      totals,
      userSeries,
      lessonSeries,
      questionSeries,
      quizSeries,
      attemptSeries,
      engagementScore,
    });
    const activityFeed = this.buildAdminActivityFeed([
      ...recentUsers,
      ...recentCourses,
      ...recentLessons,
      ...recentAttempts,
    ]);

    return {
      totalUsers: Number(summary?.users_count || 0),
      totalCourses: Number(summary?.courses_count || 0),
      totalSubjects: Number(summary?.topics_count || 0),
      totalQuizzes: Number(summary?.quizzes_count || 0),
      totalQuestions: Number(summary?.questions_count || 0),
      totalLessons: Number(summary?.lessons_count || 0),
      engagementScore,
      generatedAt: new Date().toISOString(),
      analytics: {
        users: userSeries,
        courses: courseSeries,
        lessons: lessonSeries,
        quizzes: quizSeries,
        questions: questionSeries,
        attempts: attemptSeries,
      },
      aiInsights,
      recommendations,
      activityFeed,
      shortcuts: [
        { label: 'Courses', path: '/courses' },
        { label: 'Structure', path: '/structure' },
        { label: 'Lessons', path: '/structure' },
        { label: 'Questions', path: '/questions' },
        { label: 'Quizzes', path: '/quizzes' },
        { label: 'Users', path: '/users' },
      ],
    };
  }

  private buildDailySeries(rows: DailyCountRow[], totalDays = 90) {
    const valueMap = new Map(
      (rows || []).map((row) => [String(row.day_key).slice(0, 10), Number(row.count_value || 0)])
    );
    const result: Array<{ date: string; value: number }> = [];
    const anchor = new Date();
    anchor.setHours(0, 0, 0, 0);

    for (let offset = totalDays - 1; offset >= 0; offset -= 1) {
      const current = new Date(anchor);
      current.setDate(anchor.getDate() - offset);
      const key = current.toISOString().slice(0, 10);
      result.push({
        date: key,
        value: Number(valueMap.get(key) || 0),
      });
    }

    return result;
  }

  private calculateAdminEngagementScore({
    attemptsSeries,
    totals,
  }: {
    attemptsSeries: Array<{ date: string; value: number }>;
    totals: { users: number; courses: number; subjects: number; quizzes: number; questions: number; lessons: number };
  }) {
    const trailing14 = attemptsSeries.slice(-14);
    const totalAttempts = trailing14.reduce((sum, point) => sum + point.value, 0);
    const activeDays = trailing14.filter((point) => point.value > 0).length;
    const contentDensityBase = totals.courses + totals.lessons + totals.questions + totals.quizzes;
    const contentDensity = Math.min(100, Math.round((contentDensityBase / Math.max(1, totals.users + 5)) * 20));
    const attemptScore = Math.min(100, totalAttempts * 4);
    const consistencyScore = Math.min(100, activeDays * 7);
    return Math.max(24, Math.round((attemptScore * 0.45) + (consistencyScore * 0.35) + (contentDensity * 0.2)));
  }

  private buildAdminRecommendations({
    totals,
    engagementScore,
    questionSeries,
    quizSeries,
    lessonSeries,
  }: {
    totals: { users: number; courses: number; subjects: number; quizzes: number; questions: number; lessons: number };
    engagementScore: number;
    questionSeries: Array<{ date: string; value: number }>;
    quizSeries: Array<{ date: string; value: number }>;
    lessonSeries: Array<{ date: string; value: number }>;
  }) {
    const recentQuestions = questionSeries.slice(-14).reduce((sum, point) => sum + point.value, 0);
    const recentQuizzes = quizSeries.slice(-14).reduce((sum, point) => sum + point.value, 0);
    const recentLessons = lessonSeries.slice(-14).reduce((sum, point) => sum + point.value, 0);
    const recommendations = [
      {
        title: recentQuestions < Math.max(6, recentQuizzes * 3)
          ? 'Expand the question bank before the next assessment push'
          : 'Question supply is keeping pace with new quiz creation',
        detail: recentQuestions < Math.max(6, recentQuizzes * 3)
          ? 'The last two weeks added fewer questions than the quiz pipeline needs. Focus on question authoring or bulk import.'
          : 'The last two weeks show enough new questions to support active assessment growth.',
        actionLabel: recentQuestions < Math.max(6, recentQuizzes * 3) ? 'Open bulk question input' : 'Open question bank',
        actionPath: '/questions/bulk',
        tone: recentQuestions < Math.max(6, recentQuizzes * 3) ? 'warning' : 'positive',
      },
      {
        title: recentLessons < Math.max(2, totals.courses)
          ? 'Course content expansion is lagging behind course count'
          : 'Lesson production is healthy across the course catalog',
        detail: recentLessons < Math.max(2, totals.courses)
          ? 'Add more lessons to keep each course academically dense and easier to monetize.'
          : 'Lesson creation stayed active recently, which supports better learner retention.',
        actionLabel: recentLessons < Math.max(2, totals.courses) ? 'Open structure manager' : 'Open lessons',
        actionPath: recentLessons < Math.max(2, totals.courses) ? '/structure' : '/ai-notes',
        tone: recentLessons < Math.max(2, totals.courses) ? 'warning' : 'positive',
      },
      {
        title: engagementScore < 55
          ? 'Engagement score suggests a reactivation cycle is needed'
          : 'Engagement score indicates healthy learner motion',
        detail: engagementScore < 55
          ? 'Lean on quizzes, content releases, and AI-generated materials to drive another usage wave.'
          : 'Learner interaction is stable enough to support new course launches or premium content pushes.',
        actionLabel: engagementScore < 55 ? 'Generate new quiz' : 'Create new course',
        actionPath: engagementScore < 55 ? '/quizzes/new' : '/courses',
        tone: engagementScore < 55 ? 'warning' : 'positive',
      },
    ];

    return recommendations;
  }

  private buildAdminAiInsights({
    totals,
    userSeries,
    lessonSeries,
    questionSeries,
    quizSeries,
    attemptSeries,
    engagementScore,
  }: {
    totals: { users: number; courses: number; subjects: number; quizzes: number; questions: number; lessons: number };
    userSeries: Array<{ date: string; value: number }>;
    lessonSeries: Array<{ date: string; value: number }>;
    questionSeries: Array<{ date: string; value: number }>;
    quizSeries: Array<{ date: string; value: number }>;
    attemptSeries: Array<{ date: string; value: number }>;
    engagementScore: number;
  }) {
    const userTrend = this.calculateSeriesDelta(userSeries, 14);
    const contentTrend = this.calculateSeriesDelta(lessonSeries, 14);
    const assessmentTrend = this.calculateSeriesDelta(questionSeries, 14);
    const attemptTrend = this.calculateSeriesDelta(attemptSeries, 14);

    return [
      {
        id: 'users',
        label: 'Learner Growth',
        value: totals.users,
        delta: userTrend.delta,
        deltaLabel: userTrend.label,
        tone: userTrend.delta >= 0 ? 'positive' : 'warning',
        detail: userTrend.delta >= 0
          ? 'User growth is trending upward, likely supported by fresh learning inventory and active assessments.'
          : 'User growth has softened. Consider launching new course value or quiz campaigns.',
      },
      {
        id: 'content',
        label: 'Content Velocity',
        value: totals.lessons,
        delta: contentTrend.delta,
        deltaLabel: contentTrend.label,
        tone: contentTrend.delta >= 0 ? 'positive' : 'neutral',
        detail: contentTrend.delta >= 0
          ? 'Lesson output increased recently, which should improve learner return frequency.'
          : 'Lesson creation slowed in the latest period. AI-assisted content could accelerate the pipeline.',
      },
      {
        id: 'assessment',
        label: 'Assessment Supply',
        value: totals.questions,
        delta: assessmentTrend.delta,
        deltaLabel: assessmentTrend.label,
        tone: assessmentTrend.delta >= 0 ? 'positive' : 'warning',
        detail: assessmentTrend.delta >= 0
          ? 'Question growth is supporting more quizzes and richer practice sets.'
          : 'Question authoring is lagging. Use bulk add or AI quiz generation to close the gap.',
      },
      {
        id: 'engagement',
        label: 'Engagement Score',
        value: engagementScore,
        delta: attemptTrend.delta,
        deltaLabel: attemptTrend.label,
        tone: engagementScore >= 70 ? 'positive' : engagementScore >= 45 ? 'neutral' : 'warning',
        detail: engagementScore >= 70
          ? 'Recent attempt activity suggests a strong usage rhythm across the LMS.'
          : engagementScore >= 45
            ? 'Engagement is stable but still has room for a sharper content or quiz cadence.'
            : 'Platform engagement is low enough to justify proactive intervention this week.',
      },
      {
        id: 'forecast',
        label: '30-Day Forecast',
        value: totals.quizzes + Math.max(1, Math.round((quizSeries.slice(-30).reduce((sum, point) => sum + point.value, 0) / 30) * 12)),
        delta: this.calculateSeriesDelta(quizSeries, 30).delta,
        deltaLabel: 'Projected active quiz inventory',
        tone: 'neutral',
        detail: 'Projected quiz inventory assumes the current publishing pace continues for the next month.',
      },
    ];
  }

  private buildAdminActivityFeed(feedRows: ActivityFeedRow[]) {
    const typeMap: Record<string, { label: string; tone: string }> = {
      user: { label: 'New user', tone: 'blue' },
      course: { label: 'Course update', tone: 'violet' },
      lesson: { label: 'Lesson published', tone: 'teal' },
      attempt: { label: 'Quiz submission', tone: 'amber' },
    };

    return [...feedRows]
      .sort((left, right) => String(right.created_at || '').localeCompare(String(left.created_at || '')))
      .slice(0, 12)
      .map((row) => ({
        id: `${row.item_type}-${row.item_id}`,
        type: row.item_type,
        typeLabel: typeMap[row.item_type]?.label || 'Activity',
        tone: typeMap[row.item_type]?.tone || 'blue',
        title: row.title || 'Untitled item',
        subtitle: row.subtitle || '',
        status: row.status || '',
        createdAt: row.created_at || null,
      }));
  }

  private calculateSeriesDelta(series: Array<{ date: string; value: number }>, windowSize: number) {
    const currentWindow = series.slice(-windowSize);
    const previousWindow = series.slice(-windowSize * 2, -windowSize);
    const currentTotal = currentWindow.reduce((sum, point) => sum + point.value, 0);
    const previousTotal = previousWindow.reduce((sum, point) => sum + point.value, 0);
    const delta = previousTotal > 0
      ? Math.round(((currentTotal - previousTotal) / previousTotal) * 100)
      : currentTotal > 0 ? 100 : 0;
    const label = delta > 0 ? `+${delta}% vs previous period` : `${delta}% vs previous period`;
    return { delta, label };
  }

  async getStudentDashboard(authorization?: string) {
    const student = await this.findActiveStudentByToken(this.extractToken(authorization));

    const [[summary]] = await this.db.execute<CountRow[]>(
      `SELECT
        (SELECT COUNT(*) FROM quizzes WHERE status = 'active') AS total_quizzes,
        (SELECT COUNT(*) FROM quiz_attempts WHERE user_id = ?) AS total_attempts,
        (SELECT AVG(percentage) FROM quiz_attempts WHERE user_id = ? AND status = 'submitted') AS average_percentage,
        (SELECT COUNT(*) FROM quiz_attempts WHERE user_id = ? AND pass_status = 'pass') AS total_passed,
        (SELECT COUNT(*) FROM smart_notes WHERE user_id = ?) AS total_smart_notes,
        (SELECT COUNT(*) FROM smart_notes WHERE user_id = ? AND (JSON_LENGTH(infographic_elements) > 0 OR representative_image_data IS NOT NULL)) AS generated_smart_notes`,
      [student.id, student.id, student.id, student.id, student.id]
    );

    const [recentAttempts] = await this.db.execute<RecentAttemptRow[]>(
      `SELECT
        qa.id,
        COALESCE(NULLIF(q.student_title, ''), q.quiz_title) AS quiz_title,
        c.course_title,
        t.topic_name,
        qa.score,
        qa.total_questions,
        qa.percentage,
        qa.pass_status,
        qa.submitted_at
      FROM quiz_attempts qa
      INNER JOIN quizzes q ON q.id = qa.quiz_id
      LEFT JOIN courses c ON c.id = q.course_id
      LEFT JOIN topics t ON t.id = q.topic_id
      WHERE qa.user_id = ?
      ORDER BY COALESCE(qa.submitted_at, qa.created_at) DESC, qa.id DESC
      LIMIT 5`,
      [student.id]
    );

    const [topicRows] = await this.db.execute<TopicInsightRow[]>(
      `SELECT
        t.topic_name,
        c.course_title,
        AVG(qa.percentage) AS average_percentage,
        COUNT(*) AS attempts_count
      FROM quiz_attempts qa
      INNER JOIN quizzes q ON q.id = qa.quiz_id
      LEFT JOIN topics t ON t.id = q.topic_id
      LEFT JOIN courses c ON c.id = q.course_id
      WHERE qa.user_id = ? AND qa.status = 'submitted'
      GROUP BY q.topic_id, t.topic_name, c.course_title
      HAVING attempts_count > 0
      ORDER BY average_percentage ASC, attempts_count DESC`,
      [student.id]
    );

    const [smartNotes] = await this.db.execute<SmartNoteInsightRow[]>(
      `SELECT
        id,
        title,
        updated_at,
        CASE
          WHEN (JSON_LENGTH(infographic_elements) > 0 OR representative_image_data IS NOT NULL) THEN 1
          ELSE 0
        END AS has_visual
      FROM smart_notes
      WHERE user_id = ?
      ORDER BY updated_at DESC, id DESC
      LIMIT 3`,
      [student.id]
    );

    const [attemptDays] = await this.db.execute<AttemptDayRow[]>(
      `SELECT DISTINCT DATE(COALESCE(submitted_at, created_at)) AS attempt_day
       FROM quiz_attempts
       WHERE user_id = ? AND status = 'submitted'
       ORDER BY attempt_day DESC`,
      [student.id]
    );

    const [todayQuizRows] = await this.db.execute<RowDataPacket[]>(
      `SELECT q.id, c.course_title, t.topic_name
       FROM quiz_attempts qa
       INNER JOIN quizzes q ON q.id = qa.quiz_id
       LEFT JOIN courses c ON c.id = q.course_id
       LEFT JOIN topics t ON t.id = q.topic_id
       WHERE qa.user_id = ?
         AND qa.status = 'submitted'
         AND DATE(COALESCE(qa.submitted_at, qa.created_at)) = CURDATE()
       ORDER BY COALESCE(qa.submitted_at, qa.created_at) DESC`,
      [student.id]
    );

    const [todayNoteRows] = await this.db.execute<NoteReviewRow[]>(
      `SELECT DISTINCT
         n.id,
         c.course_title,
         t.topic_name
       FROM study_activity_events e
       INNER JOIN ai_illustrated_notes n ON n.id = e.item_id
       LEFT JOIN courses c ON c.id = n.course_id
       LEFT JOIN topics t ON t.id = n.topic_id
       WHERE e.user_id = ?
         AND e.activity_type = 'ai_note_viewed'
         AND DATE(e.created_at) = CURDATE()
       ORDER BY n.id DESC`,
      [student.id]
    );

    const totalAttempts = Number(summary?.total_attempts || 0);
    const totalPassed = Number(summary?.total_passed || 0);
    const averagePercentage = Number(summary?.average_percentage || 0);
    const passRate = totalAttempts > 0 ? (totalPassed / totalAttempts) * 100 : 0;
    const quizDayStreak = this.calculateQuizDayStreak(attemptDays.map((row) => row.attempt_day));

    const insights = topicRows
      .filter((row) => row.topic_name)
      .map((row) => ({
        topicName: row.topic_name || 'General',
        courseTitle: row.course_title || 'General',
        averagePercentage: Number(row.average_percentage || 0),
        attemptsCount: Number(row.attempts_count || 0),
      }));

    const weakTopics = [...insights].sort((a, b) => a.averagePercentage - b.averagePercentage).slice(0, 3);
    const weakTopicKeys = new Set(weakTopics.map((topic) => this.getTopicKey(topic.courseTitle, topic.topicName)));
    const strongTopics = [...insights]
      .filter((topic) => !weakTopicKeys.has(this.getTopicKey(topic.courseTitle, topic.topicName)))
      .sort((a, b) => b.averagePercentage - a.averagePercentage)
      .slice(0, 3);
    const topicMastery = [...insights]
      .sort((a, b) => {
        const masteryRankDiff = this.getMasteryRank(this.classifyTopicMastery(a.averagePercentage, a.attemptsCount).mastery)
          - this.getMasteryRank(this.classifyTopicMastery(b.averagePercentage, b.attemptsCount).mastery);
        if (masteryRankDiff !== 0) {
          return masteryRankDiff;
        }
        if (a.averagePercentage !== b.averagePercentage) {
          return a.averagePercentage - b.averagePercentage;
        }
        return b.attemptsCount - a.attemptsCount;
      })
      .slice(0, 6)
      .map((topic) => ({
        ...topic,
        ...this.classifyTopicMastery(topic.averagePercentage, topic.attemptsCount),
      }));
    const focusTopic = weakTopics[0]?.topicName || 'Start your first quiz';
    const focusCourse = weakTopics[0]?.courseTitle || 'No course data yet';
    const weakestTopic = weakTopics[0] || null;
    const weakestTopicReviewedToday = Boolean(
      weakestTopic &&
        (
          todayQuizRows.some(
            (row) =>
              String(row.course_title || '').trim() === String(weakestTopic.courseTitle || '').trim() &&
              String(row.topic_name || '').trim() === String(weakestTopic.topicName || '').trim()
          ) ||
          todayNoteRows.some(
            (row) =>
              String(row.course_title || '').trim() === String(weakestTopic.courseTitle || '').trim() &&
              String(row.topic_name || '').trim() === String(weakestTopic.topicName || '').trim()
          )
        )
    );

    const dailyGoals = [
      {
        key: 'quiz_today',
        title: 'Complete 1 quiz today',
        description: 'Build momentum by submitting at least one quiz attempt.',
        completed: todayQuizRows.length >= 1,
        progressText: `${Math.min(todayQuizRows.length, 1)}/1 done`,
      },
      {
        key: 'note_today',
        title: 'Review 1 lesson today',
        description: 'Open one lesson and revise a concept intentionally.',
        completed: todayNoteRows.length >= 1,
        progressText: `${Math.min(todayNoteRows.length, 1)}/1 done`,
      },
      {
        key: 'weak_topic_today',
        title: weakestTopic ? `Revisit ${weakestTopic.topicName}` : 'Revisit a weak topic',
        description: weakestTopic
          ? `Focus on your weakest topic in ${weakestTopic.courseTitle}.`
          : 'Complete more quizzes to unlock weak-topic targeting.',
        completed: weakestTopic ? weakestTopicReviewedToday : false,
        progressText: weakestTopic ? `${weakestTopicReviewedToday ? 1 : 0}/1 done` : 'Locked',
      },
    ];
    const completedGoals = dailyGoals.filter((goal) => goal.completed).length;

    return {
      user: {
        id: student.id,
        fullName: student.full_name || '',
      },
      totalQuizzes: Number(summary?.total_quizzes || 0),
      totalAttempts,
      quizDayStreak,
      avgScore: Number(averagePercentage.toFixed(2)),
      totalPassed,
      passRate: Number(passRate.toFixed(2)),
      totalSmartNotes: Number(summary?.total_smart_notes || 0),
      generatedSmartNotes: Number(summary?.generated_smart_notes || 0),
      recentAttempts: recentAttempts.map((row) => ({
        id: row.id,
        quizTitle: row.quiz_title,
        courseTitle: row.course_title || '',
        topicName: row.topic_name || '',
        score: row.score,
        totalQuestions: row.total_questions,
        percentage: Number(row.percentage || 0),
        passStatus: row.pass_status,
        submittedAt: row.submitted_at,
      })),
      recentSmartNotes: smartNotes.map((row) => ({
        id: row.id,
        title: row.title,
        updatedAt: row.updated_at,
        hasVisual: Boolean(row.has_visual),
      })),
      topicMastery,
      weakTopics,
      strongTopics,
      dailyGoals,
      dailyGoalsCompleted: completedGoals,
      focusTopic,
      focusCourse,
      progressTone: averagePercentage >= 70 ? 'steady' : averagePercentage >= 50 ? 'building' : 'needs-attention',
      progressNote:
        totalAttempts === 0
          ? 'No submitted quizzes yet. Start with one short quiz to build your baseline.'
          : averagePercentage >= 70
            ? 'You are moving well. Keep revising your weakest subject to stay consistent.'
            : averagePercentage >= 50
              ? 'You are building momentum. Focus on one weak topic and one recent review each day.'
              : 'Your recent scores need support. Revisit lessons first, then use practice mode before full exams.',
    };
  }

  async recordStudentActivity(authorization: string | undefined, dto: RecordStudyActivityDto) {
    const student = await this.findActiveStudentByToken(this.extractToken(authorization));

    await this.db.execute(
      'INSERT INTO study_activity_events (user_id, activity_type, item_id) VALUES (?, ?, ?)',
      [student.id, dto.activityType, dto.itemId ?? null]
    );

    return { ok: true };
  }

  private extractToken(authorization?: string) {
    const token = extractBearerToken(authorization);

    if (!token) {
      throw new UnauthorizedException('Authentication token is missing');
    }

    return token;
  }

  private async findActiveStudentByToken(sessionToken: string) {
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

  private calculateQuizDayStreak(days: Array<string | Date>) {
    if (!days.length) {
      return 0;
    }

    const normalizedDays = [
      ...new Set(
        days
          .filter(Boolean)
          .map((day) => this.normalizeDateKey(day))
          .filter(Boolean)
      ),
    ].sort((a, b) => b.localeCompare(a));

    if (!normalizedDays.length) {
      return 0;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const latestAttemptDay = new Date(`${normalizedDays[0]}T00:00:00`);
    latestAttemptDay.setHours(0, 0, 0, 0);

    const msPerDay = 24 * 60 * 60 * 1000;
    const gapFromToday = Math.floor((today.getTime() - latestAttemptDay.getTime()) / msPerDay);

    if (gapFromToday > 1) {
      return 0;
    }

    let streak = 1;
    let previousDay = latestAttemptDay;

    for (let index = 1; index < normalizedDays.length; index += 1) {
      const currentDay = new Date(`${normalizedDays[index]}T00:00:00`);
      currentDay.setHours(0, 0, 0, 0);
      const diff = Math.floor((previousDay.getTime() - currentDay.getTime()) / msPerDay);

      if (diff === 1) {
        streak += 1;
        previousDay = currentDay;
        continue;
      }

      break;
    }

    return streak;
  }

  private normalizeDateKey(day: string | Date) {
    if (day instanceof Date) {
      return day.toISOString().slice(0, 10);
    }

    return String(day).slice(0, 10);
  }

  private classifyTopicMastery(averagePercentage: number, attemptsCount: number): Omit<TopicMastery, 'topicName' | 'courseTitle' | 'averagePercentage' | 'attemptsCount'> {
    if (attemptsCount >= 3 && averagePercentage >= 75) {
      return {
        mastery: 'strong',
        masteryLabel: 'Strong',
        masteryNote: 'Reliable scores across repeated attempts.',
      };
    }

    if (averagePercentage >= 50 || attemptsCount >= 2) {
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
