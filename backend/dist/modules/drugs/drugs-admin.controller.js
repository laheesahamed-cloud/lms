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
exports.DrugsAdminController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const multer_1 = require("multer");
const auth_service_1 = require("../auth/auth.service");
const ai_service_1 = require("../ai/ai.service");
const drugs_service_1 = require("./drugs.service");
const create_drug_dto_1 = require("./dto/create-drug.dto");
const update_drug_dto_1 = require("./dto/update-drug.dto");
let DrugsAdminController = class DrugsAdminController {
    constructor(svc, authService, aiService) {
        this.svc = svc;
        this.authService = authService;
        this.aiService = aiService;
    }
    async requireAdmin(auth) {
        return this.authService.requireAdmin(auth);
    }
    async getSettings(auth) {
        await this.requireAdmin(auth);
        return this.svc.getSettings();
    }
    async updateSettings(body, auth) {
        await this.requireAdmin(auth);
        await this.svc.updateFeatureSettings(body.enabled, body.freeLimit);
        return { ok: true };
    }
    async list(page = '1', limit = '30', search = '', auth) {
        await this.requireAdmin(auth);
        return this.svc.listDrugs(Number(page), Number(limit), search);
    }
    async aiLookup(body, auth) {
        await this.requireAdmin(auth);
        const name = (body.name || '').trim();
        if (!name)
            throw new common_1.BadRequestException('Drug name is required');
        const prompt = `You are a clinical pharmacology expert specialising in drugs used in Sri Lanka. Look up the drug "${name}" and return a JSON object with EVERY field filled — do NOT use null unless the information truly does not exist for this drug.

Return exactly this JSON structure:
{
  "name": "official INN/generic name",
  "drug_class": "specific pharmacological class, e.g. HMG-CoA Reductase Inhibitor, ACE Inhibitor, Aminoglycoside Antibiotic",
  "uses": "each indication on its own, separated by semicolons",
  "dosage_adult": "each dosing regimen separated by semicolons, include route and frequency",
  "dosage_pediatric": "weight-based or age-based pediatric dosing separated by semicolons, or null only if genuinely not used in children",
  "side_effects": "list of common and serious adverse effects separated by semicolons",
  "warnings": "contraindications, black-box warnings, major precautions — each separated by semicolons",
  "drug_interactions": "clinically significant interactions separated by semicolons",
  "pregnancy_info": "FDA/WHO pregnancy category, risk summary, and key advice in 1-2 sentences",
  "sl_brand_names": "comma-separated brand names sold in Sri Lanka — if Sri Lanka-specific brands are unknown, list the major international brand names (e.g. Lipitor for atorvastatin). Only use null if the drug has no known brand name anywhere."
}
Return ONLY valid JSON, no markdown fences, no explanation.`;
        const provider = await this.aiService.resolveRuntimeProvider();
        const raw = await this.aiService.runJsonPrompt(prompt, provider);
        const parsed = this.aiService.parseJson(raw, provider.providerKey);
        if (!parsed || typeof parsed !== 'object') {
            throw new common_1.BadGatewayException('AI returned an invalid response');
        }
        return {
            ok: true,
            provider: provider.providerKey,
            model: provider.model,
            drug: {
                name: parsed.name || name,
                drug_class: parsed.drug_class || null,
                uses: parsed.uses || null,
                dosage_adult: parsed.dosage_adult || null,
                dosage_pediatric: parsed.dosage_pediatric || null,
                side_effects: parsed.side_effects || null,
                warnings: parsed.warnings || null,
                drug_interactions: parsed.drug_interactions || null,
                pregnancy_info: parsed.pregnancy_info || null,
                sl_brand_names: parsed.sl_brand_names || null,
            },
        };
    }
    async importDrugs(file, auth) {
        await this.requireAdmin(auth);
        if (!file)
            throw new common_1.BadRequestException('No file uploaded');
        return this.svc.importDrugs(file.buffer, file.originalname);
    }
    async getOne(id, auth) {
        await this.requireAdmin(auth);
        return this.svc.getDrug(id);
    }
    async create(body, auth) {
        await this.requireAdmin(auth);
        return this.svc.createDrug(body);
    }
    async update(id, body, auth) {
        await this.requireAdmin(auth);
        await this.svc.updateDrug(id, body);
        return { ok: true };
    }
    async toggle(id, auth) {
        await this.requireAdmin(auth);
        await this.svc.toggleDrug(id);
        return { ok: true };
    }
    async remove(id, auth) {
        await this.requireAdmin(auth);
        await this.svc.deleteDrug(id);
        return { ok: true };
    }
};
exports.DrugsAdminController = DrugsAdminController;
__decorate([
    (0, common_1.Get)('settings'),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], DrugsAdminController.prototype, "getSettings", null);
__decorate([
    (0, common_1.Put)('settings'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], DrugsAdminController.prototype, "updateSettings", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('search')),
    __param(3, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object, String]),
    __metadata("design:returntype", Promise)
], DrugsAdminController.prototype, "list", null);
__decorate([
    (0, common_1.Post)('ai-lookup'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], DrugsAdminController.prototype, "aiLookup", null);
__decorate([
    (0, common_1.Post)('import'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', { storage: (0, multer_1.memoryStorage)() })),
    __param(0, (0, common_1.UploadedFile)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], DrugsAdminController.prototype, "importDrugs", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", Promise)
], DrugsAdminController.prototype, "getOne", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_drug_dto_1.CreateDrugDto, String]),
    __metadata("design:returntype", Promise)
], DrugsAdminController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, update_drug_dto_1.UpdateDrugDto, String]),
    __metadata("design:returntype", Promise)
], DrugsAdminController.prototype, "update", null);
__decorate([
    (0, common_1.Patch)(':id/toggle'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", Promise)
], DrugsAdminController.prototype, "toggle", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", Promise)
], DrugsAdminController.prototype, "remove", null);
exports.DrugsAdminController = DrugsAdminController = __decorate([
    (0, common_1.Controller)('admin/drugs'),
    __metadata("design:paramtypes", [drugs_service_1.DrugsService,
        auth_service_1.AuthService,
        ai_service_1.AiService])
], DrugsAdminController);
//# sourceMappingURL=drugs-admin.controller.js.map