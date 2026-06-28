import { AuthService } from '../auth/auth.service';
import { AiService } from '../ai/ai.service';
import { DrugsService, DrugsSettings } from './drugs.service';
import { CreateDrugDto } from './dto/create-drug.dto';
import { UpdateDrugDto } from './dto/update-drug.dto';
export declare class DrugsAdminController {
    private readonly svc;
    private readonly authService;
    private readonly aiService;
    constructor(svc: DrugsService, authService: AuthService, aiService: AiService);
    private requireAdmin;
    getSettings(auth?: string): Promise<DrugsSettings>;
    updateSettings(body: {
        enabled: boolean;
        freeLimit: number;
    }, auth?: string): Promise<{
        ok: boolean;
    }>;
    list(page?: string, limit?: string, search?: string, auth?: string): Promise<{
        drugs: import("mysql2").RowDataPacket[];
        total: number;
        page: number;
        limit: number;
    }>;
    aiLookup(body: {
        name: string;
    }, auth?: string): Promise<{
        ok: boolean;
        provider: any;
        model: any;
        drug: {
            name: any;
            drug_class: any;
            uses: any;
            dosage_adult: any;
            dosage_pediatric: any;
            side_effects: any;
            warnings: any;
            drug_interactions: any;
            pregnancy_info: any;
            sl_brand_names: any;
        };
    }>;
    getOne(id: number, auth?: string): Promise<import("mysql2").RowDataPacket>;
    create(body: CreateDrugDto, auth?: string): Promise<{
        id: any;
    }>;
    update(id: number, body: UpdateDrugDto, auth?: string): Promise<{
        ok: boolean;
    }>;
    toggle(id: number, auth?: string): Promise<{
        ok: boolean;
    }>;
    remove(id: number, auth?: string): Promise<{
        ok: boolean;
    }>;
}
