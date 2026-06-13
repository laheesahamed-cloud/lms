import { Injectable } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { AiNotesService } from '../ai-notes/ai-notes.service';
import { DashboardService } from '../dashboard/dashboard.service';
import { QuizAttemptsService } from '../quiz-attempts/quiz-attempts.service';
import { StudyBookmarksService } from '../study-bookmarks/study-bookmarks.service';
import { WorkspaceService } from '../workspace/workspace.service';

function bearerToken(authorization: string | undefined) {
  return authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
}

/**
 * Composes the six read-only payloads every student session fetches at boot
 * (R3 Task 26). Each slice goes through the EXACT same service entry point —
 * and therefore the same auth/entitlement boundary — as its standalone
 * endpoint; this controller adds no new data access. A failed slice comes
 * back as null and the client falls back to the standalone endpoint, so a
 * partial outage degrades to exactly the old behavior.
 */
@Injectable()
export class BootService {
  constructor(
    private readonly authService: AuthService,
    private readonly dashboardService: DashboardService,
    private readonly workspaceService: WorkspaceService,
    private readonly quizAttemptsService: QuizAttemptsService,
    private readonly studyBookmarksService: StudyBookmarksService,
    private readonly aiNotesService: AiNotesService
  ) {}

  async getStudentBoot(authorization: string | undefined, engineKey?: string) {
    // Validate the session once up front so an unauthenticated call fails
    // with the same 401 the standalone endpoints produce (and we have the
    // student id for the services that take an id instead of a header).
    const student = await this.authService.requireStudent(authorization);
    const engine = this.aiNotesService.normalizeEngineKey(engineKey);

    const [dashboard, notifications, agenda, quizzes, bookmarks, aiNotes] = await Promise.allSettled([
      this.dashboardService.getStudentDashboard(authorization),
      this.workspaceService.listNotifications(authorization),
      this.workspaceService.getPlannerAgenda(authorization),
      this.quizAttemptsService.listQuizzes(authorization),
      this.studyBookmarksService.list(student.id),
      this.aiNotesService.studentList(bearerToken(authorization), engine),
    ]).then((results) => results.map((r) => (r.status === 'fulfilled' ? r.value : null)));

    return { dashboard, notifications, agenda, quizzes, bookmarks, aiNotes, aiNotesEngine: engine };
  }
}
