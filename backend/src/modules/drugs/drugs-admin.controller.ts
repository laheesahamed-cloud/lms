import { BadGatewayException, BadRequestException, Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, Query, Headers, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AuthService } from '../auth/auth.service';
import { AiService } from '../ai/ai.service';
import { DrugsService, DrugsSettings } from './drugs.service';
import { CreateDrugDto } from './dto/create-drug.dto';
import { UpdateDrugDto } from './dto/update-drug.dto';

@Controller('admin/drugs')
export class DrugsAdminController {
  constructor(
    private readonly svc: DrugsService,
    private readonly authService: AuthService,
    private readonly aiService: AiService,
  ) {}

  private async requireAdmin(auth?: string) {
    return this.authService.requireAdmin(auth);
  }

  @Get('settings')
  async getSettings(@Headers('authorization') auth?: string): Promise<DrugsSettings> {
    await this.requireAdmin(auth);
    return this.svc.getSettings();
  }

  @Put('settings')
  async updateSettings(
    @Body() body: { enabled: boolean; freeLimit: number },
    @Headers('authorization') auth?: string,
  ) {
    await this.requireAdmin(auth);
    await this.svc.updateFeatureSettings(body.enabled, body.freeLimit);
    return { ok: true };
  }

  @Get()
  async list(
    @Query('page') page = '1',
    @Query('limit') limit = '30',
    @Query('search') search = '',
    @Headers('authorization') auth?: string,
  ) {
    await this.requireAdmin(auth);
    return this.svc.listDrugs(Number(page), Number(limit), search);
  }

  @Post('ai-lookup')
  async aiLookup(
    @Body() body: { name: string },
    @Headers('authorization') auth?: string,
  ) {
    await this.requireAdmin(auth);
    const name = (body.name || '').trim();
    if (!name) throw new BadRequestException('Drug name is required');

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

    const provider = await (this.aiService as any).resolveRuntimeProvider();
    const raw = await (this.aiService as any).runJsonPrompt(prompt, provider);
    const parsed = (this.aiService as any).parseJson(raw, provider.providerKey) as any;

    if (!parsed || typeof parsed !== 'object') {
      throw new BadGatewayException('AI returned an invalid response');
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

  @Post('import')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async importDrugs(
    @UploadedFile() file: Express.Multer.File,
    @Headers('authorization') auth?: string,
  ) {
    await this.requireAdmin(auth);
    if (!file) throw new BadRequestException('No file uploaded');
    return this.svc.importDrugs(file.buffer, file.originalname);
  }

  @Get(':id')
  async getOne(@Param('id', ParseIntPipe) id: number, @Headers('authorization') auth?: string) {
    await this.requireAdmin(auth);
    return this.svc.getDrug(id);
  }

  @Post()
  async create(@Body() body: CreateDrugDto, @Headers('authorization') auth?: string) {
    await this.requireAdmin(auth);
    return this.svc.createDrug(body);
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateDrugDto,
    @Headers('authorization') auth?: string,
  ) {
    await this.requireAdmin(auth);
    await this.svc.updateDrug(id, body);
    return { ok: true };
  }

  @Patch(':id/toggle')
  async toggle(@Param('id', ParseIntPipe) id: number, @Headers('authorization') auth?: string) {
    await this.requireAdmin(auth);
    await this.svc.toggleDrug(id);
    return { ok: true };
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number, @Headers('authorization') auth?: string) {
    await this.requireAdmin(auth);
    await this.svc.deleteDrug(id);
    return { ok: true };
  }
}
