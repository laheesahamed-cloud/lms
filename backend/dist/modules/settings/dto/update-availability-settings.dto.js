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
Object.defineProperty(exports, "__esModule", { value: true });
exports.VerifyAvailabilityUnlockDto = exports.UpdateAvailabilitySettingsDto = void 0;
const class_validator_1 = require("class-validator");
class UpdateAvailabilitySettingsDto {
}
exports.UpdateAvailabilitySettingsDto = UpdateAvailabilitySettingsDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['live', 'maintenance', 'coming-soon']),
    __metadata("design:type", String)
], UpdateAvailabilitySettingsDto.prototype, "mode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(4),
    (0, class_validator_1.MaxLength)(20),
    (0, class_validator_1.Matches)(/^\d+$/, { message: 'Unlock code must contain digits only' }),
    __metadata("design:type", String)
], UpdateAvailabilitySettingsDto.prototype, "unlockCode", void 0);
class VerifyAvailabilityUnlockDto {
}
exports.VerifyAvailabilityUnlockDto = VerifyAvailabilityUnlockDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(4),
    (0, class_validator_1.MaxLength)(40),
    (0, class_validator_1.Matches)(/^\d+$/, { message: 'Unlock code must contain digits only' }),
    __metadata("design:type", String)
], VerifyAvailabilityUnlockDto.prototype, "code", void 0);
//# sourceMappingURL=update-availability-settings.dto.js.map