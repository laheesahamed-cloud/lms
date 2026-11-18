import { Injectable } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { LessonsService } from '../lessons/lessons.service';
import { DashboardService } from '../dashboard/dashboard.service';
import { WorkspaceService } from '../workspace/workspace.service';

@Injectable()
export class BootService {
  constructor(
    private readonly authService: AuthService,
    private readonly dashboardService: DashboardService,
    private readonly workspaceService: WorkspaceService,
    private readonly lessonsService: LessonsService
  ) {}

  async getStudentBoot(authorization: string | undefined, engineKey?: string) {
    await this.authService.requireStudent(authorization);
    const engine = this.lessonsService.normalizeEngineKey(engineKey);

    // 10.21: the quiz and lesson lists left the start-up batch — the website
    // lists free samples from files (no database work), premium is in the app.
    // 10.44: bookmarks are kept on the device (since 10.25), not sent here.
    const [dashboard, notifications, agenda] = await Promise.allSettled([
      this.dashboardService.getStudentDashboard(authorization),
      this.workspaceService.listNotifications(authorization),
      this.workspaceService.getPlannerAgenda(authorization),
    ]).then((results) => results.map((r) => (r.status === 'fulfilled' ? r.value : null)));

    return { dashboard, notifications, agenda, aiNotesEngine: engine };
  }
}
