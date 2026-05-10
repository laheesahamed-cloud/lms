import { Body, Controller, Delete, Get, Headers, Param, ParseIntPipe, Patch, Post, Put } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
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
  async getAdminMeta(@Headers('authorization') authorization?: string) {
    await this.authService.requireAdmin(authorization);
    return this.subscriptionsService.getAdminMeta();
  }

  @Get()
  async defaultList(@Headers('authorization') authorization?: string) {
    const user = await this.authService.requireAuthenticatedUser(authorization);
    if (user.role === 'admin') {
      return this.subscriptionsService.findAdminList();
    }
    return this.subscriptionsService.getStudentBilling(user.id);
  }

  @Get('admin')
  async findAdminList(@Headers('authorization') authorization?: string) {
    await this.authService.requireAdmin(authorization);
    return this.subscriptionsService.findAdminList();
  }

  @Get('admin/requests')
  async findAdminRequests(@Headers('authorization') authorization?: string) {
    await this.authService.requireAdmin(authorization);
    return this.subscriptionsService.findAdminRequests();
  }

  @Get('admin/audit')
  async findAuditEvents(@Headers('authorization') authorization?: string) {
    await this.authService.requireAdmin(authorization);
    return this.subscriptionsService.findAuditEvents();
  }

  @Get('admin/coupons')
  async findCoupons(@Headers('authorization') authorization?: string) {
    await this.authService.requireAdmin(authorization);
    return this.subscriptionsService.findCoupons();
  }

  @Get('admin/invoices/:invoiceId')
  async findInvoice(
    @Headers('authorization') authorization: string | undefined,
    @Param('invoiceId') invoiceId: string
  ) {
    await this.authService.requireAdmin(authorization);
    return this.subscriptionsService.findInvoice(invoiceId);
  }

  @Post('admin/coupons')
  async createCoupon(@Headers('authorization') authorization: string | undefined, @Body() dto: SubscriptionCouponDto) {
    const admin = await this.authService.requireAdmin(authorization);
    return this.subscriptionsService.createCoupon(dto, admin.id);
  }

  @Put('admin/coupons/:id')
  async updateCoupon(
    @Headers('authorization') authorization: string | undefined,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SubscriptionCouponDto
  ) {
    const admin = await this.authService.requireAdmin(authorization);
    return this.subscriptionsService.updateCoupon(id, dto, admin.id);
  }

  @Delete('admin/coupons/:id')
  async deleteCoupon(
    @Headers('authorization') authorization: string | undefined,
    @Param('id', ParseIntPipe) id: number
  ) {
    const admin = await this.authService.requireAdmin(authorization);
    return this.subscriptionsService.deleteCoupon(id, admin.id);
  }

  @Post('assign')
  async assign(@Headers('authorization') authorization: string | undefined, @Body() dto: AssignSubscriptionDto) {
    const admin = await this.authService.requireAdmin(authorization);
    return this.subscriptionsService.assign(dto, admin.id);
  }

  @Post('request')
  async requestUpgrade(@Headers('authorization') authorization: string | undefined, @Body() dto: RequestSubscriptionDto) {
    const student = await this.authService.requireStudent(authorization);
    return this.subscriptionsService.requestUpgrade(student.id, dto.planId, dto.message);
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
  async resolveRequest(
    @Headers('authorization') authorization: string | undefined,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResolveSubscriptionRequestDto
  ) {
    const admin = await this.authService.requireAdmin(authorization);
    return this.subscriptionsService.resolveRequest(id, dto.status, dto.adminNote, admin.id);
  }

  @Patch(':id/extend')
  async extend(
    @Headers('authorization') authorization: string | undefined,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ExtendSubscriptionDto
  ) {
    const admin = await this.authService.requireAdmin(authorization);
    return this.subscriptionsService.extendSubscription(id, dto.days, dto.notes, admin.id);
  }

  @Patch(':id/renew')
  async renew(
    @Headers('authorization') authorization: string | undefined,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RenewSubscriptionDto
  ) {
    const admin = await this.authService.requireAdmin(authorization);
    return this.subscriptionsService.renewSubscription(id, dto, admin.id);
  }

  @Patch(':id/cancel')
  async cancel(
    @Headers('authorization') authorization: string | undefined,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelSubscriptionDto
  ) {
    const admin = await this.authService.requireAdmin(authorization);
    return this.subscriptionsService.cancelSubscription(id, dto.notes, admin.id);
  }

  @Patch(':id/payment')
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
