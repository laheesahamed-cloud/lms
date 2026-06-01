import { Pool } from 'mysql2/promise';
import { CreatePlanDto } from './dto/create-plan.dto';
import { CreateSubscriptionFeatureDto } from './dto/create-subscription-feature.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { UpdateSubscriptionFeatureDto } from './dto/update-subscription-feature.dto';
export declare class PlansService {
    private readonly db;
    constructor(db: Pool);
    findAll(): Promise<{
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
    findById(id: number): Promise<{
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
    }>;
    findByIds(ids: number[]): Promise<Map<any, any>>;
    getFeatureCatalog(): Promise<{
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
    create(dto: CreatePlanDto): Promise<{
        ok: boolean;
        id: number;
    }>;
    update(id: number, dto: UpdatePlanDto): Promise<{
        ok: boolean;
        id: number;
    }>;
    remove(id: number): Promise<{
        ok: boolean;
        id: number;
    }>;
    createFeature(dto: CreateSubscriptionFeatureDto): Promise<{
        ok: boolean;
        id: number;
    }>;
    updateFeature(id: number, dto: UpdateSubscriptionFeatureDto): Promise<{
        ok: boolean;
        id: number;
    }>;
    getActiveFeatureKeysForUser(userId: number): Promise<string[]>;
    hasFeatureAccess(userId: number, featureKey: string): Promise<boolean>;
    private listPlans;
    private getFeatures;
    private getPlanFeatureMap;
    private normalizeCreatePayload;
    private normalizeUpdatePayload;
    private normalizeFeaturePayload;
    private validateFeatureIds;
    private ensureUniqueSlug;
    private syncPlanFeatures;
    private refreshSinglePlanFeatureJson;
    private refreshPlansFeatureJsonForFeature;
    private findFeatureById;
    private mapPlan;
    private slugify;
}
