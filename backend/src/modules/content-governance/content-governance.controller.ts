import { Controller, Get, Headers, Query, Res, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { AuthService } from '../auth/auth.service';
import { RequirePermissions } from '../auth/permissions.decorator';
import { ContentGovernanceService } from './content-governance.service';

@Controller('content-governance')
@UseGuards(AdminGuard)
@RequirePermissions('content.review')
export class ContentGovernanceController {
  constructor(
    private readonly contentGovernanceService: ContentGovernanceService,
    private readonly authService: AuthService,
  ) {}

  @Get('evidence/export')
  async exportEvidence(
    @Headers('authorization') authorization: string | undefined,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('workflowState') workflowState?: string,
    @Res() response?: any,
  ) {
    const actor = await this.authService.requireAdmin(authorization);
    const csv = await this.contentGovernanceService.exportEvidence({
      entityType,
      entityId: entityId ? Number(entityId) : undefined,
      workflowState,
      actorId: actor.id,
    });
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename="content-governance-evidence-${Date.now()}.csv"`);
    response.send(csv);
  }

  @Get('evidence')
  async listEvidence(
    @Headers('authorization') authorization: string | undefined,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('workflowState') workflowState?: string,
  ) {
    const actor = await this.authService.requireAdmin(authorization);
    return this.contentGovernanceService.listEvidence({
      entityType,
      entityId: entityId ? Number(entityId) : undefined,
      workflowState,
      actorId: actor.id,
    });
  }
}
