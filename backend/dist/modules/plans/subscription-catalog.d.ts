export declare const SUBSCRIPTION_FEATURE_CATEGORIES: readonly ["Learning Access", "Question Bank", "Exams & Practice", "Lessons & Study Tools", "Analytics", "AI Tools", "Support / Extras"];
export type SubscriptionFeatureSeed = {
    featureKey: string;
    featureName: string;
    description: string;
    category: (typeof SUBSCRIPTION_FEATURE_CATEGORIES)[number];
};
export declare const DEFAULT_SUBSCRIPTION_FEATURES: SubscriptionFeatureSeed[];
export declare const DEFAULT_PLAN_BLUEPRINTS: readonly [{
    readonly slug: "free";
    readonly name: "Free";
    readonly description: "Explore the LMS, browse available content, and unlock any items marked as free.";
    readonly regularPrice: 0;
    readonly offerPrice: 0;
    readonly offerEnabled: 0;
    readonly currency: "LKR";
    readonly durationDays: 3650;
    readonly sortOrder: 0;
    readonly recommended: 0;
    readonly status: "active";
    readonly featureKeys: string[];
}, ...({
    slug: string;
    name: string;
    description: string;
    regularPrice: number;
    offerPrice: 390 | 990 | 2490 | 3990 | 490 | 1290 | 2990 | 4990 | 690 | 1790 | 6990 | 1990 | 4490 | 7990 | 890 | 5490 | 8990 | 1190 | 10990 | 5990 | 9990 | 3490 | 7490 | 12990 | 1490 | 14990;
    offerEnabled: number;
    currency: string;
    durationDays: 7 | 30 | 90 | 180;
    sortOrder: number;
    recommended: number;
    status: string;
    featureKeys: string[];
} | {
    slug: "quick-revision-7d" | "monthly-prep-1m" | "complete-prep-3m" | "master-prep-6m";
    name: "Quick Revision" | "Monthly Prep" | "Complete Prep" | "Master Prep";
    description: "7 days of all-subject MCQ, quizzes, and exam practice for fast revision." | "1 month of all-subject lessons, notes, MCQs, quizzes, practice, and exam mode." | "3 months of complete ERPM preparation. Best for most serious students." | "6 months of complete preparation with the best long-term value.";
    regularPrice: number;
    offerPrice: 990 | 3990 | 8990 | 14990;
    offerEnabled: number;
    currency: string;
    durationDays: 7 | 30 | 90 | 180;
    sortOrder: 1 | 2 | 4 | 3;
    recommended: 0 | 1;
    status: string;
    featureKeys: string[];
})[]];
