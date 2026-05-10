import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { fetchStudentCourses } from '../../../api/courses.api.js';
import { fetchMySubscription, requestSubscription } from '../../../api/subscriptions.api.js';
import { getErrorMessage } from '../../../api/client.js';
import { AppHeader } from '../../../components/layout/AppHeader.jsx';
import { cx, statusPill, ui } from '../../../styles/tailwindClasses.js';

function featureMessageForKey(featureKey) {
  if (featureKey === 'aiNotes' || featureKey === 'notesCanvasStudyMode') {
    return 'Your current subscription does not include Lessons study mode yet. Upgrade to unlock that workspace.';
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
  { label: 'Lessons', keys: ['lessons_access_full', 'lessons_access_limited', 'notes_canvas_study_mode'] },
  { label: 'Q-Bank', keys: ['question_bank_full', 'question_bank_limited'] },
  { label: 'Practice', keys: ['practice_mode'] },
  { label: 'Exams', keys: ['exam_mode'] },
  { label: 'Lessons study mode', keys: ['notes_canvas_study_mode'] },
  { label: 'Results', keys: ['results_tracking'] },
  { label: 'Analytics', keys: ['performance_analytics', 'weak_area_analysis', 'progress_tracking_advanced'] },
  { label: 'AI tools', keys: ['ai_quiz_generator'] },
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
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

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
  const paymentSettings = billing.payment || null;
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

  const unlockPlanNames = useMemo(() => {
    if (!lockedFeatureKeys.length) return [];
    return availablePlans
      .filter((plan) => planHasAnyFeature(plan, lockedFeatureKeys))
      .map((plan) => plan.name)
      .filter(Boolean);
  }, [availablePlans, lockedFeatureKeys]);

  const pendingPlanIds = useMemo(() => new Set(
    requests
      .filter((request) => request?.status === 'pending')
      .map((request) => Number(request.planId))
  ), [requests]);

  async function handleRequestPlan(plan, messageOverride = '') {
    setError('');
    setSuccess('');
    setRequestingPlanId(plan.id);
    try {
      await requestSubscription({
        planId: plan.id,
        message: messageOverride || (current ? `Requesting upgrade from ${current.planName || 'current plan'} to ${plan.name}.` : `Requesting subscription to ${plan.name}.`),
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
        ? 'border-brand-primary bg-brand-primary text-white'
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

    return (
      <article className={cx(ui.compactPanelCard, 'grid bg-[linear-gradient(160deg,color-mix(in_srgb,var(--color-primary)_6%,var(--surface-card)),var(--surface-card)_58%,color-mix(in_srgb,var(--color-teal)_4%,var(--surface-card)))] shadow-md', isRecommended && 'border-brand-primary/35 shadow-glow')} key={plan.id}>
        <div>
          <div className={ui.buttonRow}>
            {isCurrent ? <span className={statusPill('active')}>Current plan</span> : null}
            {primaryBadge ? <span className={ui.tablePill}>{primaryBadge}</span> : null}
            {hasOffer ? <span className={ui.tablePill}>{savingsPercent ? `Save ${savingsPercent}%` : 'Limited offer'}</span> : null}
          </div>
          <h3 className="mb-2 mt-4 text-xl font-extrabold text-ink-strong">{plan.name}</h3>
          {marketing.headline || options.headline ? (
            <p className="m-0 mb-2 text-[13px] font-extrabold leading-relaxed text-ink-strong">{options.headline || marketing.headline}</p>
          ) : null}
          <p className="m-0 text-[13px] leading-relaxed text-ink-soft">{plan.description || 'Subscription plan description.'}</p>
        </div>

        <div className="mt-4 flex flex-wrap items-baseline gap-2">
          <strong className="text-2xl font-extrabold text-brand-primary">{plan.currency} {Number(plan.effectivePrice).toFixed(2)}</strong>
          {hasOffer ? (
            <span className="text-sm font-semibold text-ink-muted line-through">{plan.currency} {Number(plan.regularPrice).toFixed(2)}</span>
          ) : null}
        </div>

        <div className={ui.tableSubtext}>
          Ends on {planEndDate}
        </div>

        <div className="my-5 grid gap-2 text-[13px] font-semibold text-ink-medium">
          <span>{plan.durationDays} days access</span>
          <span>{plan.slug?.includes('quick-revision') ? 'MCQ, quizzes, practice, and exam mode' : 'Lessons, MCQ, quizzes, practice, and progress'}</span>
        </div>

        <div className="mt-auto grid gap-2">
          {canOpenCheckout ? (
            <button
              type="button"
              className={ui.primaryAction}
              disabled={payingPlanId === plan.id}
              onClick={() => handleCheckoutPlan(plan, options.checkoutState || {})}
            >
              {payingPlanId === plan.id ? 'Opening checkout...' : marketing.cta || 'Continue to checkout'}
            </button>
          ) : null}
          <button
            type="button"
            className={isCurrent || pendingPlanIds.has(Number(plan.id)) || canOpenCheckout ? ui.secondaryAction : ui.primaryAction}
            disabled={isCurrent || pendingPlanIds.has(Number(plan.id)) || requestingPlanId === plan.id || payingPlanId === plan.id}
            onClick={() => handleRequestPlan(plan, options.requestMessage || '')}
          >
            {isCurrent ? 'Current plan' : pendingPlanIds.has(Number(plan.id)) ? 'Request pending' : requestingPlanId === plan.id ? 'Sending...' : options.requestLabel || (current ? 'Request admin upgrade' : 'Request admin subscription')}
          </button>
        </div>
      </article>
    );
  }

  return (
    <main className={ui.screenShell}>
      <section className={ui.managementLayout}>
        <AppHeader
          title="Subscriptions"
          subtitle="Compare available plans, review your current access, and see which features are included in each subscription."
        />

        {error ? <div className={ui.feedbackError}>{error}</div> : null}
        {success ? <div className={ui.feedbackSuccess}>{success}</div> : null}
        {upgradeMessage ? <div className={ui.feedbackError}>{upgradeMessage}</div> : null}
        {unlockPlanNames.length ? (
          <div className={ui.feedbackSuccess}>
            This feature is included in: {unlockPlanNames.join(', ')}.
          </div>
        ) : null}
        {purchaseSelectionNote ? <div className={ui.feedbackSuccess}>{purchaseSelectionNote}</div> : null}

        <section className={ui.panelCard}>
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
            <article className="rounded-lg border border-line-soft bg-[linear-gradient(145deg,color-mix(in_srgb,var(--color-teal)_7%,var(--surface-card)),var(--surface-card))] p-5 shadow-md">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className={ui.buttonRow}>
                    <span className={statusPill(current.status)}>{current.status}</span>
                    <span className={statusPill(current.paymentStatus)}>{current.paymentStatus}</span>
                  </div>
                  <h3 className="mb-2 mt-4 text-2xl font-extrabold text-ink-strong">{current.planName}</h3>
                  <p className="m-0 text-lg font-extrabold text-brand-primary">
                    {current.planCurrency} {Number(current.planEffectivePrice).toFixed(2)}
                    {current.planOfferEnabled && current.planOfferPrice !== null ? (
                      <span className="ml-2 text-sm font-semibold text-ink-muted line-through"> {current.planCurrency} {Number(current.planRegularPrice).toFixed(2)}</span>
                    ) : null}
                  </p>
                  <span className="mt-2 block text-xs font-semibold text-ink-muted">{current.startDate} to {current.endDate} • {current.planDurationDays} days</span>
                  {current.computedStatus === 'expired' ? (
                    <div className="mt-3 rounded-md border border-brand-error/20 bg-brand-error/10 px-3 py-2 text-[13px] font-bold text-brand-error">
                      This subscription has expired.
                    </div>
                  ) : current.isExpiringSoon ? (
                    <div className="mt-3 rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[13px] font-bold text-amber-700 dark:text-amber-300">
                      Expires in {Math.max(0, Number(current.daysRemaining || 0))} day(s). Request renewal early.
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {(Array.isArray(current.enabledFeatures) ? current.enabledFeatures : []).filter(Boolean).map((feature) => (
                  <span className={ui.tablePill} key={feature.id}>{feature.featureName}</span>
                ))}
              </div>
            </article>
          ) : null}
        </section>

        <section className={ui.panelCard}>
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
            <div className="mb-4 flex flex-wrap gap-2">
              <button type="button" className={ui.secondaryAction} onClick={scrollToComparison}>
                Compare plans
              </button>
              <button type="button" className={ui.secondaryAction} onClick={() => setCustomModalOpen(true)}>
                Need customization?
              </button>
            </div>
          ) : null}
          {!loading ? (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-4 max-[520px]:gap-3">
              {(recommendedPlans.length ? recommendedPlans : availablePlans.filter((plan) => plan.slug !== 'free').slice(0, 4)).map((plan) => renderPlanCard(plan, {
                highlight: plan.slug === 'complete-prep-3m',
                badge: plan.slug === 'complete-prep-3m' ? 'Most Popular' : undefined,
              }))}
            </div>
          ) : null}
          {!loading && paymentSettings?.enabled ? (
            <div className="mt-4 rounded-lg border border-line-soft bg-surface-glass-subtle px-4 py-3 text-[13px] leading-relaxed text-ink-soft">
              <strong className="text-ink-strong">{paymentSettings.checkoutTitle || 'PayHere checkout'}</strong>
              <span className="block">{paymentSettings.supportText || 'You will be redirected to PayHere hosted checkout.'}</span>
            </div>
          ) : null}
        </section>

        <section className={ui.panelCard} id="plan-comparison">
          <div className={ui.panelTop}>
            <div>
              <h2 className={ui.panelTitle}>Plan comparison</h2>
              <p className={ui.panelText}>A quick view of the major LMS areas included in each plan.</p>
            </div>
          </div>

          <div className={ui.tableShell}>
            <table className={ui.modernTable}>
              <thead>
                <tr>
                  <th className={ui.tableHeadCell}>Feature</th>
                  {comparisonPlans.map((plan) => (
                    <th className={ui.tableHeadCell} key={plan.id}>{plan.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr key={row.label}>
                    <td className={ui.tableCell}><strong>{row.label}</strong></td>
                    {comparisonPlans.map((plan) => (
                      <td className={ui.tableCell} key={`${row.label}-${plan.id}`}>
                        {planHasAnyFeature(plan, row.keys) ? <span className={statusPill('active')}>Included</span> : <span className={statusPill('inactive')}>Locked</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {customModalOpen ? (
          <div id="custom-plan-builder" className={cx(ui.modalBackdrop, 'grid place-items-center p-4')} role="dialog" aria-modal="true" aria-label="Customize subscription plan">
            <div className={cx(ui.entityModal, 'mx-auto max-h-[92dvh] w-full max-w-[980px] overflow-y-auto')}>
              <div className={ui.entityModalTop}>
                <div>
                  <h2 className={ui.entityModalTitle}>{customRequestMode ? 'Ask for a customized package' : 'Need customization?'}</h2>
                  <p className={ui.entityModalText}>{customRequestMode ? 'Choose what you need, then send it to admin as a package request.' : 'Choose the access, content, and duration. Tick the option you want.'}</p>
                </div>
                <button type="button" className={ui.iconButton} onClick={() => setCustomModalOpen(false)} aria-label="Close custom plan popup">x</button>
              </div>
              <div className="grid gap-4 px-6 pb-6 pt-5 max-[640px]:px-4">
                <div className="grid gap-5">
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
                      checkoutState: { customSelectionNote },
                      requestOnly: customRequestMode,
                      requestLabel: 'Ask admin for this package',
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

        <section className={ui.panelCard}>
          <div className={ui.panelTop}>
            <div>
              <h2 className={ui.panelTitle}>Upgrade requests</h2>
              <p className={ui.panelText}>Requests you have sent for plan upgrades or renewals.</p>
            </div>
          </div>

          {!loading && requests.length === 0 ? <div className={ui.emptyBox}>No upgrade requests yet.</div> : null}
          {requests.length ? (
            <div className="grid gap-3">
              {requests.map((request) => (
                <article className="rounded-lg border border-line-soft bg-surface-1 p-4 shadow-xs" key={request.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <strong className="text-ink-strong">{request.planName}</strong>
                      <div className={ui.tableSubtext}>Requested {request.requestedAt || '-'}</div>
                      {request.invoiceId ? <div className={ui.tableSubtext}>Invoice #{request.invoiceId}</div> : null}
                      {request.paymentProofDataUrl ? <div className={ui.tableSubtext}>Bank transfer proof uploaded. Waiting for admin approval.</div> : null}
                      {request.adminNote ? <div className={ui.tableSubtext}>Admin note: {request.adminNote}</div> : null}
                    </div>
                    <span className={statusPill(request.status)}>{request.status}</span>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </section>

        <section className={ui.panelCard}>
          <div className={ui.panelTop}>
            <div>
              <h2 className={ui.panelTitle}>Subscription history</h2>
              <p className={ui.panelText}>Your recent subscription assignments, renewals, and status changes.</p>
            </div>
          </div>

          <div className={ui.tableShell}>
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
        </section>
      </section>
    </main>
  );
}
