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
}, {
    readonly slug: "quick-revision-7d";
    readonly name: "Quick Revision";
    readonly description: "7 days of all-subject MCQ, quizzes, and exam practice for fast revision.";
    readonly regularPrice: number;
    readonly offerPrice: 990;
    readonly offerEnabled: 1;
    readonly currency: "LKR";
    readonly durationDays: 7;
    readonly sortOrder: 1;
    readonly recommended: 0;
    readonly status: "active";
    readonly featureKeys: string[];
}, {
    readonly slug: "monthly-prep-1m";
    readonly name: "Monthly Prep";
    readonly description: "1 month of all-subject lessons, notes, MCQs, quizzes, practice, and exam mode.";
    readonly regularPrice: number;
    readonly offerPrice: 3990;
    readonly offerEnabled: 1;
    readonly currency: "LKR";
    readonly durationDays: 30;
    readonly sortOrder: 2;
    readonly recommended: 0;
    readonly status: "active";
    readonly featureKeys: string[];
}, {
    readonly slug: "complete-prep-3m";
    readonly name: "Complete Prep";
    readonly description: "3 months of complete ERPM preparation. Best for most serious students.";
    readonly regularPrice: number;
    readonly offerPrice: 8990;
    readonly offerEnabled: 1;
    readonly currency: "LKR";
    readonly durationDays: 90;
    readonly sortOrder: 3;
    readonly recommended: 1;
    readonly status: "active";
    readonly featureKeys: string[];
}, {
    readonly slug: "master-prep-6m";
    readonly name: "Master Prep";
    readonly description: "6 months of complete preparation with the best long-term value.";
    readonly regularPrice: number;
    readonly offerPrice: 14990;
    readonly offerEnabled: 1;
    readonly currency: "LKR";
    readonly durationDays: 180;
    readonly sortOrder: 4;
    readonly recommended: 0;
    readonly status: "active";
    readonly featureKeys: readonly [...string[], "dynamic_quiz_randomization"];
}, {
    readonly slug: "single-course-3m";
    readonly name: "Single Course";
    readonly description: "3 months of complete prep for one course of your choice. Lessons, AI notes, full MCQ bank, practice and exam mode.";
    readonly regularPrice: number;
    readonly offerPrice: 3990;
    readonly offerEnabled: 1;
    readonly currency: "LKR";
    readonly durationDays: 90;
    readonly sortOrder: 5;
    readonly recommended: 0;
    readonly status: "active";
    readonly featureKeys: string[];
}];
export declare const APPLE_IAP_PRODUCTS: readonly [{
    readonly productId: "app.xyndrome.lk.weekly";
    readonly slug: "quick-revision-7d";
    readonly durationDays: 7;
}, {
    readonly productId: "app.xyndrome.lk.monthly";
    readonly slug: "monthly-prep-1m";
    readonly durationDays: 30;
}, {
    readonly productId: "app.xyndrome.lk.yearly";
    readonly slug: "annual-prep-1y";
    readonly durationDays: 365;
    readonly createIfMissing: {
        readonly name: "Annual Prep";
        readonly description: "12 months of complete preparation. Lessons, AI notes, full MCQ bank, practice and exam mode.";
        readonly regularPrice: 34990;
        readonly offerPrice: 23990;
        readonly currency: "LKR";
        readonly billingPeriod: "year";
        readonly status: "inactive";
        readonly sortOrder: 6;
    };
}];
