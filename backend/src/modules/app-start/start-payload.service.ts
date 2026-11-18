import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'mysql2/promise';
import { DATABASE_CONNECTION } from '../../database/database.tokens';
import { getContentVersion } from '../../common/utils/content-version';
import { DashboardService } from '../dashboard/dashboard.service';
import { NoticesService } from '../notices/notices.service';
import { ProgressOptions, StudentCatalogueService } from '../courses/student-catalogue.service';
import { StudyStatsService } from '../study-stats/study-stats.service';
import { QuizAttemptsService } from '../quiz-attempts/quiz-attempts.service';
import { FlashcardsService } from '../flashcards/flashcards.service';
import { summaryRowFromRequest } from '../../common/auth/subscription-scope';
import { applyProgress, rideAlongPending } from '../../common/utils/progress-write';
import { localDateKey } from '../xp/streak';

/** Token the auth controller resolves this by (no module import cycle). */
export const START_PAYLOAD = 'START_PAYLOAD';

/**
 * What the app's first screen needs, shared by the cold-open start-up request
 * and a fresh sign-in (OPTIMIZE 10 step 5): catalogue version, Study Hub top,
 * notices newer than the phone's last one, active announcements. With it a
 * sign-in is ONE request (it was sign-in + token + notices + Study Hub).
 */
@Injectable()
export class StartPayloadService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Pool,
    private readonly dashboardService: DashboardService,
    private readonly notices: NoticesService,
    private readonly catalogue: StudentCatalogueService,
    private readonly studyStats: StudyStatsService,
    private readonly quizAttempts: QuizAttemptsService,
    private readonly flashcards: FlashcardsService,
  ) {}

  async build(role: string, accessToken: string, lastNoticeId = 0, userId = 0, progressOpts: ProgressOptions = {}, withCourses = false) {
    const student = role === 'student';
    // 10.30: a day-done mark (or practices) riding along with the start-up is
    // applied BEFORE the row is read, so this reply already shows the new
    // streak — the same one statement the ride-along step would run after.
    if (student && userId && rideAlongPending()) await applyProgress(this.db, userId, localDateKey(new Date()));
    const dashboard = student ? await this.dashboardService.getStudentHubTop(`Bearer ${accessToken}`, true) : null;
    return {
      contentVersion: await getContentVersion(this.db),
      // The phone AND the website (10.49) build course progress from the
      // catalogue and progress they keep, so the lite Study Hub top only.
      dashboard,
      // The website's results list (10.22), from the summary row already read.
      ...(student && withCourses
        ? { results: await this.quizAttempts.resultsFromRecent(userId, summaryRowFromRequest(userId)?.recent_results).catch(() => []) }
        : {}),
      // The student's own progress (by user id) — no separate request after.
      progress: student && userId ? await this.catalogue.progressFor(userId, this.studyStats, progressOpts) : null,
      // 10.23 F6/F7: import old flashcard history only when there is some, and
      // the scheduling settings (server memory) — no separate requests.
      ...(student && userId ? {
        flashHistory: Number(summaryRowFromRequest(userId)?.flash_history || 0) === 1,
        flashSettings: await this.flashcards.getSettings().catch(() => null),
      } : {}),
      notices: this.notices.noticesFor(role, Math.max(0, Number(lastNoticeId) || 0)),
      popups: this.notices.popupsFor(role),
    };
  }
}
