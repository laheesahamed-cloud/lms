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

const durations = {
  '7d': { label: '7 Days', days: 7 },
  '1m': { label: '1 Month', days: 30 },
  '3m': { label: '3 Months', days: 90 },
  '6m': { label: '6 Months', days: 180 },
} as const;

const courseAccessLabels = {
  single: 'One Course',
  multi: '3 Courses',
  all: 'All Courses',
} as const;

const contentLabels = {
  mcq: 'MCQ Only',
  lessons: 'Lessons Only',
  full: 'Lessons + MCQ',
} as const;

const contentFeatures = {
  mcq: mcqFeatureKeys,
  lessons: lessonFeatureKeys,
  full: fullPrepFeatureKeys,
} as const;

const customPrices = {
  single: {
    mcq: { '7d': 390, '1m': 990, '3m': 2490, '6m': 3990 },
    lessons: { '7d': 490, '1m': 1290, '3m': 2990, '6m': 4990 },
    full: { '7d': 690, '1m': 1790, '3m': 3990, '6m': 6990 },
  },
  multi: {
    mcq: { '7d': 690, '1m': 1990, '3m': 4490, '6m': 7990 },
    lessons: { '7d': 890, '1m': 2490, '3m': 5490, '6m': 8990 },
    full: { '7d': 1190, '1m': 2990, '3m': 6990, '6m': 10990 },
  },
  all: {
    mcq: { '7d': 990, '1m': 2490, '3m': 5990, '6m': 9990 },
    lessons: { '7d': 1290, '1m': 3490, '3m': 7490, '6m': 12990 },
    full: { '7d': 1490, '1m': 3990, '3m': 8990, '6m': 14990 },
  },
} as const;

function discountRegularPrice(offerPrice: number) {
  if (offerPrice <= 0) return 0;
  return Math.max(offerPrice + 100, Math.ceil((offerPrice * 1.32) / 100) * 100 - 10);
}

const recommendedPlans = [
  {
    slug: 'quick-revision-7d',
    name: 'Quick Revision',
    description: '7 days of all-subject MCQ, quizzes, and exam practice for fast revision.',
    price: 990,
    durationKey: '7d',
    recommended: 0,
    sortOrder: 1,
    featureKeys: mcqFeatureKeys,
  },
  {
    slug: 'monthly-prep-1m',
    name: 'Monthly Prep',
    description: '1 month of all-subject lessons, notes, MCQs, quizzes, practice, and exam mode.',
    price: 3990,
    durationKey: '1m',
    recommended: 0,
    sortOrder: 2,
    featureKeys: fullPrepFeatureKeys,
  },
  {
    slug: 'complete-prep-3m',
    name: 'Complete Prep',
    description: '3 months of complete ERPM preparation. Best for most serious students.',
    price: 8990,
    durationKey: '3m',
    recommended: 1,
    sortOrder: 3,
    featureKeys: fullPrepFeatureKeys,
  },
  {
    slug: 'master-prep-6m',
    name: 'Master Prep',
    description: '6 months of complete preparation with the best long-term value.',
    price: 14990,
    durationKey: '6m',
    recommended: 0,
    sortOrder: 4,
    featureKeys: [
      ...fullPrepFeatureKeys,
      ...premiumExamFeatureKeys,
    ],
  },
] as const;

const customPlanBlueprints = (Object.keys(customPrices) as Array<keyof typeof customPrices>).flatMap((courseAccessKey, courseAccessIndex) =>
  (Object.keys(customPrices[courseAccessKey]) as Array<keyof typeof customPrices[typeof courseAccessKey]>).flatMap((contentKey, contentIndex) =>
    (Object.keys(customPrices[courseAccessKey][contentKey]) as Array<keyof typeof durations>).map((durationKey, durationIndex) => {
      const price = customPrices[courseAccessKey][contentKey][durationKey];
      return {
        slug: `custom-${courseAccessKey}-${contentKey}-${durationKey}`,
        name: `${courseAccessLabels[courseAccessKey]} - ${contentLabels[contentKey]} - ${durations[durationKey].label}`,
        description: `${courseAccessLabels[courseAccessKey]} custom plan with ${contentLabels[contentKey].toLowerCase()} for ${durations[durationKey].label.toLowerCase()}.`,
        regularPrice: discountRegularPrice(price),
        offerPrice: price,
        offerEnabled: 1,
        currency: 'LKR',
        durationDays: durations[durationKey].days,
        sortOrder: 20 + courseAccessIndex * 20 + contentIndex * 4 + durationIndex,
        recommended: 0,
        status: 'active',
        featureKeys: contentFeatures[contentKey],
      };
    })
  )
);

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
  ...recommendedPlans.map((plan) => ({
    slug: plan.slug,
    name: plan.name,
    description: plan.description,
    regularPrice: discountRegularPrice(plan.price),
    offerPrice: plan.price,
    offerEnabled: 1,
    currency: 'LKR',
    durationDays: durations[plan.durationKey].days,
    sortOrder: plan.sortOrder,
    recommended: plan.recommended,
    status: 'active',
    featureKeys: plan.featureKeys,
  })),
  ...customPlanBlueprints,
] as const;
