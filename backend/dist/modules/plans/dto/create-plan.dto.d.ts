export declare class CreatePlanDto {
    name: string;
    slug?: string;
    description?: string;
    regularPrice: number;
    offerPrice?: number | null;
    offerEnabled: boolean;
    currency?: string;
    durationDays: number;
    featureIds?: number[];
    sortOrder?: number;
    recommended?: boolean;
    status: 'active' | 'inactive';
}
