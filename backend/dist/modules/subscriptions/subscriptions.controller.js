"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionsController = void 0;
const common_1 = require("@nestjs/common");
const auth_service_1 = require("../auth/auth.service");
const permissions_decorator_1 = require("../auth/permissions.decorator");
const role_permissions_1 = require("../auth/role-permissions");
const assign_subscription_dto_1 = require("./dto/assign-subscription.dto");
const manual_payment_request_dto_1 = require("./dto/manual-payment-request.dto");
const request_subscription_dto_1 = require("./dto/request-subscription.dto");
const resolve_subscription_request_dto_1 = require("./dto/resolve-subscription-request.dto");
const subscription_action_dto_1 = require("./dto/subscription-action.dto");
const subscription_coupon_dto_1 = require("./dto/subscription-coupon.dto");
const subscriptions_service_1 = require("./subscriptions.service");
let SubscriptionsController = class SubscriptionsController {
    constructor(subscriptionsService, authService) {
        this.subscriptionsService = subscriptionsService;
        this.authService = authService;
    }
    async getAdminMeta(authorization) {
        await this.authService.requireAdmin(authorization);
        return this.subscriptionsService.getAdminMeta();
    }
    async defaultList(authorization, limit, page, offset) {
        const user = await this.authService.requireAuthenticatedUser(authorization);
        if ((0, role_permissions_1.isStaffRole)(user.role)) {
            if (user.status !== 'active') {
                throw new common_1.UnauthorizedException('Admin access is required');
            }
            if (!(0, role_permissions_1.roleHasPermission)(user.role, 'subscriptions.manage')) {
                throw new common_1.ForbiddenException('Your role does not have permission for this action');
            }
            return this.subscriptionsService.findAdminList({
                limit: this.parsePositiveNumber(limit),
                page: this.parsePositiveNumber(page),
                offset: this.parseNonNegativeNumber(offset),
            });
        }
        return this.subscriptionsService.getStudentBilling(user.id);
    }
    async findAdminList(authorization, limit, page, offset) {
        await this.authService.requireAdmin(authorization);
        return this.subscriptionsService.findAdminList({
            limit: this.parsePositiveNumber(limit),
            page: this.parsePositiveNumber(page),
            offset: this.parseNonNegativeNumber(offset),
        });
    }
    async findAdminRequests(authorization) {
        await this.authService.requireAdmin(authorization);
        return this.subscriptionsService.findAdminRequests();
    }
    async findAuditEvents(authorization) {
        await this.authService.requireAdmin(authorization);
        return this.subscriptionsService.findAuditEvents();
    }
    async findCoupons(authorization) {
        await this.authService.requireAdmin(authorization);
        return this.subscriptionsService.findCoupons();
    }
    async findInvoice(authorization, invoiceId) {
        await this.authService.requireAdmin(authorization);
        return this.subscriptionsService.findInvoice(invoiceId);
    }
    async downloadPaymentProof(authorization, invoiceId, response) {
        await this.authService.requireAdmin(authorization);
        const proof = await this.subscriptionsService.getPaymentProofFile(invoiceId);
        const safeFileName = String(proof.fileName || 'payment-proof').replace(/["\r\n]+/g, '_');
        response.setHeader('Content-Type', proof.mimeType || 'application/octet-stream');
        response.setHeader('Content-Disposition', `inline; filename="${safeFileName}"`);
        response.setHeader('Cache-Control', 'private, max-age=60');
        response.send(proof.buffer);
    }
    async createCoupon(authorization, dto) {
        const admin = await this.authService.requireAdmin(authorization);
        return this.subscriptionsService.createCoupon(dto, admin.id);
    }
    async updateCoupon(authorization, id, dto) {
        const admin = await this.authService.requireAdmin(authorization);
        return this.subscriptionsService.updateCoupon(id, dto, admin.id);
    }
    async deleteCoupon(authorization, id) {
        const admin = await this.authService.requireAdmin(authorization);
        return this.subscriptionsService.deleteCoupon(id, admin.id);
    }
    async assign(authorization, dto) {
        const admin = await this.authService.requireAdmin(authorization);
        return this.subscriptionsService.assign(dto, admin.id);
    }
    async requestUpgrade(authorization, dto) {
        const student = await this.authService.requireStudent(authorization);
        return this.subscriptionsService.requestUpgrade(student.id, dto);
    }
    async initiatePayHereCheckout(authorization, dto) {
        const student = await this.authService.requireStudent(authorization);
        return this.subscriptionsService.initiatePayHereCheckout(student.id, dto.planId, dto);
    }
    async requestManualPayment(authorization, dto) {
        const student = await this.authService.requireStudent(authorization);
        return this.subscriptionsService.requestManualPayment(student.id, dto);
    }
    async handlePayHereNotify(body) {
        return this.subscriptionsService.handlePayHereNotification(body);
    }
    async resolveRequest(authorization, id, dto) {
        const admin = await this.authService.requireAdmin(authorization);
        return this.subscriptionsService.resolveRequest(id, dto.status, dto.adminNote, admin.id);
    }
    async extend(authorization, id, dto) {
        const admin = await this.authService.requireAdmin(authorization);
        return this.subscriptionsService.extendSubscription(id, dto.days, dto.notes, admin.id);
    }
    async renew(authorization, id, dto) {
        const admin = await this.authService.requireAdmin(authorization);
        return this.subscriptionsService.renewSubscription(id, dto, admin.id);
    }
    async cancel(authorization, id, dto) {
        const admin = await this.authService.requireAdmin(authorization);
        return this.subscriptionsService.cancelSubscription(id, dto.notes, admin.id);
    }
    async updatePayment(authorization, id, dto) {
        const admin = await this.authService.requireAdmin(authorization);
        return this.subscriptionsService.updatePayment(id, dto, admin.id);
    }
    async getMine(authorization) {
        const student = await this.authService.requireStudent(authorization);
        return this.subscriptionsService.getStudentBilling(student.id);
    }
    parsePositiveNumber(raw) {
        const value = Number(raw);
        if (!Number.isFinite(value) || value <= 0) {
            return undefined;
        }
        return Math.trunc(value);
    }
    parseNonNegativeNumber(raw) {
        const value = Number(raw);
        if (!Number.isFinite(value) || value < 0) {
            return undefined;
        }
        return Math.trunc(value);
    }
};
exports.SubscriptionsController = SubscriptionsController;
__decorate([
    (0, common_1.Get)('admin/meta'),
    (0, permissions_decorator_1.RequirePermissions)('subscriptions.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SubscriptionsController.prototype, "getAdminMeta", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('page')),
    __param(3, (0, common_1.Query)('offset')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], SubscriptionsController.prototype, "defaultList", null);
__decorate([
    (0, common_1.Get)('admin'),
    (0, permissions_decorator_1.RequirePermissions)('subscriptions.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('page')),
    __param(3, (0, common_1.Query)('offset')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], SubscriptionsController.prototype, "findAdminList", null);
__decorate([
    (0, common_1.Get)('admin/requests'),
    (0, permissions_decorator_1.RequirePermissions)('subscriptions.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SubscriptionsController.prototype, "findAdminRequests", null);
__decorate([
    (0, common_1.Get)('admin/audit'),
    (0, permissions_decorator_1.RequirePermissions)('subscriptions.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SubscriptionsController.prototype, "findAuditEvents", null);
__decorate([
    (0, common_1.Get)('admin/coupons'),
    (0, permissions_decorator_1.RequirePermissions)('subscriptions.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SubscriptionsController.prototype, "findCoupons", null);
__decorate([
    (0, common_1.Get)('admin/invoices/:invoiceId'),
    (0, permissions_decorator_1.RequirePermissions)('subscriptions.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('invoiceId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], SubscriptionsController.prototype, "findInvoice", null);
__decorate([
    (0, common_1.Get)('admin/payment-proofs/:invoiceId'),
    (0, permissions_decorator_1.RequirePermissions)('subscriptions.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('invoiceId')),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], SubscriptionsController.prototype, "downloadPaymentProof", null);
__decorate([
    (0, common_1.Post)('admin/coupons'),
    (0, permissions_decorator_1.RequirePermissions)('subscriptions.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, subscription_coupon_dto_1.SubscriptionCouponDto]),
    __metadata("design:returntype", Promise)
], SubscriptionsController.prototype, "createCoupon", null);
__decorate([
    (0, common_1.Put)('admin/coupons/:id'),
    (0, permissions_decorator_1.RequirePermissions)('subscriptions.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, subscription_coupon_dto_1.SubscriptionCouponDto]),
    __metadata("design:returntype", Promise)
], SubscriptionsController.prototype, "updateCoupon", null);
__decorate([
    (0, common_1.Delete)('admin/coupons/:id'),
    (0, permissions_decorator_1.RequirePermissions)('subscriptions.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], SubscriptionsController.prototype, "deleteCoupon", null);
__decorate([
    (0, common_1.Post)('assign'),
    (0, permissions_decorator_1.RequirePermissions)('subscriptions.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, assign_subscription_dto_1.AssignSubscriptionDto]),
    __metadata("design:returntype", Promise)
], SubscriptionsController.prototype, "assign", null);
__decorate([
    (0, common_1.Post)('request'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, request_subscription_dto_1.RequestSubscriptionDto]),
    __metadata("design:returntype", Promise)
], SubscriptionsController.prototype, "requestUpgrade", null);
__decorate([
    (0, common_1.Post)('payhere/initiate'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, request_subscription_dto_1.RequestSubscriptionDto]),
    __metadata("design:returntype", Promise)
], SubscriptionsController.prototype, "initiatePayHereCheckout", null);
__decorate([
    (0, common_1.Post)('manual-payment/request'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, manual_payment_request_dto_1.ManualPaymentRequestDto]),
    __metadata("design:returntype", Promise)
], SubscriptionsController.prototype, "requestManualPayment", null);
__decorate([
    (0, common_1.Post)('payhere/notify'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SubscriptionsController.prototype, "handlePayHereNotify", null);
__decorate([
    (0, common_1.Patch)('requests/:id/resolve'),
    (0, permissions_decorator_1.RequirePermissions)('subscriptions.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, resolve_subscription_request_dto_1.ResolveSubscriptionRequestDto]),
    __metadata("design:returntype", Promise)
], SubscriptionsController.prototype, "resolveRequest", null);
__decorate([
    (0, common_1.Patch)(':id/extend'),
    (0, permissions_decorator_1.RequirePermissions)('subscriptions.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, subscription_action_dto_1.ExtendSubscriptionDto]),
    __metadata("design:returntype", Promise)
], SubscriptionsController.prototype, "extend", null);
__decorate([
    (0, common_1.Patch)(':id/renew'),
    (0, permissions_decorator_1.RequirePermissions)('subscriptions.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, subscription_action_dto_1.RenewSubscriptionDto]),
    __metadata("design:returntype", Promise)
], SubscriptionsController.prototype, "renew", null);
__decorate([
    (0, common_1.Patch)(':id/cancel'),
    (0, permissions_decorator_1.RequirePermissions)('subscriptions.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, subscription_action_dto_1.CancelSubscriptionDto]),
    __metadata("design:returntype", Promise)
], SubscriptionsController.prototype, "cancel", null);
__decorate([
    (0, common_1.Patch)(':id/payment'),
    (0, permissions_decorator_1.RequirePermissions)('subscriptions.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, subscription_action_dto_1.UpdateSubscriptionPaymentDto]),
    __metadata("design:returntype", Promise)
], SubscriptionsController.prototype, "updatePayment", null);
__decorate([
    (0, common_1.Get)('me'),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SubscriptionsController.prototype, "getMine", null);
exports.SubscriptionsController = SubscriptionsController = __decorate([
    (0, common_1.Controller)(['subscriptions', 'subscritions']),
    __metadata("design:paramtypes", [subscriptions_service_1.SubscriptionsService,
        auth_service_1.AuthService])
], SubscriptionsController);
//# sourceMappingURL=subscriptions.controller.js.map