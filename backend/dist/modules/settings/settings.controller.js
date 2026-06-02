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
exports.SettingsController = void 0;
const common_1 = require("@nestjs/common");
const auth_service_1 = require("../auth/auth.service");
const permissions_decorator_1 = require("../auth/permissions.decorator");
const create_ai_provider_dto_1 = require("./dto/create-ai-provider.dto");
const update_general_settings_dto_1 = require("./dto/update-general-settings.dto");
const update_ai_provider_dto_1 = require("./dto/update-ai-provider.dto");
const update_landing_page_settings_dto_1 = require("./dto/update-landing-page-settings.dto");
const update_availability_settings_dto_1 = require("./dto/update-availability-settings.dto");
const update_payment_settings_dto_1 = require("./dto/update-payment-settings.dto");
const update_smtp_settings_dto_1 = require("./dto/update-smtp-settings.dto");
const test_smtp_settings_dto_1 = require("./dto/test-smtp-settings.dto");
const update_popup_alert_settings_dto_1 = require("./dto/update-popup-alert-settings.dto");
const update_apns_settings_dto_1 = require("./dto/update-apns-settings.dto");
const update_fcm_settings_dto_1 = require("./dto/update-fcm-settings.dto");
const settings_service_1 = require("./settings.service");
let SettingsController = class SettingsController {
    constructor(settingsService, authService) {
        this.settingsService = settingsService;
        this.authService = authService;
    }
    async getAiProviders(authorization) {
        await this.authService.requireAdmin(authorization);
        return this.settingsService.getAiProviderSettings();
    }
    async getGeneralSettings(authorization) {
        await this.authService.requireAdmin(authorization);
        return this.settingsService.getGeneralSettings();
    }
    async getLandingPageSettings(authorization) {
        await this.authService.requireAdmin(authorization);
        return this.settingsService.getLandingPageSettings();
    }
    async getAvailabilitySettings(authorization) {
        await this.authService.requireAdmin(authorization);
        return this.settingsService.getAvailabilitySettings();
    }
    async getPublicSettings() {
        return this.settingsService.getPublicSettings();
    }
    async getPublicAvailabilitySettings() {
        return this.settingsService.getPublicAvailabilitySettings();
    }
    async verifyAvailabilityUnlock(dto) {
        return this.settingsService.verifyAvailabilityUnlock(dto);
    }
    async getPaymentSettings(authorization) {
        await this.authService.requireAdmin(authorization);
        return this.settingsService.getPaymentSettings();
    }
    async getSmtpSettings(authorization) {
        await this.authService.requireAdmin(authorization);
        return this.settingsService.getSmtpSettings();
    }
    async getPopupAlertSettings(authorization) {
        await this.authService.requireAdmin(authorization);
        return this.settingsService.getPopupAlertSettings();
    }
    async getApnsSettings(authorization) {
        await this.authService.requireAdmin(authorization);
        return this.settingsService.getApnsSettings();
    }
    async getFcmSettings(authorization) {
        await this.authService.requireAdmin(authorization);
        return this.settingsService.getFcmSettings();
    }
    async createAiProvider(authorization, dto) {
        await this.authService.requireAdmin(authorization);
        return this.settingsService.createAiProvider(dto);
    }
    async testAiProvider(authorization, dto) {
        await this.authService.requireAdmin(authorization);
        return this.settingsService.testAiProvider(dto);
    }
    async updateGeneralSettings(authorization, dto) {
        await this.authService.requireAdmin(authorization);
        return this.settingsService.updateGeneralSettings(dto);
    }
    async updateLandingPageSettings(authorization, dto) {
        await this.authService.requireAdmin(authorization);
        return this.settingsService.updateLandingPageSettings(dto);
    }
    async updateAvailabilitySettings(authorization, dto) {
        await this.authService.requireAdmin(authorization);
        return this.settingsService.updateAvailabilitySettings(dto);
    }
    async updatePaymentSettings(authorization, dto) {
        await this.authService.requireAdmin(authorization);
        return this.settingsService.updatePaymentSettings(dto);
    }
    async updateSmtpSettings(authorization, dto) {
        await this.authService.requireAdmin(authorization);
        return this.settingsService.updateSmtpSettings(dto);
    }
    async testSmtpSettings(authorization, dto) {
        await this.authService.requireAdmin(authorization);
        return this.settingsService.sendSmtpTestEmail(dto.toEmail);
    }
    async updatePopupAlertSettings(authorization, dto) {
        await this.authService.requireAdmin(authorization);
        return this.settingsService.updatePopupAlertSettings(dto);
    }
    async updateApnsSettings(authorization, dto) {
        await this.authService.requireAdmin(authorization);
        return this.settingsService.updateApnsSettings(dto);
    }
    async updateFcmSettings(authorization, dto) {
        await this.authService.requireAdmin(authorization);
        return this.settingsService.updateFcmSettings(dto);
    }
    async updateAiProvider(authorization, id, dto) {
        await this.authService.requireAdmin(authorization);
        return this.settingsService.updateAiProvider(id, dto);
    }
    async activateAiProvider(authorization, id) {
        await this.authService.requireAdmin(authorization);
        return this.settingsService.activateAiProvider(id);
    }
    async deleteAiProvider(authorization, id) {
        await this.authService.requireAdmin(authorization);
        return this.settingsService.deleteAiProvider(id);
    }
};
exports.SettingsController = SettingsController;
__decorate([
    (0, common_1.Get)('ai-providers'),
    (0, permissions_decorator_1.RequirePermissions)('settings.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "getAiProviders", null);
__decorate([
    (0, common_1.Get)('general'),
    (0, permissions_decorator_1.RequirePermissions)('settings.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "getGeneralSettings", null);
__decorate([
    (0, common_1.Get)('landing-page'),
    (0, permissions_decorator_1.RequirePermissions)('settings.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "getLandingPageSettings", null);
__decorate([
    (0, common_1.Get)('availability'),
    (0, permissions_decorator_1.RequirePermissions)('settings.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "getAvailabilitySettings", null);
__decorate([
    (0, common_1.Get)('public'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "getPublicSettings", null);
__decorate([
    (0, common_1.Get)('public/availability'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "getPublicAvailabilitySettings", null);
__decorate([
    (0, common_1.Post)('availability/unlock'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [update_availability_settings_dto_1.VerifyAvailabilityUnlockDto]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "verifyAvailabilityUnlock", null);
__decorate([
    (0, common_1.Get)('payments'),
    (0, permissions_decorator_1.RequirePermissions)('settings.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "getPaymentSettings", null);
__decorate([
    (0, common_1.Get)('smtp'),
    (0, permissions_decorator_1.RequirePermissions)('settings.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "getSmtpSettings", null);
__decorate([
    (0, common_1.Get)('popup-alert'),
    (0, permissions_decorator_1.RequirePermissions)('settings.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "getPopupAlertSettings", null);
__decorate([
    (0, common_1.Get)('apns'),
    (0, permissions_decorator_1.RequirePermissions)('settings.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "getApnsSettings", null);
__decorate([
    (0, common_1.Get)('fcm'),
    (0, permissions_decorator_1.RequirePermissions)('settings.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "getFcmSettings", null);
__decorate([
    (0, common_1.Post)('ai-providers'),
    (0, permissions_decorator_1.RequirePermissions)('settings.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_ai_provider_dto_1.CreateAiProviderDto]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "createAiProvider", null);
__decorate([
    (0, common_1.Post)('ai-providers/test'),
    (0, permissions_decorator_1.RequirePermissions)('settings.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_ai_provider_dto_1.CreateAiProviderDto]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "testAiProvider", null);
__decorate([
    (0, common_1.Put)('general'),
    (0, permissions_decorator_1.RequirePermissions)('settings.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, update_general_settings_dto_1.UpdateGeneralSettingsDto]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "updateGeneralSettings", null);
__decorate([
    (0, common_1.Put)('landing-page'),
    (0, permissions_decorator_1.RequirePermissions)('settings.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, update_landing_page_settings_dto_1.UpdateLandingPageSettingsDto]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "updateLandingPageSettings", null);
__decorate([
    (0, common_1.Put)('availability'),
    (0, permissions_decorator_1.RequirePermissions)('settings.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, update_availability_settings_dto_1.UpdateAvailabilitySettingsDto]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "updateAvailabilitySettings", null);
__decorate([
    (0, common_1.Put)('payments'),
    (0, permissions_decorator_1.RequirePermissions)('settings.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, update_payment_settings_dto_1.UpdatePaymentSettingsDto]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "updatePaymentSettings", null);
__decorate([
    (0, common_1.Put)('smtp'),
    (0, permissions_decorator_1.RequirePermissions)('settings.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, update_smtp_settings_dto_1.UpdateSmtpSettingsDto]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "updateSmtpSettings", null);
__decorate([
    (0, common_1.Post)('smtp/test'),
    (0, permissions_decorator_1.RequirePermissions)('settings.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, test_smtp_settings_dto_1.TestSmtpSettingsDto]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "testSmtpSettings", null);
__decorate([
    (0, common_1.Put)('popup-alert'),
    (0, permissions_decorator_1.RequirePermissions)('settings.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, update_popup_alert_settings_dto_1.UpdatePopupAlertSettingsDto]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "updatePopupAlertSettings", null);
__decorate([
    (0, common_1.Put)('apns'),
    (0, permissions_decorator_1.RequirePermissions)('settings.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, update_apns_settings_dto_1.UpdateApnsSettingsDto]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "updateApnsSettings", null);
__decorate([
    (0, common_1.Put)('fcm'),
    (0, permissions_decorator_1.RequirePermissions)('settings.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, update_fcm_settings_dto_1.UpdateFcmSettingsDto]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "updateFcmSettings", null);
__decorate([
    (0, common_1.Put)('ai-providers/:id'),
    (0, permissions_decorator_1.RequirePermissions)('settings.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, update_ai_provider_dto_1.UpdateAiProviderDto]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "updateAiProvider", null);
__decorate([
    (0, common_1.Put)('ai-providers/:id/activate'),
    (0, permissions_decorator_1.RequirePermissions)('settings.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "activateAiProvider", null);
__decorate([
    (0, common_1.Delete)('ai-providers/:id'),
    (0, permissions_decorator_1.RequirePermissions)('settings.manage'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "deleteAiProvider", null);
exports.SettingsController = SettingsController = __decorate([
    (0, common_1.Controller)('settings'),
    __metadata("design:paramtypes", [settings_service_1.SettingsService,
        auth_service_1.AuthService])
], SettingsController);
//# sourceMappingURL=settings.controller.js.map