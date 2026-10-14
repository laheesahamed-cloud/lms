export const SUBSCRIPTION_FEATURE_CATEGORIES = [
  'Learning Access',
  'Question Bank',
  'Exams & Practice',
  'Lessons & Study Tools',
  'Analytics',
  'AI Tools',
  'Support / Extras',
] as const;

export type SubscriptionFeatureSeed = {
  featureKey: string;
  featureName: string;
  description: string;
  category: (typeof SUBSCRIPTION_FEATURE_CATEGORIES)[number];
};

export const DEFAULT_SUBSCRIPTION_FEATURES: SubscriptionFeatureSeed[] = [
  { featureKey: 'courses_access', featureName: 'Courses access', description: 'Lets students browse and open course spaces.', category: 'Learning Access' },
  { featureKey: 'subject_access', featureName: 'Subject access', description: 'Unlocks subject-level learning sections.', category: 'Learning Access' },
  { featureKey: 'topic_access', featureName: 'Topic access', description: 'Unlocks topic and hierarchy-based navigation.', category: 'Learning Access' },
  { featureKey: 'lessons_access_limited', featureName: 'Limited lessons access', description: 'Partial lesson access for entry plans.', category: 'Learning Access' },
  { featureKey: 'lessons_access_full', featureName: 'Full lessons access', description: 'Full lesson library access.', category: 'Learning Access' },
  { featureKey: 'question_bank_limited', featureName: 'Limited question bank', description: 'Restricted access to the question bank.', category: 'Question Bank' },
  { featureKey: 'question_bank_full', featureName: 'Full question bank', description: 'Full question bank access.', category: 'Question Bank' },
  { featureKey: 'past_paper_access', featureName: 'Past paper access', description: 'Allows students to use past paper question sets.', category: 'Question Bank' },
  { featureKey: 'mock_paper_access', featureName: 'Mock paper access', description: 'Allows students to use mock paper collections.', category: 'Question Bank' },
  { featureKey: 'practice_mode', featureName: 'Practice mode', description: 'Enables guided practice sessions.', category: 'Exams & Practice' },
  { featureKey: 'exam_mode', featureName: 'Exam mode', description: 'Enables timed exam mode.', category: 'Exams & Practice' },
  { featureKey: 'dynamic_quiz_randomization', featureName: 'Dynamic quiz randomization', description: 'Unlocks premium randomized quizzes that freeze a fresh question set per attempt.', category: 'Exams & Practice' },
  { featureKey: 'results_tracking', featureName: 'Results tracking', description: 'Shows quiz results and review history.', category: 'Exams & Practice' },
  { featureKey: 'report_question', featureName: 'Report question', description: 'Lets students report issues with questions.', category: 'Exams & Practice' },
  { featureKey: 'notes_canvas_study_mode', featureName: 'Lessons study mode', description: 'Unlocks interactive lessons and AI study sheets.', category: 'Lessons & Study Tools' },
  { featureKey: 'progress_tracking_basic', featureName: 'Basic progress tracking', description: 'Basic progress visibility inside the LMS.', category: 'Analytics' },
  { featureKey: 'progress_tracking_advanced', featureName: 'Advanced progress tracking', description: 'Deeper progress insights and trends.', category: 'Analytics' },
  { featureKey: 'performance_analytics', featureName: 'Performance analytics', description: 'Advanced dashboard analytics for students.', category: 'Analytics' },
  { featureKey: 'weak_area_analysis', featureName: 'Weak area analysis', description: 'Highlights weaker subjects and topics.', category: 'Analytics' },
  { featureKey: 'ai_quiz_generator', featureName: 'AI quiz generator', description: 'Unlocks AI-assisted quiz generation tools.', category: 'AI Tools' },
  { featureKey: 'priority_support', featureName: 'Priority support', description: 'Marks the plan for faster support handling.', category: 'Support / Extras' },
  { featureKey: 'future_premium_tools', featureName: 'Future premium tools', description: 'Placeholder bucket for future premium releases.', category: 'Support / Extras' },
];

const baseFeatureKeys = ['courses_access', 'subject_access', 'topic_access', 'progress_tracking_basic'];
const mcqFeatureKeys = [
  ...baseFeatureKeys,
  'question_bank_full',
  'past_paper_access',
  'mock_paper_access',
  'practice_mode',
  'exam_mode',
  'results_tracking',
  'report_question',
];
const premiumExamFeatureKeys = ['dynamic_quiz_randomization'];
const lessonFeatureKeys = [
  ...baseFeatureKeys,
  'lessons_access_full',
  'notes_canvas_study_mode',
];
const fullPrepFeatureKeys = [
  ...new Set([
    ...mcqFeatureKeys,
    ...lessonFeatureKeys,
    'performance_analytics',
    'weak_area_analysis',
    'progress_tracking_advanced',
  ]),
];

