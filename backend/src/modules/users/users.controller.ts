import { Body, Controller, Delete, Get, Headers, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { AuthService } from '../auth/auth.service';
import { RequirePermissions } from '../auth/permissions.decorator';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';

@Controller('users')
@UseGuards(AdminGuard)
@RequirePermissions('students.manage')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  async findAll(
    @Headers('authorization') authorization?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('role') role?: string,
  ) {
    const actor = await this.authService.requireAdmin(authorization);
    return this.usersService.findAll(actor, { search, status, role });
  }

  @Get('summary')
  async summary(@Headers('authorization') authorization?: string) {
    const actor = await this.authService.requireAdmin(authorization);
    return this.usersService.summary(actor);
  }

  @Get(':id/detail')
  async detail(@Headers('authorization') authorization: string | undefined, @Param('id', ParseIntPipe) id: number) {
    const actor = await this.authService.requireAdmin(authorization);
    return this.usersService.detail(actor, id);
  }

  @Post()
  async create(@Headers('authorization') authorization: string | undefined, @Body() createUserDto: CreateUserDto) {
    const actor = await this.authService.requireAdmin(authorization);
    return this.usersService.create(actor, createUserDto);
  }

  @Patch(':id')
  async update(
    @Headers('authorization') authorization: string | undefined,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    const actor = await this.authService.requireAdmin(authorization);
    return this.usersService.update(actor, id, updateUserDto);
  }

  @Patch(':id/status')
  async updateStatus(
    @Headers('authorization') authorization: string | undefined,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserStatusDto: UpdateUserStatusDto,
  ) {
    const actor = await this.authService.requireAdmin(authorization);
    return this.usersService.updateStatus(actor, id, updateUserStatusDto);
  }

  @Delete(':id')
  async delete(@Headers('authorization') authorization: string | undefined, @Param('id', ParseIntPipe) id: number) {
    const actor = await this.authService.requireAdmin(authorization);
    return this.usersService.delete(actor, id);
  }
}
