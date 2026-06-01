import { AuthService } from '../auth/auth.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { CreateSubscriptionFeatureDto } from './dto/create-subscription-feature.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { UpdateSubscriptionFeatureDto } from './dto/update-subscription-feature.dto';
import { PlansService } from './plans.service';
export declare class PlansController {
    private readonly plansService;
    private readonly authService;
    constructor(plansService: PlansService, authService: AuthService);
    findActive(): Promise<{
        id: number;
        name: string;
        slug: string;
        description: string;
        price: number;
        regularPrice: number;
        offerPrice: number | null;
        offerEnabled: boolean;
        effectivePrice: number;
        currency: string;
        billingPeriod: string;
        durationDays: number;
        status: "active" | "inactive";
        sortOrder: number;
        recommended: boolean;
        features: string[];
        featureIds: number[];
        featureKeys: string[];
        enabledFeatures: {
            id: number;
            featureName: string;
            featureKey: string;
            description: string;
            category: string;
            status: string;
            createdAt: string | null;
            updatedAt: string | null;
        }[];
        featuresByCategory: {
            category: "Learning Access" | "Question Bank" | "Exams & Practice" | "Lessons & Study Tools" | "Analytics" | "AI Tools" | "Support / Extras";
            features: {
                id: number;
                featureName: string;
                featureKey: string;
                description: string;
                category: string;
                status: string;
                createdAt: string | null;
                updatedAt: string | null;
            }[];
        }[];
        createdAt: string | null;
        updatedAt: string | null;
    }[]>;
    findAdminAll(authorization?: string): Promise<{
        id: number;
        name: string;
        slug: string;
        description: string;
        price: number;
        regularPrice: number;
        offerPrice: number | null;
        offerEnabled: boolean;
        effectivePrice: number;
        currency: string;
        billingPeriod: string;
        durationDays: number;
        status: "active" | "inactive";
        sortOrder: number;
        recommended: boolean;
        features: string[];
        featureIds: number[];
        featureKeys: string[];
        enabledFeatures: {
            id: number;
            featureName: string;
            featureKey: string;
            description: string;
            category: string;
            status: string;
            createdAt: string | null;
            updatedAt: string | null;
        }[];
        featuresByCategory: {
            category: "Learning Access" | "Question Bank" | "Exams & Practice" | "Lessons & Study Tools" | "Analytics" | "AI Tools" | "Support / Extras";
            features: {
                id: number;
                featureName: string;
                featureKey: string;
                description: string;
                category: string;
                status: string;
                createdAt: string | null;
                updatedAt: string | null;
            }[];
        }[];
        createdAt: string | null;
        updatedAt: string | null;
    }[]>;
    featureCatalog(authorization?: string): Promise<{
        categories: ("Learning Access" | "Question Bank" | "Exams & Practice" | "Lessons & Study Tools" | "Analytics" | "AI Tools" | "Support / Extras")[];
        features: {
            id: number;
            featureName: string;
            featureKey: string;
            description: string;
            category: string;
            status: "active" | "inactive";
            createdAt: string | null;
            updatedAt: string | null;
        }[];
    }>;
    create(authorization: string | undefined, dto: CreatePlanDto): Promise<{
        ok: boolean;
        id: number;
    }>;
    createFeature(authorization: string | undefined, dto: CreateSubscriptionFeatureDto): Promise<{
        ok: boolean;
        id: number;
    }>;
    update(authorization: string | undefined, id: number, dto: UpdatePlanDto): Promise<{
        ok: boolean;
        id: number;
    }>;
    updateFeature(authorization: string | undefined, id: number, dto: UpdateSubscriptionFeatureDto): Promise<{
        ok: boolean;
        id: number;
    }>;
    remove(authorization: string | undefined, id: number): Promise<{
        ok: boolean;
        id: number;
    }>;
}
