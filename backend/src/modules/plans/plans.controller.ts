import { Body, Controller, Delete, Get, Headers, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { RequirePermissions } from '../auth/permissions.decorator';
import { CreatePlanDto } from './dto/create-plan.dto';
import { CreateSubscriptionFeatureDto } from './dto/create-subscription-feature.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { UpdateSubscriptionFeatureDto } from './dto/update-subscription-feature.dto';
import { PlansService } from './plans.service';

@Controller('plans')
export class PlansController {
  constructor(
    private readonly plansService: PlansService,
    private readonly authService: AuthService
  ) {}

  @Get()
  findActive() {
    return this.plansService.findActive();
  }

  @Get('admin')
  @RequirePermissions('plans.manage')
  async findAdminAll(@Headers('authorization') authorization?: string) {
    await this.authService.requireAdmin(authorization);
    return this.plansService.findAll();
  }

  @Get('features')
  @RequirePermissions('plans.manage')
  async featureCatalog(@Headers('authorization') authorization?: string) {
    await this.authService.requireAdmin(authorization);
    return this.plansService.getFeatureCatalog();
  }

  @Post()
  @RequirePermissions('plans.manage')
  async create(@Headers('authorization') authorization: string | undefined, @Body() dto: CreatePlanDto) {
    await this.authService.requireAdmin(authorization);
    return this.plansService.create(dto);
  }

  @Post('features')
  @RequirePermissions('plans.manage')
  async createFeature(@Headers('authorization') authorization: string | undefined, @Body() dto: CreateSubscriptionFeatureDto) {
    await this.authService.requireAdmin(authorization);
    return this.plansService.createFeature(dto);
  }

  @Patch(':id')
  @RequirePermissions('plans.manage')
  async update(
    @Headers('authorization') authorization: string | undefined,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePlanDto
  ) {
    await this.authService.requireAdmin(authorization);
    return this.plansService.update(id, dto);
  }

  @Patch('features/:id')
  @RequirePermissions('plans.manage')
  async updateFeature(
    @Headers('authorization') authorization: string | undefined,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSubscriptionFeatureDto
  ) {
    await this.authService.requireAdmin(authorization);
    return this.plansService.updateFeature(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('plans.manage')
  async remove(@Headers('authorization') authorization: string | undefined, @Param('id', ParseIntPipe) id: number) {
    await this.authService.requireAdmin(authorization);
    return this.plansService.remove(id);
  }
}
