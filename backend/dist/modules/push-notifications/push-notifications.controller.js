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
exports.PushNotificationsController = void 0;
const common_1 = require("@nestjs/common");
const permissions_decorator_1 = require("../auth/permissions.decorator");
const push_notifications_service_1 = require("./push-notifications.service");
let PushNotificationsController = class PushNotificationsController {
    constructor(pushNotificationsService) {
        this.pushNotificationsService = pushNotificationsService;
    }
    getVapidPublicKey() {
        return this.pushNotificationsService.getPublicConfig();
    }
    getSettings(authorization) {
        return this.pushNotificationsService.getSettings(authorization);
    }
    getAdminStatus(authorization) {
        return this.pushNotificationsService.getAdminStatus(authorization);
    }
    updateSettings(authorization, body) {
        return this.pushNotificationsService.updateSettings(authorization, body);
    }
    subscribe(authorization, userAgent, body) {
        return this.pushNotificationsService.subscribe(authorization, body, userAgent);
    }
    unsubscribe(authorization, body) {
        return this.pushNotificationsService.unsubscribe(authorization, body);
    }
    saveNativeToken(authorization, body) {
        return this.pushNotificationsService.saveNativeToken(authorization, body);
    }
    deleteNativeToken(authorization, body) {
        return this.pushNotificationsService.deleteNativeToken(authorization, body);
    }
    sendAdminNotification(authorization, body) {
        return this.pushNotificationsService.sendAdminNotification(authorization, body);
    }
};
exports.PushNotificationsController = PushNotificationsController;
__decorate([
    (0, common_1.Get)('vapid-public-key'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], PushNotificationsController.prototype, "getVapidPublicKey", null);
__decorate([
    (0, common_1.Get)('settings'),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PushNotificationsController.prototype, "getSettings", null);
__decorate([
    (0, common_1.Get)('admin/status'),
    (0, permissions_decorator_1.RequirePermissions)('notifications.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PushNotificationsController.prototype, "getAdminStatus", null);
__decorate([
    (0, common_1.Put)('settings'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], PushNotificationsController.prototype, "updateSettings", null);
__decorate([
    (0, common_1.Post)('subscribe'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Headers)('user-agent')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", void 0)
], PushNotificationsController.prototype, "subscribe", null);
__decorate([
    (0, common_1.Delete)('subscribe'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], PushNotificationsController.prototype, "unsubscribe", null);
__decorate([
    (0, common_1.Post)('native-token'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], PushNotificationsController.prototype, "saveNativeToken", null);
__decorate([
    (0, common_1.Delete)('native-token'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], PushNotificationsController.prototype, "deleteNativeToken", null);
__decorate([
    (0, common_1.Post)('admin/send'),
    (0, permissions_decorator_1.RequirePermissions)('notifications.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], PushNotificationsController.prototype, "sendAdminNotification", null);
exports.PushNotificationsController = PushNotificationsController = __decorate([
    (0, common_1.Controller)('push'),
    __metadata("design:paramtypes", [push_notifications_service_1.PushNotificationsService])
], PushNotificationsController);
//# sourceMappingURL=push-notifications.controller.js.map