import { Injectable } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { LessonsService } from '../lessons/lessons.service';
import { DashboardService } from '../dashboard/dashboard.service';
import { QuizAttemptsService } from '../quiz-attempts/quiz-attempts.service';
import { StudyBookmarksService } from '../study-bookmarks/study-bookmarks.service';
import { WorkspaceService } from '../workspace/workspace.service';

function bearerToken(authorization: string | undefined) {
  return authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
}

@Injectable()
export class BootService {
  constructor(
    private readonly authService: AuthService,
    private readonly dashboardService: DashboardService,
    private readonly workspaceService: WorkspaceService,
    private readonly quizAttemptsService: QuizAttemptsService,
    private readonly studyBookmarksService: StudyBookmarksService,
    private readonly lessonsService: LessonsService
  ) {}

  async getStudentBoot(authorization: string | undefined, engineKey?: string) {
    const student = await this.authService.requireStudent(authorization);
    const engine = this.lessonsService.normalizeEngineKey(engineKey);

    const [dashboard, notifications, agenda, quizzes, bookmarks, aiNotes] = await Promise.allSettled([
      this.dashboardService.getStudentDashboard(authorization),
      this.workspaceService.listNotifications(authorization),
      this.workspaceService.getPlannerAgenda(authorization),
      this.quizAttemptsService.listQuizzes(authorization),
      this.studyBookmarksService.list(student.id),
      this.lessonsService.canvasStudentList(bearerToken(authorization), engine),
    ]).then((results) => results.map((r) => (r.status === 'fulfilled' ? r.value : null)));

    return { dashboard, notifications, agenda, quizzes, bookmarks, aiNotes, aiNotesEngine: engine };
  }
}
