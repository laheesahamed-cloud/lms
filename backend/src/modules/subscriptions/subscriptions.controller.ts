import { Body, Controller, Delete, ForbiddenException, Get, Headers, Param, ParseIntPipe, Patch, Post, Put, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { RequirePermissions } from '../auth/permissions.decorator';
import { isStaffRole, roleHasPermission } from '../auth/role-permissions';
import { AssignSubscriptionDto } from './dto/assign-subscription.dto';
import { ManualPaymentRequestDto } from './dto/manual-payment-request.dto';
import { RequestSubscriptionDto } from './dto/request-subscription.dto';
import { ResolveSubscriptionRequestDto } from './dto/resolve-subscription-request.dto';
import { CancelSubscriptionDto, ExtendSubscriptionDto, RenewSubscriptionDto, UpdateSubscriptionPaymentDto } from './dto/subscription-action.dto';
import { SubscriptionCouponDto } from './dto/subscription-coupon.dto';
import { SubscriptionsService } from './subscriptions.service';

@Controller(['subscriptions', 'subscritions'])
export class SubscriptionsController {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly authService: AuthService
  ) {}

  @Get('admin/meta')
  @RequirePermissions('subscriptions.manage')
  async getAdminMeta(@Headers('authorization') authorization?: string) {
    await this.authService.requireAdmin(authorization);
    return this.subscriptionsService.getAdminMeta();
  }

  @Get()
  async defaultList(@Headers('authorization') authorization?: string) {
    const user = await this.authService.requireAuthenticatedUser(authorization);
    if (isStaffRole(user.role)) {
      if (user.status !== 'active') {
        throw new UnauthorizedException('Admin access is required');
      }
      if (!roleHasPermission(user.role, 'subscriptions.manage')) {
        throw new ForbiddenException('Your role does not have permission for this action');
      }
      return this.subscriptionsService.findAdminList();
    }
    return this.subscriptionsService.getStudentBilling(user.id);
  }

  @Get('admin')
  @RequirePermissions('subscriptions.manage')
  async findAdminList(@Headers('authorization') authorization?: string) {
    await this.authService.requireAdmin(authorization);
    return this.subscriptionsService.findAdminList();
  }

  @Get('admin/requests')
  @RequirePermissions('subscriptions.manage')
  async findAdminRequests(@Headers('authorization') authorization?: string) {
    await this.authService.requireAdmin(authorization);
    return this.subscriptionsService.findAdminRequests();
  }

  @Get('admin/audit')
  @RequirePermissions('subscriptions.manage')
  async findAuditEvents(@Headers('authorization') authorization?: string) {
    await this.authService.requireAdmin(authorization);
    return this.subscriptionsService.findAuditEvents();
  }

  @Get('admin/coupons')
  @RequirePermissions('subscriptions.manage')
  async findCoupons(@Headers('authorization') authorization?: string) {
    await this.authService.requireAdmin(authorization);
    return this.subscriptionsService.findCoupons();
  }

  @Get('admin/invoices/:invoiceId')
  @RequirePermissions('subscriptions.manage')
  async findInvoice(
    @Headers('authorization') authorization: string | undefined,
    @Param('invoiceId') invoiceId: string
  ) {
    await this.authService.requireAdmin(authorization);
    return this.subscriptionsService.findInvoice(invoiceId);
  }

  @Post('admin/coupons')
  @RequirePermissions('subscriptions.manage')
  async createCoupon(@Headers('authorization') authorization: string | undefined, @Body() dto: SubscriptionCouponDto) {
    const admin = await this.authService.requireAdmin(authorization);
    return this.subscriptionsService.createCoupon(dto, admin.id);
  }

  @Put('admin/coupons/:id')
  @RequirePermissions('subscriptions.manage')
  async updateCoupon(
    @Headers('authorization') authorization: string | undefined,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SubscriptionCouponDto
  ) {
    const admin = await this.authService.requireAdmin(authorization);
    return this.subscriptionsService.updateCoupon(id, dto, admin.id);
  }

  @Delete('admin/coupons/:id')
  @RequirePermissions('subscriptions.manage')
  async deleteCoupon(
    @Headers('authorization') authorization: string | undefined,
    @Param('id', ParseIntPipe) id: number
  ) {
    const admin = await this.authService.requireAdmin(authorization);
    return this.subscriptionsService.deleteCoupon(id, admin.id);
  }

  @Post('assign')
  @RequirePermissions('subscriptions.manage')
  async assign(@Headers('authorization') authorization: string | undefined, @Body() dto: AssignSubscriptionDto) {
    const admin = await this.authService.requireAdmin(authorization);
    return this.subscriptionsService.assign(dto, admin.id);
  }

  @Post('request')
  async requestUpgrade(@Headers('authorization') authorization: string | undefined, @Body() dto: RequestSubscriptionDto) {
    const student = await this.authService.requireStudent(authorization);
    return this.subscriptionsService.requestUpgrade(student.id, dto);
  }

  @Post('payhere/initiate')
  async initiatePayHereCheckout(@Headers('authorization') authorization: string | undefined, @Body() dto: RequestSubscriptionDto) {
    const student = await this.authService.requireStudent(authorization);
    return this.subscriptionsService.initiatePayHereCheckout(student.id, dto.planId, dto);
  }

  @Post('manual-payment/request')
  async requestManualPayment(@Headers('authorization') authorization: string | undefined, @Body() dto: ManualPaymentRequestDto) {
    const student = await this.authService.requireStudent(authorization);
    return this.subscriptionsService.requestManualPayment(student.id, dto);
  }

  @Post('payhere/notify')
  async handlePayHereNotify(@Body() body: Record<string, string | undefined>) {
    return this.subscriptionsService.handlePayHereNotification(body);
  }

  @Patch('requests/:id/resolve')
  @RequirePermissions('subscriptions.manage')
  async resolveRequest(
    @Headers('authorization') authorization: string | undefined,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResolveSubscriptionRequestDto
  ) {
    const admin = await this.authService.requireAdmin(authorization);
    return this.subscriptionsService.resolveRequest(id, dto.status, dto.adminNote, admin.id);
  }

  @Patch(':id/extend')
  @RequirePermissions('subscriptions.manage')
  async extend(
    @Headers('authorization') authorization: string | undefined,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ExtendSubscriptionDto
  ) {
    const admin = await this.authService.requireAdmin(authorization);
    return this.subscriptionsService.extendSubscription(id, dto.days, dto.notes, admin.id);
  }

  @Patch(':id/renew')
  @RequirePermissions('subscriptions.manage')
  async renew(
    @Headers('authorization') authorization: string | undefined,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RenewSubscriptionDto
  ) {
    const admin = await this.authService.requireAdmin(authorization);
    return this.subscriptionsService.renewSubscription(id, dto, admin.id);
  }

  @Patch(':id/cancel')
  @RequirePermissions('subscriptions.manage')
  async cancel(
    @Headers('authorization') authorization: string | undefined,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelSubscriptionDto
  ) {
    const admin = await this.authService.requireAdmin(authorization);
    return this.subscriptionsService.cancelSubscription(id, dto.notes, admin.id);
  }

  @Patch(':id/payment')
  @RequirePermissions('subscriptions.manage')
  async updatePayment(
    @Headers('authorization') authorization: string | undefined,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSubscriptionPaymentDto
  ) {
    const admin = await this.authService.requireAdmin(authorization);
    return this.subscriptionsService.updatePayment(id, dto, admin.id);
  }

  @Get('me')
  async getMine(@Headers('authorization') authorization?: string) {
    const student = await this.authService.requireStudent(authorization);
    return this.subscriptionsService.getStudentBilling(student.id);
  }
}
