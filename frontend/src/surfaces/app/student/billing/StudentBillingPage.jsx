import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { fetchStudentCourses } from '../../../../shared/api/courses.api.js';
import { fetchMySubscription, requestSubscription } from '../../../../shared/api/subscriptions.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { AppHeader } from '../../../../shared/layout/AppHeader.jsx';
import { cx, statusPill, ui } from '../../../../shared/styles/tailwindClasses.js';

function featureMessageForKey(featureKey) {
  if (featureKey === 'aiNotes' || featureKey === 'notesCanvasStudyMode') {
    return 'Lessons study mode is included with selected subscriptions.';
  }
  if (featureKey === 'advancedInsights' || featureKey === 'performanceAnalytics') {
    return 'Your current subscription does not include advanced performance analytics yet.';
  }
  if (featureKey === 'examMode') {
    return 'Your current subscription does not include exam mode yet.';
  }
  if (featureKey === 'practiceMode') {
    return 'Your current subscription does not include practice mode yet.';
  }
  if (featureKey === 'aiQuizGenerator') {
    return 'Your current subscription does not include the AI quiz generator yet.';
  }
  return '';
}

const featureKeyAliases = {
  aiNotes: ['notes_canvas_study_mode'],
  notesAccess: ['notes_canvas_study_mode'],
  notesCanvasStudyMode: ['notes_canvas_study_mode'],
  lessonsAccess: ['lessons_access_full', 'lessons_access_limited', 'notes_canvas_study_mode'],
  advancedInsights: ['performance_analytics', 'weak_area_analysis', 'progress_tracking_advanced'],
  analytics: ['performance_analytics', 'weak_area_analysis', 'progress_tracking_advanced'],
  performanceAnalytics: ['performance_analytics'],
  weakAreaAnalysis: ['weak_area_analysis'],
  practiceMode: ['practice_mode'],
  examMode: ['exam_mode'],
  aiTools: ['ai_quiz_generator'],
  aiQuizGenerator: ['ai_quiz_generator'],
  resultsTracking: ['results_tracking'],
  downloadMaterials: ['download_materials'],
  reportQuestion: ['report_question'],
  pastPaperAccess: ['past_paper_access'],
  mockPaperAccess: ['mock_paper_access'],
};

const comparisonRows = [
  { label: 'Lessons', note: 'Notes and lesson library access', keys: ['lessons_access_full', 'lessons_access_limited', 'notes_canvas_study_mode'] },
  { label: 'Q-Bank', note: 'Question bank and topic practice', keys: ['question_bank_full', 'question_bank_limited'] },
  { label: 'Practice mode', note: 'Untimed practice quizzes', keys: ['practice_mode'] },
  { label: 'Exam mode', note: 'Timed exam-style attempts', keys: ['exam_mode'] },
  { label: 'Study mode', note: 'Focused lesson reading workspace', keys: ['notes_canvas_study_mode'] },
  { label: 'Results', note: 'Attempt history and review', keys: ['results_tracking'] },
  { label: 'Analytics', note: 'Weak areas and progress insights', keys: ['performance_analytics', 'weak_area_analysis', 'progress_tracking_advanced'] },
  { label: 'AI tools', note: 'AI quiz generation tools', keys: ['ai_quiz_generator'] },
];

const recommendedPlanSlugs = ['quick-revision-7d', 'monthly-prep-1m', 'complete-prep-3m', 'master-prep-6m'];

const planMarketing = {
  'quick-revision-7d': {
    badge: 'Trial',
    headline: 'Best for last-minute MCQ practice.',
    cta: 'Start quick revision',
  },
  'monthly-prep-1m': {
    badge: 'Starter',
    headline: 'Best for a focused month of study.',
    cta: 'Start monthly prep',
  },
  'complete-prep-3m': {
    badge: 'Most Popular',
    headline: 'Best balance of time, price, and full preparation.',
    cta: 'Choose complete prep',
  },
  'master-prep-6m': {
    badge: 'Best Value',
    headline: 'Lowest monthly cost for long-term preparation.',
    cta: 'Choose best value',
  },
};

const customCourseOptions = [
  { value: 'single', label: 'One Course', note: 'Best when one course needs focused work.' },
  { value: 'multi', label: '3 Courses', note: 'Good for a few weaker courses.' },
  { value: 'all', label: 'All Courses', note: 'Full ERPM course coverage.' },
];

const customContentOptions = [
  { value: 'mcq', label: 'MCQ Only', note: 'Questions, quizzes, practice, and exam mode.' },
  { value: 'lessons', label: 'Lessons Only', note: 'Lessons, notes, and study mode.' },
  { value: 'full', label: 'Lessons + MCQ', note: 'Complete learning and revision.' },
];

const customDurationOptions = [
  { value: '7d', label: '7 Days' },
  { value: '1m', label: '1 Month' },
  { value: '3m', label: '3 Months' },
  { value: '6m', label: '6 Months' },
];

function planHasAnyFeature(plan, keys) {
  const planKeys = Array.isArray(plan?.featureKeys) ? plan.featureKeys : [];
  return keys.some((key) => planKeys.includes(key));
}

function getSavingsPercent(plan) {
  const regular = Number(plan?.regularPrice || 0);
  const effective = Number(plan?.effectivePrice || 0);
  if (!regular || !effective || regular <= effective) return 0;
  return Math.round(((regular - effective) / regular) * 100);
}