function discountRegularPrice(offerPrice: number) {
  if (offerPrice <= 0) return 0;
  return Math.max(offerPrice + 100, Math.ceil((offerPrice * 1.32) / 100) * 100 - 10);
}

export const DEFAULT_PLAN_BLUEPRINTS = [
  {
    slug: 'free',
    name: 'Free',
    description: 'Explore the LMS, browse available content, and unlock any items marked as free.',
    regularPrice: 0,
    offerPrice: 0,
    offerEnabled: 0,
    currency: 'LKR',
    durationDays: 3650,
    sortOrder: 0,
    recommended: 0,
    status: 'active',
    featureKeys: baseFeatureKeys,
  },
  {
    slug: 'quick-revision-7d',
    name: 'Quick Revision - 7 Days',
    description: '7 days of all-subject MCQ, quizzes, and exam practice for fast revision.',
    regularPrice: discountRegularPrice(990),
    offerPrice: 990,
    offerEnabled: 1,
    currency: 'LKR',
    durationDays: 7,
    sortOrder: 1,
    recommended: 0,
    status: 'active',
    featureKeys: mcqFeatureKeys,
  },
  {
    slug: 'monthly-prep-1m',
    name: 'Monthly Prep - 1 Month',
    description: '1 month of all-subject lessons, notes, MCQs, quizzes, practice, and exam mode.',
    regularPrice: discountRegularPrice(3990),
    offerPrice: 3990,
    offerEnabled: 1,
    currency: 'LKR',
    durationDays: 30,
    sortOrder: 2,
    recommended: 0,
    status: 'active',
    featureKeys: fullPrepFeatureKeys,
  },
  {
    slug: 'complete-prep-3m',
    name: 'Complete Prep - 3 Months',
    description: '3 months of complete ERPM preparation. Best for most serious students.',
    regularPrice: discountRegularPrice(8990),
    offerPrice: 8990,
    offerEnabled: 1,
    currency: 'LKR',
    durationDays: 90,
    sortOrder: 3,
    recommended: 1,
    status: 'active',
    featureKeys: fullPrepFeatureKeys,
  },
  {
    slug: 'master-prep-6m',
    name: 'Master Prep - 1 Year',
    description: '12 months of complete preparation with the best long-term value.',
    regularPrice: discountRegularPrice(14990),
    offerPrice: 14990,
    offerEnabled: 1,
    currency: 'LKR',
    // A YEAR, not six months. The slug still says 6m and deliberately stays
    // that way: slugs are the identity key that APPLE_IAP_PRODUCTS and
    // seedDefaultPlans match on, so renaming one orphans the live row.
    durationDays: 365,
    sortOrder: 4,
    recommended: 0,
    status: 'active',
    featureKeys: [...fullPrepFeatureKeys, 'dynamic_quiz_randomization'],
  },
  {
    slug: 'single-course-3m',
    name: 'Single Course',
    description: '3 months of complete prep for one course of your choice. Lessons, AI notes, full MCQ bank, practice and exam mode.',
    regularPrice: discountRegularPrice(3990),
    offerPrice: 3990,
    offerEnabled: 1,
    currency: 'LKR',
    durationDays: 90,
    sortOrder: 5,
    recommended: 0,
    status: 'active',
    featureKeys: fullPrepFeatureKeys,
  },
] as const;

/// Apple StoreKit product id → the plan that backs it.
///
/// The plan supplies `duration_days`, which is what turns an Apple purchase into
/// a `user_subscriptions.end_date`. Every product maps to one of the existing
/// public plans — there is no on-demand plan creation here any more.
///
/// A product with no row in `plans` carrying its id is REJECTED at redemption
/// with "This purchase does not match a known plan." That is what happened to
/// the yearly product: it pointed at a slug (`annual-prep-1y`) that never
/// existed, so every yearly purchase 400'd after Apple had already taken it.
/// Yearly now maps to Master Prep, which is the 365-day plan.
///
/// The old `createIfMissing` fallback was removed rather than repointed. It
/// would have inserted a second, inactive "Annual Prep" plan and then failed on
/// the UNIQUE index `uniq_plans_apple_product` — the yearly id already belongs
/// to Master Prep — leaving a junk plan in the admin list and a logged error on
/// every boot. The admin panel's product-id field is the supported way to remap.
export const APPLE_IAP_PRODUCTS = [
  {
    productId: 'app.xyndrome.lk.weekly',
    slug: 'quick-revision-7d',
    durationDays: 7,
  },
  {
    productId: 'app.xyndrome.lk.monthly',
    slug: 'monthly-prep-1m',
    durationDays: 30,
  },
  {
    productId: 'app.xyndrome.lk.quarterly',
    slug: 'complete-prep-3m',
    durationDays: 90,
  },
  {
    productId: 'app.xyndrome.lk.yearly',
    slug: 'master-prep-6m',
    durationDays: 365,
  },
] as const;