function getPlanEndDate(plan) {
  const days = Number(plan?.durationDays || 0);
  if (!days) return '';
  const date = new Date();
  date.setDate(date.getDate() + Math.max(1, days) - 1);
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatPlanPrice(plan) {
  return `${plan.currency} ${Number(plan.effectivePrice || 0).toFixed(2)}`;
}

function getPlanSummary(plan) {
  const featureCount = Array.isArray(plan?.enabledFeatures) ? plan.enabledFeatures.filter(Boolean).length : 0;
  return `${Number(plan?.durationDays || 0)} days${featureCount ? ` • ${featureCount} features` : ''}`;
}

function formatRequestDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function requestTone(status) {
  if (status === 'approved') {
    return {
      card: 'border-line-soft bg-surface-1',
      badge: 'bg-brand-success/12 text-brand-success',
      title: 'APPROVED',
    };
  }
  if (status === 'rejected') {
    return {
      card: 'border-brand-error/25 bg-brand-error/8',
      badge: 'bg-brand-error/10 text-brand-error',
      title: 'REJECTED',
    };
  }
  if (status === 'cancelled') {
    return {
      card: 'border-line-soft bg-surface-1',
      badge: 'bg-surface-2 text-ink-muted',
      title: 'CANCELLED',
    };
  }
  return {
    card: 'border-amber-500/25 bg-amber-500/8',
    badge: 'bg-amber-500/12 text-amber-700 dark:text-amber-300',
    title: 'WAITING',
  };
}

const billingUi = {
  planCard:
    'grid gap-4 rounded-xl border-line-soft bg-surface-card p-4 shadow-sm max-[520px]:gap-3 max-[520px]:rounded-lg max-[520px]:p-3.5',
  cardBadges:
    'flex min-h-7 flex-wrap items-center gap-2 max-[520px]:gap-1.5 [&_span]:max-[520px]:min-h-[24px] [&_span]:max-[520px]:px-2 [&_span]:max-[520px]:text-[10px]',
  planTitle:
    'm-0 text-lg font-extrabold leading-tight text-ink-strong max-[520px]:text-[16px]',
  planDescription:
    'm-0 mt-1 line-clamp-2 text-[13px] leading-relaxed text-ink-soft max-[520px]:text-[12.5px]',
  planPriceBlock:
    'grid gap-1 border-y border-line-soft py-4 max-[520px]:py-3',
  planPrice:
    'text-2xl font-extrabold leading-none text-ink-strong max-[520px]:text-[22px]',
  planFeatureList:
    'grid gap-2 text-[13px] font-semibold text-ink-medium max-[520px]:gap-1.5 max-[520px]:text-[12.5px]',
  mobileToolbar:
    'mb-4 grid grid-cols-2 gap-2 max-[440px]:grid-cols-1 [&_button]:w-full',
  comparisonDesktop:
    'overflow-x-auto rounded-lg border border-line-soft bg-surface-card max-[760px]:hidden',
  comparisonMobile:
    'hidden gap-3 max-[760px]:grid',
  comparisonPlanCard:
    'grid gap-3 rounded-xl border border-line-soft bg-surface-card p-3.5 shadow-xs',
  comparisonFeatureGrid:
    'grid grid-cols-2 gap-2 max-[420px]:grid-cols-1',
  comparisonFeature:
    'rounded-lg border border-line-soft bg-surface-1 px-3 py-2',
  historyDesktop:
    'max-[760px]:hidden',
  historyMobile:
    'hidden gap-3 max-[760px]:grid',
};

export function StudentBillingPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const customPlanSearch = new URLSearchParams(location.search);
  const shouldOpenCustomPlanner = customPlanSearch.get('custom') === '1';
  const customRequestMode = customPlanSearch.get('request') === '1';
  const [billing, setBilling] = useState({
    currentSubscription: null,
    history: [],
    availablePlans: [],
    requests: [],
    payment: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [requestingPlanId, setRequestingPlanId] = useState(null);
  const [payingPlanId, setPayingPlanId] = useState(null);
  const [customPlan, setCustomPlan] = useState({ subject: 'all', content: 'full', duration: '3m' });
  const [customCourseIds, setCustomCourseIds] = useState([]);
  const [courseOptions, setCourseOptions] = useState([]);
  const [customModalOpen, setCustomModalOpen] = useState(false);

  useEffect(() => {
    load();
    loadCourseOptions();
  }, []);

  useEffect(() => {
    if (!shouldOpenCustomPlanner) return;
    setCustomModalOpen(true);
    window.setTimeout(() => {
      document.getElementById('custom-plan-builder')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 120);
  }, [shouldOpenCustomPlanner]);

  async function load() {
    try {
      const data = await fetchMySubscription();
      setBilling({
        currentSubscription: data?.currentSubscription || null,
        history: Array.isArray(data?.history) ? data.history : [],
        availablePlans: Array.isArray(data?.availablePlans) ? data.availablePlans : [],
        requests: Array.isArray(data?.requests) ? data.requests : [],
        payment: data?.payment || null,
      });
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Unable to load subscription details'));
    } finally {
      setLoading(false);
    }
  }

  async function loadCourseOptions() {
    try {
      const courses = await fetchStudentCourses({ force: true });
      const courseItems = (Array.isArray(courses) ? courses : [])
        .map((course) => ({
          id: Number(course.id),
          label: course.courseTitle || course.title || course.name || `Course ${course.id}`,
          subtitle: course.description || '',
        }))
        .filter((course) => course.id > 0 && course.label);
      const unique = Array.from(new Map(courseItems.map((course) => [course.id, course])).values());
      setCourseOptions(unique);
    } catch {
      setCourseOptions([]);
    }
  }

  const current = billing.currentSubscription;
  const availablePlans = (Array.isArray(billing.availablePlans) ? billing.availablePlans : []).filter(Boolean);
  const history = (Array.isArray(billing.history) ? billing.history : []).filter(Boolean);
  const requests = (Array.isArray(billing.requests) ? billing.requests : []).filter(Boolean);
  const lockedFeature = location.state?.lockedFeature || '';
  const purchaseScope = location.state?.accessScope || '';
  const purchaseCourseIds = Array.isArray(location.state?.courseIds) ? location.state.courseIds.map(Number).filter(Boolean) : [];
  const purchaseLessonIds = Array.isArray(location.state?.lessonIds) ? location.state.lessonIds.map(Number).filter(Boolean) : [];
  const purchaseSelectionNote = String(location.state?.customSelectionNote || '').trim();
  const upgradeMessage = featureMessageForKey(lockedFeature);
  const lockedFeatureKeys = featureKeyAliases[lockedFeature] || [];

  const recommendedPlanId = useMemo(() => {
    const recommended = availablePlans.find((plan) => plan?.recommended);
    return recommended?.id || availablePlans.find((plan) => plan?.slug === 'complete-prep-3m')?.id || null;
  }, [availablePlans]);

  const recommendedPlans = useMemo(() => {
    return recommendedPlanSlugs
      .map((slug) => availablePlans.find((plan) => plan?.slug === slug))
      .filter(Boolean);
  }, [availablePlans]);

  const selectedCustomPlan = useMemo(() => {
    const slug = `custom-${customPlan.subject}-${customPlan.content}-${customPlan.duration}`;
    return availablePlans.find((plan) => plan?.slug === slug) || null;
  }, [availablePlans, customPlan]);

  const comparisonPlans = recommendedPlans.length ? recommendedPlans : availablePlans.slice(0, 4);

  const pendingPlanIds = useMemo(() => new Set(
    requests
      .filter((request) => request?.status === 'pending')
      .map((request) => Number(request.planId))
  ), [requests]);
  const currentDaysRemaining = Math.max(0, Number(current?.daysRemaining || 0));
  const currentDurationDays = Math.max(1, Number(current?.planDurationDays || 0));
  const currentProgressPercent = current
    ? Math.max(0, Math.min(100, Math.round((currentDaysRemaining / currentDurationDays) * 100)))
    : 0;

  async function handleRequestPlan(plan, messageOverride = '', extraState = {}) {
    setError('');
    setSuccess('');
    setRequestingPlanId(plan.id);
    try {
      await requestSubscription({
        planId: plan.id,
        message: messageOverride || (current ? `Requesting upgrade from ${current.planName || 'current plan'} to ${plan.name}.` : `Requesting subscription to ${plan.name}.`),
        accessScope: extraState.accessScope || 'all',
        courseIds: extraState.accessScope === 'courses' ? extraState.courseIds || [] : [],
        lessonIds: extraState.accessScope === 'lessons' ? extraState.lessonIds || [] : [],
      });
      setSuccess(`Request sent for ${plan.name}. An admin can review and activate it.`);
      await load();
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Unable to send subscription request'));
    } finally {
      setRequestingPlanId(null);
    }
  }

  function selectedCourseLimit(courseScope = customPlan.subject) {
    if (courseScope === 'single') return 1;
    if (courseScope === 'multi') return 3;
    return 0;
  }

  const selectedCourseNames = useMemo(() => {
    const selected = new Set(customCourseIds.map(Number));
    return courseOptions.filter((course) => selected.has(Number(course.id))).map((course) => course.label);
  }, [customCourseIds, courseOptions]);

  const customSelectionNote = useMemo(() => {
    if (!selectedCustomPlan) return '';
    if (customPlan.subject === 'all') return 'Selected courses: All courses';
    return selectedCourseNames.length ? `Selected courses: ${selectedCourseNames.join(', ')}` : '';
  }, [customPlan.subject, selectedCustomPlan, selectedCourseNames]);

  function handleCustomCourseToggle(courseId) {
    const limit = selectedCourseLimit();
    setCustomCourseIds((current) => {
      const exists = current.includes(courseId);
      if (exists) return current.filter((id) => id !== courseId);
      if (limit && current.length >= limit) return [...current.slice(1), courseId];
      return [...current, courseId];
    });
  }

  function handleCustomScopeChange(value) {
    setCustomPlan((current) => ({ ...current, subject: value }));
    setCustomCourseIds((current) => {
      const limit = selectedCourseLimit(value);
      return limit ? current.slice(0, limit) : [];
    });
  }

  const purchaseCheckoutState = useMemo(() => {
    if (purchaseScope === 'courses' && purchaseCourseIds.length) {
      return {
        accessScope: 'courses',
        courseIds: purchaseCourseIds,
        lessonIds: [],
        customSelectionNote: purchaseSelectionNote || `Selected courses: ${purchaseCourseIds.join(', ')}`,
      };
    }
    if (purchaseScope === 'lessons' && purchaseLessonIds.length) {
      return {
        accessScope: 'lessons',
        courseIds: [],
        lessonIds: purchaseLessonIds,
        customSelectionNote: purchaseSelectionNote || `Selected lessons: ${purchaseLessonIds.join(', ')}`,
      };
    }
    return {};
  }, [purchaseCourseIds, purchaseLessonIds, purchaseScope, purchaseSelectionNote]);

  const customCheckoutState = useMemo(() => {
    if (!selectedCustomPlan) return {};
    if (customPlan.subject === 'all') {
      return {
        accessScope: 'all',
        courseIds: [],
        lessonIds: [],
        customSelectionNote,
      };
    }
    return {
      accessScope: 'courses',
      courseIds: customCourseIds,
      lessonIds: [],
      customSelectionNote,
    };
  }, [customCourseIds, customPlan.subject, customSelectionNote, selectedCustomPlan]);

  function handleCheckoutPlan(plan, extraState = {}) {
    setPayingPlanId(plan.id);
    navigate(`/subscriptions/checkout/${plan.id}`, { state: { ...purchaseCheckoutState, ...extraState } });
  }

  function scrollToComparison() {
    document.getElementById('plan-comparison')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function optionCardClass(isSelected) {
    return cx(
      'flex min-h-[82px] cursor-pointer items-start gap-3 rounded-lg border bg-surface-1 p-3 text-left shadow-xs transition-[border-color,background,box-shadow,transform] hover:-translate-y-0.5 hover:border-brand-primary/35',
      isSelected
        ? 'border-brand-primary/60 bg-[color-mix(in_srgb,var(--surface-1)_84%,var(--color-primary-light))] shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-primary)_12%,transparent)]'
        : 'border-line-soft'
    );
  }

  function optionTickClass(isSelected) {
    return cx(
      'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border text-[11px] font-black',
      isSelected
        ? 'border-brand-primary/40 bg-[var(--color-primary-light)] text-brand-primary'
        : 'border-line-medium bg-surface-2 text-transparent'
    );
  }

  function renderPlanCard(plan, options = {}) {
    const isCurrent = current?.planId === plan.id;
    const isRecommended = recommendedPlanId === plan.id || options.highlight;
    const hasOffer = Boolean(plan.offerEnabled && plan.offerPrice !== null && Number(plan.regularPrice || 0) > Number(plan.effectivePrice || 0));
    const savingsPercent = getSavingsPercent(plan);
    const planEndDate = getPlanEndDate(plan);
    const marketing = planMarketing[plan.slug] || {};
    const primaryBadge = options.badge || marketing.badge || (isRecommended ? 'Most Popular' : '');
    const canOpenCheckout = !options.requestOnly && !isCurrent && Number(plan.effectivePrice || 0) > 0;
    const featureLabels = (Array.isArray(plan.enabledFeatures) ? plan.enabledFeatures : [])
      .map((feature) => feature?.featureName)
      .filter(Boolean)
      .slice(0, 3);

    return (
      <article className={cx(
        ui.compactPanelCard,
        billingUi.planCard,
        isRecommended && 'border-brand-primary/35 ring-2 ring-brand-primary/10',
        isCurrent && 'border-brand-success/35'
      )} key={plan.id}>
        <div className="grid gap-3">
          <div className={billingUi.cardBadges}>
            {isCurrent ? <span className={statusPill('active')}>Current</span> : null}
            {primaryBadge ? <span className={ui.tablePill}>{primaryBadge}</span> : null}
            {hasOffer ? <span className={ui.tablePill}>{savingsPercent ? `${savingsPercent}% off` : 'Offer'}</span> : null}
          </div>
          <div>
            <h3 className={billingUi.planTitle}>{plan.name}</h3>
            <p className={billingUi.planDescription}>{plan.description || 'Subscription plan description.'}</p>
          </div>
        </div>

        <div className={billingUi.planPriceBlock}>
          <div className="flex flex-wrap items-baseline gap-2">
            <strong className={billingUi.planPrice}>{formatPlanPrice(plan)}</strong>
            <span className="text-xs font-bold text-ink-muted">/ {plan.durationDays} days</span>
          </div>
          {hasOffer ? (
            <span className="text-xs font-semibold text-ink-muted">
              Regular <span className="line-through">{plan.currency} {Number(plan.regularPrice).toFixed(2)}</span>
            </span>
          ) : null}
          {isCurrent && planEndDate ? <span className="text-xs font-semibold text-ink-muted">Access until {planEndDate}</span> : null}
        </div>

        <div className={billingUi.planFeatureList}>
          {(featureLabels.length ? featureLabels : [plan.slug?.includes('quick-revision') ? 'MCQ practice' : 'Lessons and practice']).map((label) => (
            <span className="flex items-center gap-2" key={label}>
              <span className="grid size-4 shrink-0 place-items-center rounded-full bg-brand-primary/10 text-[10px] font-black text-brand-primary">✓</span>
              <span className="min-w-0 truncate">{label}</span>
            </span>
          ))}
        </div>

        <div className="mt-auto grid gap-2">
          {canOpenCheckout ? (
            <button
              type="button"
              className={ui.primaryAction}
              disabled={payingPlanId === plan.id}
              onClick={() => handleCheckoutPlan(plan, options.checkoutState || {})}
            >
              {payingPlanId === plan.id ? 'Opening checkout...' : 'Choose plan'}
            </button>
          ) : null}
          {options.requestOnly ? (
            <button
              type="button"
              className={pendingPlanIds.has(Number(plan.id)) ? ui.secondaryAction : ui.primaryAction}
              disabled={pendingPlanIds.has(Number(plan.id)) || requestingPlanId === plan.id || payingPlanId === plan.id}
              onClick={() => handleRequestPlan(plan, options.requestMessage || '', options.checkoutState || {})}
            >
              {pendingPlanIds.has(Number(plan.id)) ? 'Request pending' : requestingPlanId === plan.id ? 'Sending...' : options.requestLabel || 'Ask admin'}
            </button>
          ) : null}
        </div>
      </article>
    );
  }

  return (
    <main className="dashboard-page study-hub-page student-billing-page">
      <section className="study-hub-shell">
        <AppHeader
          title="Subscriptions"
          subtitle="Plan Access"
        />

        {error ? <div className={ui.feedbackError}>{error}</div> : null}
        {success ? <div className={ui.feedbackSuccess}>{success}</div> : null}
        {upgradeMessage ? <div className={ui.feedbackError}>{upgradeMessage}</div> : null}
        {purchaseSelectionNote ? <div className={ui.feedbackSuccess}>{purchaseSelectionNote}</div> : null}

        <section className={cx(ui.panelCard, 'max-[520px]:p-3.5')}>
          <div className={ui.panelTop}>
            <div>
              <h2 className={ui.panelTitle}>Current subscription</h2>
              <p className={ui.panelText}>Your active plan, billing window, and currently enabled study features.</p>
            </div>
          </div>

          {loading ? <div className={ui.emptyBox}>Loading subscription info...</div> : null}
          {!loading && !current ? (
            <div className={ui.emptyBox}>No subscription has been assigned to your account yet.</div>
          ) : null}
          {!loading && current ? (
            <article className="overflow-hidden rounded-lg border border-line-soft bg-surface-card shadow-sm">
              <div className="grid gap-5 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-primary)_10%,var(--surface-card)),var(--surface-card)_48%,color-mix(in_srgb,var(--color-teal)_8%,var(--surface-card)))] p-5 max-[520px]:gap-4 max-[520px]:p-4">
                <div className="flex flex-wrap items-start justify-between gap-4 max-[520px]:gap-3">
                  <div className="min-w-0">
                    <h3 className="mb-1 text-2xl font-extrabold leading-tight text-ink-strong max-[520px]:text-[20px]">{current.planName}</h3>
                    <p className="m-0 text-[13px] font-semibold text-ink-soft">Your current LMS subscription package</p>
                  </div>
                  <div className="min-w-[190px] rounded-lg border border-line-soft bg-surface-card/85 px-4 py-3 text-right shadow-xs backdrop-blur max-[640px]:w-full max-[640px]:text-left">
                    <span className="block text-[11px] font-extrabold uppercase tracking-[0.1em] text-ink-muted">Paid amount</span>
                    <strong className="mt-1 block text-2xl font-extrabold text-brand-primary">
                      {current.planCurrency} {Number(current.planEffectivePrice).toFixed(2)}
                    </strong>
                    {current.planOfferEnabled && current.planOfferPrice !== null ? (
                      <span className="mt-1 block text-xs font-semibold text-ink-muted">
                        Regular <span className="line-through">{current.planCurrency} {Number(current.planRegularPrice).toFixed(2)}</span>
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-2">
                  <div className="flex items-end justify-between gap-3 max-[420px]:items-start">
                    <div>
                      <span className="block text-[11px] font-extrabold uppercase tracking-[0.1em] text-ink-muted">Access remaining</span>
                      <strong className="mt-1 block text-lg text-ink-strong">
                        {current.computedStatus === 'expired' ? 'Expired' : `${currentDaysRemaining} day(s) left`}
                      </strong>
                    </div>
                    <span className="text-xs font-bold text-ink-muted">{currentProgressPercent}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                    <span
                      className="block h-full rounded-full bg-[linear-gradient(90deg,var(--brand-primary-start),var(--brand-primary-end))]"
                      style={{ width: `${currentProgressPercent}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 p-5 max-[760px]:grid-cols-1 max-[520px]:p-4">
                <div className="hidden rounded-lg border border-line-soft bg-surface-1 px-4 py-3 max-[520px]:grid max-[520px]:grid-cols-2 max-[520px]:gap-3">
                  <div className="min-w-0 border-r border-line-soft pr-3">
                    <span className="block text-[10px] font-extrabold uppercase tracking-[0.1em] text-ink-muted">Start date</span>
                    <strong className="mt-1 block truncate text-[13px] text-ink-strong">{current.startDate || '-'}</strong>
                  </div>
                  <div className="min-w-0 pl-1">
                    <span className="block text-[10px] font-extrabold uppercase tracking-[0.1em] text-ink-muted">End date</span>
                    <strong className="mt-1 block truncate text-[13px] text-ink-strong">{current.endDate || '-'}</strong>
                  </div>
                </div>
                <div className="rounded-lg border border-line-soft bg-surface-1 px-4 py-3 max-[520px]:hidden">
                  <span className="block text-[11px] font-extrabold uppercase tracking-[0.1em] text-ink-muted">Start date</span>
                  <strong className="mt-1 block text-sm text-ink-strong">{current.startDate || '-'}</strong>
                </div>
                <div className="rounded-lg border border-line-soft bg-surface-1 px-4 py-3 max-[520px]:hidden">
                  <span className="block text-[11px] font-extrabold uppercase tracking-[0.1em] text-ink-muted">End date</span>
                  <strong className="mt-1 block text-sm text-ink-strong">{current.endDate || '-'}</strong>
                </div>
                <div className="rounded-lg border border-line-soft bg-surface-1 px-4 py-3 max-[520px]:hidden">
                  <span className="block text-[11px] font-extrabold uppercase tracking-[0.1em] text-ink-muted">Remaining</span>
                  <strong className="mt-1 block text-sm text-ink-strong">
                    {current.computedStatus === 'expired' ? 'Expired' : `${Math.max(0, Number(current.daysRemaining || 0))} day(s)`}
                  </strong>
                </div>
              </div>

              {current.computedStatus === 'expired' ? (
                <div className="mx-5 rounded-md border border-brand-error/20 bg-brand-error/10 px-3 py-2 text-[13px] font-bold text-brand-error">
                  This subscription has expired.
                </div>
              ) : current.isExpiringSoon ? (
                <div className="mx-5 rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[13px] font-bold text-amber-700 dark:text-amber-300 max-[520px]:hidden">
                  Expires in {currentDaysRemaining} day(s). Request renewal early.
                </div>
              ) : null}

            </article>
          ) : null}
        </section>

        <section className={cx(ui.panelCard, 'max-[520px]:p-3.5')}>
          <div className={ui.panelTop}>
            <div>
              <h2 className={ui.panelTitle}>Recommended plans</h2>
              <p className={ui.panelText}>Pick by study timeline. Complete Prep is the best fit for most ERPM students.</p>
            </div>
          </div>

          {loading ? <div className={ui.emptyBox}>Loading plans...</div> : null}
          {!loading && availablePlans.length === 0 ? (
            <div className={ui.emptyBox}>No subscription plans are available right now.</div>
          ) : null}
          {!loading ? (
            <div className={billingUi.mobileToolbar}>
              <button type="button" className={ui.secondaryAction} onClick={scrollToComparison}>
                Compare plans
              </button>
              <button type="button" className={ui.secondaryAction} onClick={() => setCustomModalOpen(true)}>
                Create custom plan
              </button>
            </div>
          ) : null}
          {!loading ? (
            <div className="grid grid-cols-4 gap-4 max-[1180px]:grid-cols-2 max-[640px]:grid-cols-1 max-[520px]:gap-3">
              {(recommendedPlans.length ? recommendedPlans : availablePlans.filter((plan) => plan.slug !== 'free').slice(0, 4)).map((plan) => renderPlanCard(plan, {
                highlight: plan.slug === 'complete-prep-3m',
                badge: plan.slug === 'complete-prep-3m' ? 'Most Popular' : undefined,
              }))}
            </div>
          ) : null}
        </section>

        <section className={cx(ui.panelCard, 'max-[520px]:p-3.5')} id="plan-comparison">
          <div className={ui.panelTop}>
            <div>
              <h2 className={ui.panelTitle}>Plan comparison</h2>
              <p className={ui.panelText}>A quick view of the major LMS areas included in each plan.</p>
            </div>
          </div>

          <div className={billingUi.comparisonDesktop}>
            <table className="min-w-[760px] w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-line-soft bg-surface-2/70">
                  <th className="sticky left-0 z-[1] min-w-[220px] bg-surface-2/95 px-4 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.12em] text-ink-muted">Feature</th>
                  {comparisonPlans.map((plan) => (
                    <th className="min-w-[150px] px-4 py-3 text-center" key={plan.id}>
                      <span className="block text-[13px] font-extrabold text-ink-strong">{plan.name}</span>
                      <span className="mt-1 block text-[11px] font-bold text-ink-muted">{formatPlanPrice(plan)}</span>
                      <span className="mt-0.5 block text-[10px] font-semibold text-ink-muted">{getPlanSummary(plan)}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr className="border-b border-line-soft last:border-b-0 hover:bg-surface-2/50" key={row.label}>
                    <td className="sticky left-0 z-[1] bg-surface-card px-4 py-3 text-left">
                      <strong className="block text-[13px] text-ink-strong">{row.label}</strong>
                      <span className="mt-0.5 block text-[11px] font-semibold text-ink-muted">{row.note}</span>
                    </td>
                    {comparisonPlans.map((plan) => (
                      <td className="px-4 py-3 text-center" key={`${row.label}-${plan.id}`}>
                        {planHasAnyFeature(plan, row.keys) ? (
                          <span className="mx-auto inline-flex size-7 items-center justify-center rounded-full bg-brand-success/12 text-[15px] font-black leading-none text-brand-success" aria-label="Included">✓</span>
                        ) : (
                          <span className="mx-auto inline-flex size-7 items-center justify-center rounded-full bg-brand-error/10 text-[17px] font-black leading-none text-brand-error" aria-label="Not included">×</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={billingUi.comparisonMobile}>
            {comparisonPlans.map((plan) => (
              <article className={billingUi.comparisonPlanCard} key={`mobile-${plan.id}`}>
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="m-0 text-[15px] font-extrabold leading-tight text-ink-strong">{plan.name}</h3>
                    <p className="m-0 mt-1 text-[12px] font-bold text-ink-muted">{formatPlanPrice(plan)} • {getPlanSummary(plan)}</p>
                  </div>
                  {plan.id === recommendedPlanId ? <span className={ui.tablePill}>Best fit</span> : null}
                </div>
                <div className={billingUi.comparisonFeatureGrid}>
                  {comparisonRows.map((row) => {
                    const included = planHasAnyFeature(plan, row.keys);
                    return (
                      <div className={billingUi.comparisonFeature} key={`${plan.id}-${row.label}`}>
                        <div className="flex items-center justify-between gap-2">
                          <strong className="text-[12.5px] text-ink-strong">{row.label}</strong>
                          <span className={cx(
                            'inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[14px] font-black leading-none',
                            included ? 'bg-brand-success/12 text-brand-success' : 'bg-brand-error/10 text-brand-error'
                          )} aria-label={included ? 'Included' : 'Not included'}>
                            {included ? '✓' : '×'}
                          </span>
                        </div>
                        <p className="m-0 mt-1 line-clamp-2 text-[11px] leading-snug text-ink-muted">{row.note}</p>
                      </div>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        </section>

        {customModalOpen ? (
          <div id="custom-plan-builder" className={cx(ui.modalBackdrop, 'grid place-items-center p-4 max-[520px]:items-end max-[520px]:p-0')} role="dialog" aria-modal="true" aria-label="Customize subscription plan">
            <div className={cx(ui.entityModal, 'mx-auto max-h-[92dvh] w-full max-w-[980px] overflow-y-auto max-[520px]:max-h-[calc(100dvh-env(safe-area-inset-top,0px)-10px)] max-[520px]:rounded-b-none')}>
              <div className={ui.entityModalTop}>
                <div>
                  <h2 className={ui.entityModalTitle}>{customRequestMode ? 'Create your custom subscription' : 'Build your custom plan'}</h2>
                  <p className={ui.entityModalText}>{customRequestMode ? 'Choose the courses, content, and duration you need. Send it to admin for a package made around your study plan.' : 'Choose the access, content, and duration. Tick the option you want.'}</p>
                </div>
                <button type="button" className={ui.iconButton} onClick={() => setCustomModalOpen(false)} aria-label="Close custom plan popup">x</button>
              </div>
              <div className="grid gap-4 px-6 pb-[calc(24px+env(safe-area-inset-bottom,0px))] pt-5 max-[640px]:px-4 max-[520px]:gap-3 max-[520px]:pt-4">
                <div className="grid gap-5 max-[520px]:gap-4">
                  <div className="grid gap-2">
                    <strong className="text-[13px] text-ink-strong">1. Course access</strong>
                    <div className="grid grid-cols-3 gap-3 max-[760px]:grid-cols-1">
                      {customCourseOptions.map((option) => {
                        const isSelected = customPlan.subject === option.value;
                        return (
                          <label className={optionCardClass(isSelected)} key={option.value}>
                            <input
                              className="sr-only"
                              type="radio"
                              name="custom-course-access"
                              checked={isSelected}
                              onChange={() => handleCustomScopeChange(option.value)}
                            />
                            <span className={optionTickClass(isSelected)}>✓</span>
                            <span className="grid gap-1">
                              <span className="text-[13px] font-extrabold text-ink-strong">{option.label}</span>
                              <span className="text-[12px] leading-relaxed text-ink-soft">{option.note}</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <strong className="text-[13px] text-ink-strong">2. Content access</strong>
                    <div className="grid grid-cols-3 gap-3 max-[760px]:grid-cols-1">
                      {customContentOptions.map((option) => {
                        const isSelected = customPlan.content === option.value;
                        return (
                          <label className={optionCardClass(isSelected)} key={option.value}>
                            <input
                              className="sr-only"
                              type="radio"
                              name="custom-content-access"
                              checked={isSelected}
                              onChange={() => setCustomPlan((current) => ({ ...current, content: option.value }))}
                            />
                            <span className={optionTickClass(isSelected)}>✓</span>
                            <span className="grid gap-1">
                              <span className="text-[13px] font-extrabold text-ink-strong">{option.label}</span>
                              <span className="text-[12px] leading-relaxed text-ink-soft">{option.note}</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <strong className="text-[13px] text-ink-strong">3. Duration</strong>
                    <div className="grid grid-cols-4 gap-3 max-[760px]:grid-cols-2 max-[420px]:grid-cols-1">
                      {customDurationOptions.map((option) => {
                        const isSelected = customPlan.duration === option.value;
                        return (
                          <label className={cx(optionCardClass(isSelected), 'min-h-[58px] items-center')} key={option.value}>
                            <input
                              className="sr-only"
                              type="radio"
                              name="custom-duration"
                              checked={isSelected}
                              onChange={() => setCustomPlan((current) => ({ ...current, duration: option.value }))}
                            />
                            <span className={optionTickClass(isSelected)}>✓</span>
                            <span className="text-[13px] font-extrabold text-ink-strong">{option.label}</span>
                          </label>
                        );
                      })}
                    </div>
                    <span className={ui.tableSubtext}>The price updates from your selected combination.</span>
                  </div>
                </div>

                {customPlan.subject !== 'all' ? (
                  <div className="grid gap-3 rounded-lg border border-line-soft bg-surface-glass-subtle p-4">
                    <div>
                      <strong className="text-[13px] text-ink-strong">
                        Choose {selectedCourseLimit() === 1 ? '1 course' : 'up to 3 courses'}
                      </strong>
                      <p className="m-0 mt-1 text-[12px] leading-relaxed text-ink-soft">
                        Selected: {selectedCourseNames.length ? selectedCourseNames.join(', ') : 'None yet'}
                      </p>
                    </div>
                    {courseOptions.length ? (
                      <div className="grid grid-cols-2 gap-2 max-[640px]:grid-cols-1">
                        {courseOptions.map((course) => (
                          <label className={optionCardClass(customCourseIds.includes(course.id))} key={course.id}>
                            <input
                              className="sr-only"
                              type="checkbox"
                              checked={customCourseIds.includes(course.id)}
                              onChange={() => handleCustomCourseToggle(course.id)}
                            />
                            <span className={optionTickClass(customCourseIds.includes(course.id))}>✓</span>
                            <span className="grid gap-1">
                              <span className="text-[13px] font-extrabold text-ink-strong">{course.label}</span>
                              {course.subtitle ? <small className="text-[11px] text-ink-soft">{course.subtitle}</small> : null}
                            </span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <div className={ui.emptyBox}>No active courses could be loaded. You can still continue and admin can confirm the course manually.</div>
                    )}
                  </div>
                ) : null}

                {selectedCustomPlan ? (
                  <div className="mx-auto grid w-full max-w-[440px]">
                    {customPlan.subject !== 'all' && selectedCourseLimit() && selectedCourseNames.length === 0 ? (
                      <div className={ui.emptyBox}>Select the course first, then continue to checkout.</div>
                    ) : renderPlanCard(selectedCustomPlan, {
                      badge: 'Custom plan',
                      headline: customRequestMode ? 'Send this selection to admin for confirmation.' : customSelectionNote || 'Your selected custom package.',
                      checkoutState: customCheckoutState,
                      requestOnly: customRequestMode,
                      requestLabel: 'Create my custom package',
                      requestMessage: [
                        current ? `Requesting custom upgrade from ${current.planName || 'current plan'} to ${selectedCustomPlan.name}.` : `Requesting custom subscription: ${selectedCustomPlan.name}.`,
                        customSelectionNote,
                      ].filter(Boolean).join(' '),
                    })}
                  </div>
                ) : (
                  <div className={ui.emptyBox}>This custom plan combination is not available yet.</div>
                )}
              </div>
            </div>
          </div>
        ) : null}

        <section className={cx(ui.panelCard, 'max-[520px]:p-3.5')}>
          <div className={ui.panelTop}>
            <div>
              <h2 className={ui.panelTitle}>Upgrade requests</h2>
              <p className={ui.panelText}>Requests you have sent for plan upgrades or renewals.</p>
            </div>
          </div>

          {!loading && requests.length === 0 ? <div className={ui.emptyBox}>No upgrade requests yet.</div> : null}
          {requests.length ? (
            <div className="grid gap-3">
              {requests.map((request) => {
                const tone = requestTone(request.status);
                return (
                <article className={cx('rounded-lg border p-4 shadow-xs max-[520px]:p-3.5', tone.card)} key={request.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="grid min-w-0 gap-2">
                      <div>
                        <strong className="text-ink-strong">{request.planName}</strong>
                      </div>
                      <div className="grid gap-1 text-[12px] font-semibold text-ink-soft">
                        <span>Requested: {formatRequestDateTime(request.requestedAt)}</span>
                        {request.invoiceId ? <span>Invoice: #{request.invoiceId}</span> : null}
                      </div>
                    </div>
                    <span className={cx('rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.1em]', tone.badge)}>
                      {tone.title}
                    </span>
                  </div>
                </article>
              );
              })}
            </div>
          ) : null}
        </section>

        <section className={cx(ui.panelCard, 'max-[520px]:p-3.5')}>
          <div className={ui.panelTop}>
            <div>
              <h2 className={ui.panelTitle}>Subscription history</h2>
              <p className={ui.panelText}>Your recent subscription assignments, renewals, and status changes.</p>
            </div>
          </div>

          <div className={cx(ui.tableShell, billingUi.historyDesktop)}>
            <table className={ui.modernTable}>
              <thead>
                <tr>
                  <th className={ui.tableHeadCell}>Plan</th>
                  <th className={ui.tableHeadCell}>Dates</th>
                  <th className={ui.tableHeadCell}>Status</th>
                  <th className={ui.tableHeadCell}>Payment</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="4" className={ui.tableEmpty}>Loading history...</td>
                  </tr>
                ) : null}
                {!loading && history.length === 0 ? (
                  <tr>
                    <td colSpan="4" className={ui.tableEmpty}>No subscription history yet.</td>
                  </tr>
                ) : null}
                {!loading && history.map((subscription) => (
                  <tr key={subscription.id}>
                    <td className={ui.tableCell}>
                      <strong>{subscription.planName}</strong>
                      <div className={ui.tableSubtext}>
                        {subscription.planCurrency} {Number(subscription.planEffectivePrice).toFixed(2)}
                      </div>
                    </td>
                    <td className={ui.tableCell}>
                      <strong>{subscription.startDate}</strong>
                      <div className={ui.tableSubtext}>Ends {subscription.endDate}</div>
                    </td>
                    <td className={ui.tableCell}><span className={statusPill(subscription.status)}>{subscription.status}</span></td>
                    <td className={ui.tableCell}><span className={statusPill(subscription.paymentStatus)}>{subscription.paymentStatus}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {loading ? <div className={cx(ui.tableEmpty, billingUi.historyMobile)}>Loading history...</div> : null}
          {!loading && history.length === 0 ? <div className={cx(ui.tableEmpty, billingUi.historyMobile)}>No subscription history yet.</div> : null}
          {!loading && history.length ? (
            <div className={billingUi.historyMobile}>
              {history.map((subscription) => (
                <article className="grid gap-3 rounded-xl border border-line-soft bg-surface-card p-3.5 shadow-xs" key={`mobile-history-${subscription.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <strong className="block text-[14px] leading-tight text-ink-strong">{subscription.planName}</strong>
                      <span className="mt-1 block text-[12px] font-bold text-ink-muted">
                        {subscription.planCurrency} {Number(subscription.planEffectivePrice).toFixed(2)}
                      </span>
                    </div>
                    <span className={statusPill(subscription.status)}>{subscription.status}</span>
                  </div>
                  <div className="grid gap-1 rounded-lg border border-line-soft bg-surface-1 px-3 py-2 text-[12px] font-semibold text-ink-soft">
                    <span><strong className="text-ink-strong">Start:</strong> {subscription.startDate}</span>
                    <span><strong className="text-ink-strong">Ends:</strong> {subscription.endDate}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-ink-muted">Payment</span>
                    <span className={statusPill(subscription.paymentStatus)}>{subscription.paymentStatus}</span>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      </section>
    </main>
  );
}
