import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  createPlan,
  createPlanFeature,
  deletePlan,
  fetchAdminPlans,
  updatePlan,
  updatePlanFeature,
} from '../../../../shared/api/plans.api.js';
import {
  assignSubscription,
  cancelSubscription,
  createSubscriptionCoupon,
  deleteSubscriptionCoupon,
  extendSubscription,
  fetchAdminSubscriptionRequests,
  fetchAdminSubscriptions,
  fetchSubscriptionCoupons,
  fetchSubscriptionAdminMeta,
  fetchSubscriptionAudit,
  fetchSubscriptionInvoice,
  renewSubscription,
  resolveSubscriptionRequest,
  updateSubscriptionCoupon,
  updateSubscriptionPayment,
} from '../../../../shared/api/subscriptions.api.js';
import { API_BASE_URL, getErrorMessage } from '../../../../shared/api/client.js';
import { AppHeader } from '../../../../shared/layout/AppHeader.jsx';
import { DeleteActionIcon, EditActionIcon } from '../../../../shared/ui/ActionIcons.jsx';
import { cx, statusPill, ui } from '../../../../shared/styles/tailwindClasses.js';
import { getSafeExternalUrl } from '../../../../shared/utils/linkSafety.js';

const subscriptionUi = {
  overviewGrid: 'grid grid-cols-4 gap-4 max-[1100px]:grid-cols-2 max-[700px]:grid-cols-1',
  overviewCard:
    'grid gap-2 rounded-lg border border-line-soft bg-[linear-gradient(135deg,rgba(37,99,235,0.08),rgba(14,165,233,0.045)),var(--surface-card)] px-[18px] py-4 shadow-md',
  overviewLabel: 'text-[11px] font-bold uppercase tracking-[0.06em] text-ink-soft',
  overviewValue: 'text-[clamp(20px,2.2vw,26px)] leading-none text-ink-strong',
  overviewText: 'm-0 text-[12.5px] text-ink-soft',
  adminGrid: `${ui.managementGrid} items-start`,
  featureEditor: 'grid gap-3.5',
  templateRow: 'flex flex-wrap gap-2.5',
  planLibrary: 'grid gap-4',
  featurePanel: 'grid gap-3.5 rounded-xl border border-line-soft bg-surface-glass-subtle p-[18px]',
  featureGroups: 'grid gap-4',
  featureGroup: 'grid gap-3',
  featureGroupTitle: 'm-0 text-lg text-ink-strong',
  featureGroupText: 'm-0 mt-1 text-[13px] text-ink-soft',
  featureGrid: 'grid grid-cols-2 gap-3 max-[900px]:grid-cols-1',
  featureCheck:
    'flex items-start gap-3 rounded-lg border border-line-soft bg-surface-2 p-3.5 [&_input]:mt-0.5 [&_span]:grid [&_span]:gap-1 [&_strong]:text-[13px] [&_strong]:text-ink-strong [&_small]:text-[11.5px] [&_small]:text-ink-soft',
  featureCheckbox: 'mt-0.5 size-4 shrink-0 cursor-pointer accent-brand-primary',
  miniStats: 'flex items-center gap-2',
  selectedList: 'flex flex-col gap-2.5',
  featureChip: 'flex items-center justify-between gap-3.5 rounded-lg border border-line-soft bg-surface-2 px-4 py-3.5 max-[900px]:flex-col max-[900px]:items-stretch',
  featureCopy: 'grid min-w-0 gap-1.5',
  featureTitle: 'break-words text-[13px] font-bold leading-[1.55] text-ink-strong',
  featureKey: 'break-words text-[13px] leading-[1.55] text-ink-medium',
  featureMeta: 'break-words text-[11.5px] leading-[1.55] text-ink-soft',
  metaGrid: 'grid grid-cols-4 gap-3.5 max-[900px]:grid-cols-1',
  toggleGrid: 'grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2.5',
  planGrid: 'grid grid-cols-2 gap-3 max-[900px]:grid-cols-1',
  planCard:
    'relative grid gap-3.5 rounded-lg border border-line-soft bg-[linear-gradient(160deg,color-mix(in_srgb,var(--color-primary)_6%,var(--surface-card)),var(--surface-card)_58%,color-mix(in_srgb,var(--color-teal)_4%,var(--surface-card)))] p-[22px] shadow-md',
  planCardRecommended: 'border-brand-primary/30 shadow-[0_20px_40px_rgba(37,99,235,0.12)]',
  planTop: 'flex items-start justify-between gap-4 max-[640px]:flex-col',
  planTitle: 'm-0 text-lg font-extrabold text-ink-strong',
  planDescription: 'm-0 mt-1 text-[13px] leading-relaxed text-ink-soft',
  planPriceRow: 'flex items-baseline gap-3',
  planPrice: 'text-[clamp(28px,4vw,36px)] font-extrabold leading-none text-ink-strong',
  planPriceStrike: 'text-[13px] text-ink-soft line-through',
  planFeatureList: 'flex flex-wrap gap-2.5',
  assignDurationPanel: 'grid gap-2 rounded-lg border border-line-soft bg-surface-2 p-3',
  durationButtons: 'grid grid-cols-4 gap-2 max-[700px]:grid-cols-2',
  durationButton:
    'min-h-10 rounded-md border border-line-soft bg-surface-card px-3 text-[12.5px] font-bold text-ink-medium transition hover:border-brand-primary/40 hover:text-brand-primary',
  accessScopePanel: 'grid gap-3 rounded-lg border border-line-soft bg-surface-2 p-3',
  accessScopeGrid: 'grid grid-cols-[minmax(180px,0.6fr)_minmax(220px,1fr)] gap-3 max-[900px]:grid-cols-1',
  accessHint: 'text-[12px] leading-relaxed text-ink-soft',
  studentSearchWrap: 'relative grid gap-1.5',
  studentDropdown:
    'absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-lg border border-line-soft bg-surface-card p-1.5 shadow-2xl',
  studentOption:
    'grid w-full gap-0.5 rounded-md px-3 py-2.5 text-left transition hover:bg-surface-2 focus:bg-surface-2 focus:outline-none',
  studentOptionName: 'text-[13px] font-bold text-ink-strong',
  studentOptionEmail: 'text-[11.5px] text-ink-soft',
};

const ASSIGN_DURATION_PRESETS = [
  { label: '7 days', days: 7 },
  { label: '1 month', months: 1 },
  { label: '3 months', months: 3 },
  { label: '6 months', months: 6 },
];

const emptyPlanForm = {
  name: '',
  slug: '',
  description: '',
  regularPrice: 0,
  offerPrice: '',
  offerEnabled: false,
  currency: 'USD',
  durationDays: 30,
  sortOrder: 0,
  recommended: false,
  status: 'active',
  featureIds: [],
};

const emptyFeatureForm = {
  featureName: '',
  featureKey: '',
  description: '',
  category: 'Learning Access',
  status: 'active',
};

const emptyAssignForm = {
  userId: '',
  planId: '',
  accessScope: 'all',
  courseIds: [],
  lessonIds: [],
  startDate: '',
  endDate: '',
  notes: '',
  status: 'active',
  paymentStatus: 'manual',
  amountPaid: '',
  paymentMethod: '',
  paymentReference: '',
  paymentDate: '',
  receiptUrl: '',
};

const emptyCouponForm = {
  code: '',
  label: '',
  discountType: 'percent',
  discountValue: '',
  status: 'active',
  startsAt: '',
  expiresAt: '',
  maxRedemptions: '',
};

const emptySubscriptionFilters = {
  search: '',
  planId: '',
  status: '',
  paymentStatus: '',
  expiring: '',
};

function toDateOnly(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateInput(value) {
  const text = String(value || '').trim();
  if (!text) return new Date();
  const date = new Date(`${text}T00:00:00`);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function addDuration(startDateText, preset) {
  const start = parseDateInput(startDateText);
  const end = new Date(start);

  if (preset.months) {
    end.setMonth(end.getMonth() + preset.months);
  } else {
    end.setDate(end.getDate() + preset.days);
  }

  end.setDate(end.getDate() - 1);
  return {
    startDate: toDateOnly(start),
    endDate: toDateOnly(end),
  };
}

const planTemplates = [
  {
    label: 'Basic',
    description: 'Focused starter access with guided practice and basic tracking.',
    values: {
      name: 'Basic',
      slug: 'basic',
      description: 'Essential LMS access for students who want a lighter study plan.',
      regularPrice: 0,
      offerPrice: '',
      offerEnabled: false,
      currency: 'USD',
      durationDays: 30,
      sortOrder: 1,
      recommended: false,
      status: 'active',
      featureKeys: [
        'courses_access',
        'subject_access',
        'lessons_access_limited',
        'question_bank_limited',
        'practice_mode',
        'progress_tracking_basic',
      ],
    },
  },
  {
    label: 'Standard',
    description: 'Balanced plan with full lessons, exam mode, and notes.',
    values: {
      name: 'Standard',
      slug: 'standard',
      description: 'Balanced study access with full revision tools and exam preparation.',
      regularPrice: 19.99,
      offerPrice: 14.99,
      offerEnabled: true,
      currency: 'USD',
      durationDays: 30,
      sortOrder: 2,
      recommended: true,
      status: 'active',
      featureKeys: [
        'courses_access',
        'subject_access',
        'topic_access',
        'lessons_access_full',
        'question_bank_full',
        'practice_mode',
        'exam_mode',
        'results_tracking',
        'past_paper_access',
        'mock_paper_access',
        'notes_canvas_study_mode',
        'report_question',
        'progress_tracking_basic',
      ],
    },
  },
  {
    label: 'Premium',
    description: 'Top plan with AI tools, analytics, and premium extras.',
    values: {
      name: 'Premium',
      slug: 'premium',
      description: 'Full access plan with AI, analytics, and premium study support.',
      regularPrice: 29.99,
      offerPrice: 24.99,
      offerEnabled: true,
      currency: 'USD',
      durationDays: 30,
      sortOrder: 3,
      recommended: false,
      status: 'active',
      featureKeys: [
        'courses_access',
        'subject_access',
        'topic_access',
        'lessons_access_full',
        'question_bank_full',
        'past_paper_access',
        'mock_paper_access',
        'practice_mode',
        'exam_mode',
        'results_tracking',
        'report_question',
        'notes_canvas_study_mode',
        'download_materials',
        'ai_quiz_generator',
        'performance_analytics',
        'weak_area_analysis',
        'progress_tracking_advanced',
        'priority_support',
        'future_premium_tools',
      ],
    },
  },
];

const FEATURE_PAGE_LABELS = {
  courses_access: 'Courses page',
  subject_access: 'Subject navigation',
  topic_access: 'Topic navigation',
  lessons_access_limited: 'Limited lesson access',
  lessons_access_full: 'Full lessons access',
  question_bank_limited: 'Limited Q-Bank',
  question_bank_full: 'Full Q-Bank',
  past_paper_access: 'Past papers',
  mock_paper_access: 'Mock papers',
  practice_mode: 'Practice mode',
  exam_mode: 'Exam mode',
  results_tracking: 'Results page',
  report_question: 'Report question',
  notes_canvas_study_mode: 'Lessons',
  download_materials: 'Downloads',
  progress_tracking_basic: 'Basic progress',
  progress_tracking_advanced: 'Advanced progress',
  performance_analytics: 'Performance analytics',
  weak_area_analysis: 'Weak area analysis',
  ai_quiz_generator: 'AI quiz generator',
  certificates: 'Certificates',
  priority_support: 'Priority support',
  future_premium_tools: 'Future premium tools',
};

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function EntityModal({ open, title, subtitle, children, onClose, wide = false }) {
  if (!open) {
    return null;
  }

  return createPortal(
    <div className={ui.modalBackdrop} onClick={onClose}>
      <div className={cx(ui.entityModal, wide && ui.lessonEditModal)} onClick={(event) => event.stopPropagation()}>
        <div className={ui.entityModalTop}>
          <div>
            <h2 className={ui.entityModalTitle}>{title}</h2>
            {subtitle ? <p className={ui.entityModalText}>{subtitle}</p> : null}
          </div>
          <button type="button" className={ui.subtleIconButton} onClick={onClose} aria-label="Close">
            x
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

function resolveProofPreviewUrl(rawPath) {
  const text = String(rawPath || '');
  if (!text) {
    throw new Error('Missing proof file');
  }
  if (/^https?:\/\//i.test(text)) {
    const safeUrl = getSafeExternalUrl(text);
    if (!safeUrl) {
      throw new Error('Invalid proof URL');
    }
    return { url: safeUrl, revoke: false };
  }
  if (text.startsWith('blob:')) {
    return { url: text, revoke: false };
  }
  if (text.startsWith('/uploads/')) {
    const protectedPath = text.replace(/^\/uploads\/payment-proofs\//, '/uploads/payment-proofs/');
    if (protectedPath !== text) {
      return { url: `${API_BASE_URL}${protectedPath}`, revoke: false };
    }
    return { url: `${API_BASE_URL.replace(/\/api\/?$/i, '')}${text}`, revoke: false };
  }

  const match = text.match(/^data:([^;,]+);base64,(.+)$/);
  if (!match) {
    throw new Error('Invalid proof data');
  }

  const mimeType = match[1];
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return { url: URL.createObjectURL(new Blob([bytes], { type: mimeType })), revoke: true };
}

function BankTransferProofPreview({ request }) {
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewError, setPreviewError] = useState('');
  const isPdf = String(request?.paymentProofMime || '').toLowerCase().includes('pdf');

  useEffect(() => {
    let resolved = { url: '', revoke: false };
    setPreviewUrl('');
    setPreviewError('');

    try {
      resolved = resolveProofPreviewUrl(request?.paymentProofDataUrl);
      setPreviewUrl(resolved.url);
    } catch {
      setPreviewError('Unable to preview this uploaded proof. Try downloading it or ask the student to upload it again.');
    }

    return () => {
      if (resolved.revoke && resolved.url) {
        URL.revokeObjectURL(resolved.url);
      }
    };
  }, [request?.paymentProofDataUrl]);

  return (
    <div className="grid gap-4 px-6 pb-6 pt-[22px]">
      <div className={ui.buttonRow}>
        {request?.paymentReference ? <span className={ui.tablePill}>Reference: {request.paymentReference}</span> : null}
        {request?.paymentProofName ? <span className={ui.tablePill}>{request.paymentProofName}</span> : null}
      </div>
      {previewError ? <div className={ui.feedbackError}>{previewError}</div> : null}
      {!previewError && !previewUrl ? <div className={ui.emptyBox}>Preparing preview...</div> : null}
      {!previewError && previewUrl && isPdf ? (
        <div className="grid gap-3">
          <iframe className="min-h-[70vh] w-full rounded-lg border border-line-soft bg-surface-2" src={previewUrl} title="Bank transfer PDF proof" />
          <a className={ui.secondaryAction} href={previewUrl} download={request?.paymentProofName || 'bank-transfer-proof.pdf'}>
            Download PDF
          </a>
        </div>
      ) : null}
      {!previewError && previewUrl && !isPdf ? (
        <img
          className="max-h-[72vh] w-full rounded-lg border border-line-soft bg-surface-2 object-contain"
          src={previewUrl}
          alt="Bank transfer slip or screenshot"
          onError={() => setPreviewError('Unable to display this image proof. Ask the student to upload a clearer screenshot.')}
        />
      ) : null}
    </div>
  );
}

function getFeatureDisplay(feature) {
  return FEATURE_PAGE_LABELS[feature?.featureKey] || feature?.featureName || 'Feature';
}

function summarizePlanExperience(plan) {
  const enabledFeatures = Array.isArray(plan?.enabledFeatures) ? plan.enabledFeatures : [];
  const labels = [];

  if (enabledFeatures.some((feature) => ['courses_access', 'subject_access', 'topic_access'].includes(feature.featureKey))) {
    labels.push('Courses');
  }
  if (enabledFeatures.some((feature) => ['lessons_access_limited', 'lessons_access_full'].includes(feature.featureKey))) {
    labels.push('Lessons');
  }
  if (enabledFeatures.some((feature) => ['question_bank_limited', 'question_bank_full', 'past_paper_access', 'mock_paper_access'].includes(feature.featureKey))) {
    labels.push('Q-Bank');
  }
  if (enabledFeatures.some((feature) => ['practice_mode', 'exam_mode'].includes(feature.featureKey))) {
    labels.push('Practice / Exam');
  }
  if (enabledFeatures.some((feature) => feature.featureKey === 'notes_canvas_study_mode')) {
    labels.push('Lessons');
  }
  if (enabledFeatures.some((feature) => ['results_tracking', 'progress_tracking_basic', 'progress_tracking_advanced', 'performance_analytics', 'weak_area_analysis'].includes(feature.featureKey))) {
    labels.push('Analytics');
  }
  if (enabledFeatures.some((feature) => feature.featureKey === 'ai_quiz_generator')) {
    labels.push('AI Tools');
  }

  return labels;
}

function PlanFeatureChecklist({ groupedFeatures, selectedIds, onToggle }) {
  return (
    <div className={subscriptionUi.featureGroups}>
      {groupedFeatures.map(({ category, features }) => (
        <section className={subscriptionUi.featureGroup} key={category}>
          <div>
            <h3 className={subscriptionUi.featureGroupTitle}>{category}</h3>
            <p className={subscriptionUi.featureGroupText}>{features.length} feature option(s)</p>
          </div>
          <div className={subscriptionUi.featureGrid}>
            {features.map((feature) => (
              <label className={subscriptionUi.featureCheck} key={feature.id}>
                <input className={subscriptionUi.featureCheckbox}
                  type="checkbox"
                  checked={selectedIds.includes(feature.id)}
                  onChange={() => onToggle(feature.id)}
                />
                <span>
                  <strong>{getFeatureDisplay(feature)}</strong>
                  <small>{feature.description || feature.featureKey}</small>
                </span>
              </label>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function StudentSearchSelect({ students, value, onChange }) {
  const selectedStudent = students.find((student) => String(student.id) === String(value));
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setQuery(selectedStudent ? `${selectedStudent.fullName} (${selectedStudent.email})` : '');
  }, [selectedStudent]);

  const filteredStudents = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle || selectedStudent && query === `${selectedStudent.fullName} (${selectedStudent.email})`) {
      return students.slice(0, 20);
    }

    return students
      .filter((student) => {
        const haystack = `${student.fullName || ''} ${student.email || ''}`.toLowerCase();
        return haystack.includes(needle);
      })
      .slice(0, 20);
  }, [query, selectedStudent, students]);

  function selectStudent(student) {
    onChange(String(student.id));
    setQuery(`${student.fullName} (${student.email})`);
    setOpen(false);
  }

  return (
    <div className={subscriptionUi.studentSearchWrap}>
      <label className={ui.formLabel} htmlFor="assign-student-search">
        Student
      </label>
      <input
        id="assign-student-search"
        className={ui.input}
        type="search"
        value={query}
        placeholder="Search or choose a student"
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls="assign-student-options"
        required
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          onChange('');
          setOpen(true);
        }}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
      />
      {open ? (
        <div id="assign-student-options" className={subscriptionUi.studentDropdown} role="listbox">
          {filteredStudents.length ? filteredStudents.map((student) => (
            <button
              key={student.id}
              type="button"
              className={subscriptionUi.studentOption}
              role="option"
              aria-selected={String(student.id) === String(value)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectStudent(student)}
            >
              <span className={subscriptionUi.studentOptionName}>{student.fullName}</span>
              <span className={subscriptionUi.studentOptionEmail}>{student.email}</span>
            </button>
          )) : (
            <div className={ui.tableSubtext}>No students match that search.</div>
          )}
        </div>
      ) : null}
      <input type="hidden" name="userId" value={value} />
    </div>
  );
}

export function AdminSubscriptionsPage() {
  const [plans, setPlans] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [requests, setRequests] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [auditEvents, setAuditEvents] = useState([]);
  const [meta, setMeta] = useState({ students: [], plans: [], courses: [], lessons: [], features: [], featureCategories: [] });
  const [planForm, setPlanForm] = useState(emptyPlanForm);
  const [featureForm, setFeatureForm] = useState(emptyFeatureForm);
  const [assignForm, setAssignForm] = useState(emptyAssignForm);
  const [couponForm, setCouponForm] = useState(emptyCouponForm);
  const [editingPlanId, setEditingPlanId] = useState(null);
  const [editingFeatureId, setEditingFeatureId] = useState(null);
  const [editingCouponId, setEditingCouponId] = useState(null);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [featureModalOpen, setFeatureModalOpen] = useState(false);
  const [subscriptionView, setSubscriptionView] = useState('students');
  const [loading, setLoading] = useState(true);
  const [savingPlan, setSavingPlan] = useState(false);
  const [savingFeature, setSavingFeature] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [savingCoupon, setSavingCoupon] = useState(false);
  const [actionBusyId, setActionBusyId] = useState('');
  const [proofPreviewRequest, setProofPreviewRequest] = useState(null);
  const [subscriptionFilters, setSubscriptionFilters] = useState(emptySubscriptionFilters);
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [invoiceLookup, setInvoiceLookup] = useState(null);
  const [invoiceLookupLoading, setInvoiceLookupLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadAll();
  }, []);

  const safePlans = (Array.isArray(plans) ? plans : []).filter(Boolean);
  const safeSubscriptions = (Array.isArray(subscriptions) ? subscriptions : []).filter(Boolean);
  const safeRequests = (Array.isArray(requests) ? requests : []).filter(Boolean);
  const safeCoupons = (Array.isArray(coupons) ? coupons : []).filter(Boolean);
  const safeAuditEvents = (Array.isArray(auditEvents) ? auditEvents : []).filter(Boolean);
  const safeStudents = (Array.isArray(meta.students) ? meta.students : []).filter(Boolean);
  const safeCourses = (Array.isArray(meta.courses) ? meta.courses : []).filter(Boolean);
  const safeLessons = (Array.isArray(meta.lessons) ? meta.lessons : []).filter(Boolean);
  const safeFeatures = (Array.isArray(meta.features) ? meta.features : []).filter(Boolean);
  const safeFeatureCategories = Array.isArray(meta.featureCategories) ? meta.featureCategories : [];

  const courseTitleById = useMemo(
    () => new Map(safeCourses.map((course) => [Number(course.id), course.courseTitle])),
    [safeCourses]
  );
  const lessonTitleById = useMemo(
    () => new Map(safeLessons.map((lesson) => [Number(lesson.id), `${lesson.courseTitle} - ${lesson.lessonTitle}`])),
    [safeLessons]
  );

  const groupedFeatures = useMemo(() => {
    const categories = safeFeatureCategories;
    return categories.map((category) => ({
      category,
      features: safeFeatures.filter((feature) => feature?.category === category),
    }));
  }, [safeFeatureCategories, safeFeatures]);

  const filteredSubscriptions = useMemo(() => {
    const search = subscriptionFilters.search.trim().toLowerCase();
    return safeSubscriptions.filter((subscription) => {
      if (search) {
        const haystack = `${subscription.studentName || ''} ${subscription.studentEmail || ''} ${subscription.planName || ''}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      if (subscriptionFilters.planId && String(subscription.planId) !== String(subscriptionFilters.planId)) return false;
      if (subscriptionFilters.status && String(subscription.computedStatus || subscription.status) !== subscriptionFilters.status) return false;
      if (subscriptionFilters.paymentStatus && subscription.paymentStatus !== subscriptionFilters.paymentStatus) return false;
      if (subscriptionFilters.expiring === 'soon' && !subscription.isExpiringSoon) return false;
      return true;
    });
  }, [safeSubscriptions, subscriptionFilters]);

  const pendingRequests = safeRequests.filter((request) => request?.status === 'pending');
  const expiringSoonCount = safeSubscriptions.filter((subscription) => subscription?.isExpiringSoon).length;

  async function loadAll() {
    setLoading(true);
    setError('');

    try {
      const [planRows, metaData, subscriptionRows, requestRows, couponRows, auditRows] = await Promise.all([
        fetchAdminPlans(),
        fetchSubscriptionAdminMeta(),
        fetchAdminSubscriptions(),
        fetchAdminSubscriptionRequests(),
        fetchSubscriptionCoupons(),
        fetchSubscriptionAudit(),
      ]);
      setPlans(Array.isArray(planRows) ? planRows : []);
      setMeta({
        students: Array.isArray(metaData?.students) ? metaData.students : [],
        plans: Array.isArray(metaData?.plans) ? metaData.plans : [],
        courses: Array.isArray(metaData?.courses) ? metaData.courses : [],
        lessons: Array.isArray(metaData?.lessons) ? metaData.lessons : [],
        features: Array.isArray(metaData?.features) ? metaData.features : [],
        featureCategories: Array.isArray(metaData?.featureCategories) ? metaData.featureCategories : [],
      });
      setSubscriptions(Array.isArray(subscriptionRows) ? subscriptionRows : []);
      setRequests(Array.isArray(requestRows) ? requestRows : []);
      setCoupons(Array.isArray(couponRows) ? couponRows : []);
      setAuditEvents(Array.isArray(auditRows) ? auditRows : []);
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Unable to load subscription data'));
    } finally {
      setLoading(false);
    }
  }

  function resetPlanForm() {
    setEditingPlanId(null);
    setPlanForm(emptyPlanForm);
    setPlanModalOpen(false);
  }

  function resetFeatureForm() {
    setEditingFeatureId(null);
    setFeatureForm({
      ...emptyFeatureForm,
      category: safeFeatureCategories[0] || emptyFeatureForm.category,
    });
    setFeatureModalOpen(false);
  }

  function handleOpenCreatePlan() {
    setEditingPlanId(null);
    setPlanForm(emptyPlanForm);
    setPlanModalOpen(true);
  }

  function handleOpenCreateFeature() {
    setEditingFeatureId(null);
    setFeatureForm({
      ...emptyFeatureForm,
      category: safeFeatureCategories[0] || emptyFeatureForm.category,
    });
    setFeatureModalOpen(true);
  }

  function handlePlanChange(event) {
    const { name, value, type, checked } = event.target;
    setPlanForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }));
  }

  function handleFeatureChange(event) {
    const { name, value } = event.target;
    setFeatureForm((current) => ({ ...current, [name]: value }));
  }

  function handleAssignChange(event) {
    const { name, value, multiple, selectedOptions } = event.target;
    setAssignForm((current) => {
      const nextValue = multiple
        ? Array.from(selectedOptions).map((option) => Number(option.value)).filter(Boolean)
        : value;
      const next = { ...current, [name]: nextValue };
      if (name === 'accessScope') {
        next.courseIds = value === 'courses' ? current.courseIds : [];
        next.lessonIds = value === 'lessons' ? current.lessonIds : [];
      }
      return next;
    });
  }

  function handleSubscriptionFilterChange(event) {
    const { name, value } = event.target;
    setSubscriptionFilters((current) => ({ ...current, [name]: value }));
  }

  async function handleInvoiceLookup(event) {
    event.preventDefault();
    const invoiceId = invoiceSearch.trim();
    if (!invoiceId) return;
    setInvoiceLookupLoading(true);
    setInvoiceLookup(null);
    setError('');
    try {
      const result = await fetchSubscriptionInvoice(invoiceId);
      setInvoiceLookup(result);
    } catch (lookupError) {
      setError(getErrorMessage(lookupError, 'Unable to find invoice details'));
    } finally {
      setInvoiceLookupLoading(false);
    }
  }

  function handleCouponChange(event) {
    const { name, value } = event.target;
    setCouponForm((current) => ({ ...current, [name]: value }));
  }

  function resetCouponForm() {
    setEditingCouponId(null);
    setCouponForm(emptyCouponForm);
  }

  function startEditCoupon(coupon) {
    setEditingCouponId(coupon.id);
    setCouponForm({
      code: coupon.code || '',
      label: coupon.label || '',
      discountType: coupon.discountType || 'percent',
      discountValue: coupon.discountValue ?? '',
      status: coupon.status || 'active',
      startsAt: coupon.startsAt ? String(coupon.startsAt).slice(0, 10) : '',
      expiresAt: coupon.expiresAt ? String(coupon.expiresAt).slice(0, 10) : '',
      maxRedemptions: coupon.maxRedemptions ?? '',
    });
  }

  function handleAssignStudentChange(userId) {
    setAssignForm((current) => ({ ...current, userId }));
  }

  function applyAssignDuration(preset) {
    const nextDates = addDuration(assignForm.startDate, preset);
    setAssignForm((current) => ({ ...current, ...nextDates }));
  }

  function togglePlanFeature(featureId) {
    setPlanForm((current) => ({
      ...current,
      featureIds: current.featureIds.includes(featureId)
        ? current.featureIds.filter((id) => id !== featureId)
        : [...current.featureIds, featureId],
    }));
  }

  function applyPlanTemplate(template) {
    const featureIds = safeFeatures
      .filter((feature) => template.values.featureKeys.includes(feature.featureKey))
      .map((feature) => feature.id);

    setEditingPlanId(null);
    setPlanForm({
      name: template.values.name,
      slug: template.values.slug,
      description: template.values.description,
      regularPrice: template.values.regularPrice,
      offerPrice: template.values.offerPrice,
      offerEnabled: template.values.offerEnabled,
      currency: template.values.currency,
      durationDays: template.values.durationDays,
      sortOrder: template.values.sortOrder,
      recommended: template.values.recommended,
      status: template.values.status,
      featureIds,
    });
  }

  function startEditPlan(plan) {
    setEditingPlanId(plan.id);
    setPlanForm({
      name: plan.name,
      slug: plan.slug,
      description: plan.description,
      regularPrice: plan.regularPrice,
      offerPrice: plan.offerPrice ?? '',
      offerEnabled: Boolean(plan.offerEnabled),
      currency: plan.currency,
      durationDays: plan.durationDays,
      sortOrder: plan.sortOrder,
      recommended: Boolean(plan.recommended),
      status: plan.status,
      featureIds: plan.featureIds || [],
    });
    setPlanModalOpen(true);
  }

  function startEditFeature(feature) {
    setEditingFeatureId(feature.id);
    setFeatureForm({
      featureName: feature.featureName,
      featureKey: feature.featureKey,
      description: feature.description,
      category: feature.category,
      status: feature.status,
    });
    setFeatureModalOpen(true);
  }

  async function handlePlanSubmit(event) {
    event.preventDefault();
    setSavingPlan(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        name: planForm.name,
        slug: planForm.slug || slugify(planForm.name),
        description: planForm.description,
        regularPrice: Number(planForm.regularPrice),
        offerPrice: planForm.offerPrice === '' ? null : Number(planForm.offerPrice),
        offerEnabled: Boolean(planForm.offerEnabled),
        currency: planForm.currency,
        durationDays: Number(planForm.durationDays),
        sortOrder: Number(planForm.sortOrder),
        recommended: Boolean(planForm.recommended),
        status: planForm.status,
        featureIds: planForm.featureIds,
      };

      if (editingPlanId) {
        await updatePlan(editingPlanId, payload);
        setSuccess('Subscription plan updated successfully.');
      } else {
        await createPlan(payload);
        setSuccess('Subscription plan created successfully.');
      }

      setPlanModalOpen(false);
      setEditingPlanId(null);
      setPlanForm(emptyPlanForm);
      await loadAll();
    } catch (saveError) {
      setError(getErrorMessage(saveError, 'Unable to save subscription plan'));
    } finally {
      setSavingPlan(false);
    }
  }

  async function handleFeatureSubmit(event) {
    event.preventDefault();
    setSavingFeature(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        featureName: featureForm.featureName,
        featureKey: featureForm.featureKey || slugify(featureForm.featureName),
        description: featureForm.description,
        category: featureForm.category,
        status: featureForm.status,
      };

      if (editingFeatureId) {
        await updatePlanFeature(editingFeatureId, payload);
        setSuccess('Subscription feature updated successfully.');
      } else {
        await createPlanFeature(payload);
        setSuccess('Subscription feature created successfully.');
      }

      setFeatureModalOpen(false);
      setEditingFeatureId(null);
      setFeatureForm({
        ...emptyFeatureForm,
        category: safeFeatureCategories[0] || emptyFeatureForm.category,
      });
      await loadAll();
    } catch (saveError) {
      setError(getErrorMessage(saveError, 'Unable to save subscription feature'));
    } finally {
      setSavingFeature(false);
    }
  }

  async function handlePlanDelete(plan) {
    const confirmed = window.confirm(`Delete "${plan.name}"?`);
    if (!confirmed) {
      return;
    }

    try {
      await deletePlan(plan.id);
      if (editingPlanId === plan.id) {
        resetPlanForm();
      }
      setSuccess('Subscription plan deleted successfully.');
      await loadAll();
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, 'Unable to delete subscription plan'));
    }
  }

  async function handleAssignSubmit(event) {
    event.preventDefault();
    setAssigning(true);
    setError('');
    setSuccess('');

    if (!assignForm.userId) {
      setAssigning(false);
      setError('Please select a student from the search dropdown before assigning a subscription.');
      return;
    }

    try {
      await assignSubscription({
        userId: Number(assignForm.userId),
        planId: Number(assignForm.planId),
        accessScope: assignForm.accessScope,
        courseIds: assignForm.accessScope === 'courses' ? assignForm.courseIds : [],
        lessonIds: assignForm.accessScope === 'lessons' ? assignForm.lessonIds : [],
        startDate: assignForm.startDate || undefined,
        endDate: assignForm.endDate || undefined,
        notes: assignForm.notes,
        status: assignForm.status,
        paymentStatus: assignForm.paymentStatus,
        amountPaid: assignForm.amountPaid === '' ? undefined : Number(assignForm.amountPaid),
        paymentMethod: assignForm.paymentMethod,
        paymentReference: assignForm.paymentReference,
        paymentDate: assignForm.paymentDate || undefined,
        receiptUrl: assignForm.receiptUrl,
      });
      setAssignForm(emptyAssignForm);
      setSuccess('Student subscription assigned successfully.');
      await loadAll();
    } catch (assignError) {
      setError(getErrorMessage(assignError, 'Unable to assign subscription'));
    } finally {
      setAssigning(false);
    }
  }

  async function handleCouponSubmit(event) {
    event.preventDefault();
    setSavingCoupon(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        code: couponForm.code,
        label: couponForm.label,
        discountType: couponForm.discountType,
        discountValue: Number(couponForm.discountValue),
        status: couponForm.status,
        startsAt: couponForm.startsAt || undefined,
        expiresAt: couponForm.expiresAt || undefined,
        maxRedemptions: couponForm.maxRedemptions === '' ? undefined : Number(couponForm.maxRedemptions),
      };

      if (editingCouponId) {
        await updateSubscriptionCoupon(editingCouponId, payload);
        setSuccess('Coupon code updated successfully.');
      } else {
        await createSubscriptionCoupon(payload);
        setSuccess('Coupon code created successfully.');
      }

      resetCouponForm();
      await loadAll();
    } catch (saveError) {
      setError(getErrorMessage(saveError, 'Unable to save coupon code'));
    } finally {
      setSavingCoupon(false);
    }
  }

  async function handleCouponDelete(coupon) {
    const confirmed = window.confirm(`Delete coupon "${coupon.code}"?`);
    if (!confirmed) return;
    setError('');
    setSuccess('');
    try {
      await deleteSubscriptionCoupon(coupon.id);
      if (editingCouponId === coupon.id) resetCouponForm();
      setSuccess('Coupon code deleted successfully.');
      await loadAll();
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, 'Unable to delete coupon code'));
    }
  }

  async function runSubscriptionAction(key, action, successMessage) {
    setActionBusyId(key);
    setError('');
    setSuccess('');
    try {
      await action();
      setSuccess(successMessage);
      await loadAll();
    } catch (actionError) {
      setError(getErrorMessage(actionError, 'Unable to update subscription'));
    } finally {
      setActionBusyId('');
    }
  }

  function handleExtend(subscription, days) {
    runSubscriptionAction(
      `extend-${subscription.id}-${days}`,
      () => extendSubscription(subscription.id, { days, notes: `Quick extension: ${days} days` }),
      `Extended ${subscription.studentName}'s subscription by ${days} days.`
    );
  }

  function handleRenew(subscription) {
    runSubscriptionAction(
      `renew-${subscription.id}`,
      () => renewSubscription(subscription.id, { planId: subscription.planId, notes: 'Renewed same plan from admin quick action.', paymentStatus: subscription.paymentStatus || 'manual' }),
      `Renewed ${subscription.studentName}'s subscription.`
    );
  }

  function handleCancel(subscription) {
    const confirmed = window.confirm(`Cancel ${subscription.studentName}'s ${subscription.planName} subscription?`);
    if (!confirmed) return;
    runSubscriptionAction(
      `cancel-${subscription.id}`,
      () => cancelSubscription(subscription.id, { notes: 'Cancelled from admin subscription table.' }),
      `Cancelled ${subscription.studentName}'s subscription.`
    );
  }

  function handlePayment(subscription) {
    const amount = window.prompt('Amount paid', subscription.amountPaid ?? subscription.planEffectivePrice ?? '');
    if (amount === null) return;
    const method = window.prompt('Payment method', subscription.paymentMethod || 'manual');
    if (method === null) return;
    const reference = window.prompt('Reference / transaction ID', subscription.paymentReference || '');
    if (reference === null) return;

    runSubscriptionAction(
      `payment-${subscription.id}`,
      () => updateSubscriptionPayment(subscription.id, {
        paymentStatus: 'paid',
        amountPaid: amount === '' ? undefined : Number(amount),
        paymentMethod: method,
        paymentReference: reference,
        paymentDate: new Date().toISOString().slice(0, 10),
      }),
      `Marked ${subscription.studentName}'s payment as paid.`
    );
  }

  function handleResolveRequest(request, status) {
    const label = status === 'approved' ? 'approve' : 'reject';
    const confirmed = window.confirm(`${label[0].toUpperCase()}${label.slice(1)} request for ${request.studentName}?`);
    if (!confirmed) return;
    runSubscriptionAction(
      `request-${request.id}-${status}`,
      () => resolveSubscriptionRequest(request.id, { status, adminNote: status === 'approved' ? 'Approved from admin subscriptions page.' : 'Rejected from admin subscriptions page.' }),
      status === 'approved' ? `Approved ${request.studentName}'s request.` : `Rejected ${request.studentName}'s request.`
    );
  }

  return (
    <main className={ui.screenShell}>
      <section className={ui.managementLayout}>
        <AppHeader
          title={subscriptionView === 'manage' ? 'Manage Packages' : 'Subscriptions'}
          subtitle={subscriptionView === 'manage'
            ? 'Manage package pricing, feature access, and coupon codes away from the student workflow.'
            : 'Review student requests, bank transfer proofs, active subscriptions, renewals, and payment status.'}
          actions={(
            <div className={ui.buttonRow}>
              {subscriptionView === 'manage' ? (
                <>
                  <button type="button" className={ui.secondaryAction} onClick={() => setSubscriptionView('students')}>Student view</button>
                  <button type="button" className={ui.primaryAction} onClick={handleOpenCreatePlan}>Add Plan</button>
                  <button type="button" className={ui.secondaryAction} onClick={handleOpenCreateFeature}>Add Feature</button>
                </>
              ) : (
                <button type="button" className={ui.primaryAction} onClick={() => setSubscriptionView('manage')}>Manage</button>
              )}
            </div>
          )}
        />

        {error ? <div className={ui.feedbackError}>{error}</div> : null}
        {success ? <div className={ui.feedbackSuccess}>{success}</div> : null}

        <section className={subscriptionUi.overviewGrid}>
          <article className={subscriptionUi.overviewCard}>
            <span className={subscriptionUi.overviewLabel}>{subscriptionView === 'manage' ? 'Plans' : 'Students'}</span>
            <strong className={subscriptionUi.overviewValue}>{subscriptionView === 'manage' ? safePlans.length : safeStudents.length}</strong>
            <p className={subscriptionUi.overviewText}>{subscriptionView === 'manage' ? 'Subscription plans currently configured in the LMS.' : 'Student accounts available for subscription assignment.'}</p>
          </article>
          <article className={subscriptionUi.overviewCard}>
            <span className={subscriptionUi.overviewLabel}>{subscriptionView === 'manage' ? 'Features' : 'Pending Requests'}</span>
            <strong className={subscriptionUi.overviewValue}>{subscriptionView === 'manage' ? safeFeatures.length : pendingRequests.length}</strong>
            <p className={subscriptionUi.overviewText}>{subscriptionView === 'manage' ? 'Master features available for checkbox-based plan allocation.' : 'Student requests waiting for admin decision.'}</p>
          </article>
          <article className={subscriptionUi.overviewCard}>
            <span className={subscriptionUi.overviewLabel}>Active Subs</span>
            <strong className={subscriptionUi.overviewValue}>{safeSubscriptions.filter((subscription) => subscription?.status === 'active').length}</strong>
            <p className={subscriptionUi.overviewText}>Students currently on an active subscription window.</p>
          </article>
          <article className={subscriptionUi.overviewCard}>
            <span className={subscriptionUi.overviewLabel}>Requests / Expiring</span>
            <strong className={subscriptionUi.overviewValue}>{pendingRequests.length} / {expiringSoonCount}</strong>
            <p className={subscriptionUi.overviewText}>Pending upgrade requests and subscriptions ending within 7 days.</p>
          </article>
        </section>

        {subscriptionView === 'manage' ? (
          <>
        <div className={subscriptionUi.adminGrid}>
          <section className={cx(ui.panelCard, subscriptionUi.featureEditor)}>
            <div className={ui.panelTop}>
              <div>
                <h2>Feature catalog</h2>
                <p>These are the LMS capabilities your plans can unlock. Edit or add features without crowding the plan list.</p>
              </div>
              <div className={ui.buttonRow}>
                <button type="button" className={ui.secondaryAction} onClick={handleOpenCreateFeature}>
                  Add feature
                </button>
              </div>
            </div>

            <div className={subscriptionUi.selectedList}>
              {safeFeatures.map((feature) => (
                <article className={subscriptionUi.featureChip} key={feature.id}>
                  <div className={subscriptionUi.featureCopy}>
                    <strong className={subscriptionUi.featureTitle}>{getFeatureDisplay(feature)}</strong>
                    <span className={subscriptionUi.featureKey}>{feature.featureKey}</span>
                    <small className={subscriptionUi.featureMeta}>{feature.category} • {feature.status}{feature.description ? ` • ${feature.description}` : ''}</small>
                  </div>
                  <button type="button" className={ui.iconButton} onClick={() => startEditFeature(feature)} aria-label={`Edit feature ${feature.featureName}`}>
                    <EditActionIcon />
                  </button>
                </article>
              ))}
            </div>
          </section>
        </div>

        <section className={cx(ui.panelCard, subscriptionUi.planLibrary)}>
          <div className={ui.panelTop}>
            <div>
              <h2>Subscription plans</h2>
              <p>{loading ? 'Loading plans...' : `${safePlans.length} plan(s) configured`}</p>
            </div>
          </div>

          {loading ? <div className={ui.emptyBox}>Loading plans...</div> : null}
          {!loading && safePlans.length === 0 ? <div className={ui.emptyBox}>No subscription plans created yet.</div> : null}
          {!loading ? (
            <div className={subscriptionUi.planGrid}>
              {safePlans.map((plan) => (
                <article className={cx(subscriptionUi.planCard, plan.recommended && subscriptionUi.planCardRecommended)} key={plan.id}>
                  <div className={subscriptionUi.planTop}>
                    <div>
                      <div className={ui.buttonRow}>
                        <span className={statusPill(plan.status)}>{plan.status}</span>
                        {plan.recommended ? <span className={ui.tablePill}>Recommended</span> : null}
                      </div>
                      <h3 className={subscriptionUi.planTitle}>{plan.name}</h3>
                      <p className={subscriptionUi.planDescription}>{plan.description || 'Subscription plan description.'}</p>
                    </div>
                    <div className={ui.iconRow}>
                      <button type="button" className={ui.iconButton} aria-label={`Edit ${plan.name}`} title="Edit plan" onClick={() => startEditPlan(plan)}>
                        <EditActionIcon />
                      </button>
                      <button type="button" className={ui.dangerIconButton} aria-label={`Delete ${plan.name}`} title="Delete plan" onClick={() => handlePlanDelete(plan)}>
                        <DeleteActionIcon />
                      </button>
                    </div>
                  </div>

                  <div className={subscriptionUi.planPriceRow}>
                    <strong className={subscriptionUi.planPrice}>{plan.currency} {Number(plan.effectivePrice).toFixed(2)}</strong>
                    {plan.offerEnabled && plan.offerPrice !== null ? (
                      <span className={subscriptionUi.planPriceStrike}>{plan.currency} {Number(plan.regularPrice).toFixed(2)}</span>
                    ) : null}
                  </div>

                  <div className={ui.tableSubtext}>{plan.durationDays} days • Sort {plan.sortOrder}</div>

                  <div className={ui.buttonRow}>
                    {summarizePlanExperience(plan).map((label) => (
                      <span className={ui.tablePill} key={`${plan.id}-${label}`}>{label}</span>
                    ))}
                  </div>

                  <div className={subscriptionUi.planFeatureList}>
                    {(Array.isArray(plan.enabledFeatures) ? plan.enabledFeatures : []).slice(0, 8).map((feature) => (
                      <span className={ui.tablePill} key={feature.id}>{getFeatureDisplay(feature)}</span>
                    ))}
                    {(Array.isArray(plan.enabledFeatures) ? plan.enabledFeatures : []).length > 8 ? (
                      <span className={ui.tableSubtext}>+{(Array.isArray(plan.enabledFeatures) ? plan.enabledFeatures : []).length - 8} more</span>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </section>

        <section className={ui.panelCard}>
          <div className={ui.panelTop}>
            <div>
              <h2>Subscription coupons</h2>
              <p>Create coupon codes students can enter before PayHere checkout.</p>
            </div>
          </div>

          <form className={ui.stackForm} onSubmit={handleCouponSubmit}>
            <div className={subscriptionUi.metaGrid}>
              <label className={ui.formLabel}>
                Coupon code
                <input className={ui.input} name="code" value={couponForm.code} onChange={handleCouponChange} placeholder="ERPM25" required />
              </label>
              <label className={ui.formLabel}>
                Label
                <input className={ui.input} name="label" value={couponForm.label} onChange={handleCouponChange} placeholder="New student offer" />
              </label>
              <label className={ui.formLabel}>
                Discount type
                <select className={ui.input} name="discountType" value={couponForm.discountType} onChange={handleCouponChange}>
                  <option value="percent">Percent</option>
                  <option value="fixed">Fixed amount</option>
                </select>
              </label>
              <label className={ui.formLabel}>
                Discount value
                <input className={ui.input} type="number" min="0" step="0.01" name="discountValue" value={couponForm.discountValue} onChange={handleCouponChange} placeholder="25" required />
              </label>
              <label className={ui.formLabel}>
                Starts
                <input className={ui.input} type="date" name="startsAt" value={couponForm.startsAt} onChange={handleCouponChange} />
              </label>
              <label className={ui.formLabel}>
                Expires
                <input className={ui.input} type="date" name="expiresAt" value={couponForm.expiresAt} onChange={handleCouponChange} />
              </label>
              <label className={ui.formLabel}>
                Usage limit
                <input className={ui.input} type="number" min="1" name="maxRedemptions" value={couponForm.maxRedemptions} onChange={handleCouponChange} placeholder="Unlimited" />
              </label>
              <label className={ui.formLabel}>
                Status
                <select className={ui.input} name="status" value={couponForm.status} onChange={handleCouponChange}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
            </div>

            <div className={ui.buttonRow}>
              <button type="submit" className={ui.primaryAction} disabled={savingCoupon}>
                {savingCoupon ? 'Saving...' : editingCouponId ? 'Update coupon' : 'Create coupon'}
              </button>
              {editingCouponId ? (
                <button type="button" className={ui.secondaryAction} onClick={resetCouponForm} disabled={savingCoupon}>
                  Cancel edit
                </button>
              ) : null}
            </div>
          </form>

          <div className="mt-5">
            {!loading && safeCoupons.length === 0 ? <div className={ui.emptyBox}>No coupon codes created yet.</div> : null}
            {safeCoupons.length ? (
              <div className={ui.tableShell}>
                <table className={ui.modernTable}>
                  <thead>
                    <tr>
                      <th className={ui.tableHeadCell}>Code</th>
                      <th className={ui.tableHeadCell}>Discount</th>
                      <th className={ui.tableHeadCell}>Window</th>
                      <th className={ui.tableHeadCell}>Usage</th>
                      <th className={ui.tableHeadCell}>Status</th>
                      <th className={ui.tableHeadCell}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {safeCoupons.map((coupon) => (
                      <tr key={coupon.id}>
                        <td className={ui.tableCell}>
                          <strong>{coupon.code}</strong>
                          {coupon.label ? <div className={ui.tableSubtext}>{coupon.label}</div> : null}
                        </td>
                        <td className={ui.tableCell}>
                          {coupon.discountType === 'percent' ? `${Number(coupon.discountValue).toFixed(2)}%` : `Fixed ${Number(coupon.discountValue).toFixed(2)}`}
                        </td>
                        <td className={ui.tableCell}>
                          <strong>{coupon.startsAt ? String(coupon.startsAt).slice(0, 10) : 'Now'}</strong>
                          <div className={ui.tableSubtext}>Ends {coupon.expiresAt ? String(coupon.expiresAt).slice(0, 10) : 'never'}</div>
                        </td>
                        <td className={ui.tableCell}>
                          {Number(coupon.redemptionCount || 0)} / {coupon.maxRedemptions || 'Unlimited'}
                        </td>
                        <td className={ui.tableCell}><span className={statusPill(coupon.status)}>{coupon.status}</span></td>
                        <td className={ui.tableCell}>
                          <div className={ui.buttonRow}>
                            <button type="button" className={ui.secondaryAction} onClick={() => startEditCoupon(coupon)}>Edit</button>
                            <button type="button" className={ui.dangerAction} onClick={() => handleCouponDelete(coupon)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </section>

          </>
        ) : null}

        {subscriptionView === 'students' ? (
          <>
        <section className={ui.panelCard}>
          <div className={ui.panelTop}>
            <div>
              <h2>Invoice lookup</h2>
              <p>Enter a simple invoice ID like 1122 to check card or bank transfer details.</p>
            </div>
          </div>
          <form className="grid gap-3 md:grid-cols-[minmax(180px,260px)_auto]" onSubmit={handleInvoiceLookup}>
            <input className={ui.input} value={invoiceSearch} onChange={(event) => setInvoiceSearch(event.target.value.replace(/\D/g, ''))} placeholder="1122" inputMode="numeric" />
            <button type="submit" className={ui.primaryAction} disabled={invoiceLookupLoading || !invoiceSearch.trim()}>
              {invoiceLookupLoading ? 'Checking...' : 'Check invoice'}
            </button>
          </form>
          {invoiceLookup ? (
            <div className="mt-4">
              {!invoiceLookup.found ? (
                <div className="rounded-lg border border-line-soft bg-surface-1 p-4">
                  <strong className="text-ink-strong">No invoice found for {invoiceLookup.invoiceId}.</strong>
                </div>
              ) : (
                <div className={ui.tableShell}>
                  <table className={ui.modernTable}>
                    <thead>
                      <tr>
                        <th className={ui.tableHeadCell}>Invoice Number</th>
                        <th className={ui.tableHeadCell}>Email</th>
                        <th className={ui.tableHeadCell}>Subscription Name</th>
                        <th className={ui.tableHeadCell}>Which Subscription</th>
                        <th className={ui.tableHeadCell}>Payment</th>
                        <th className={ui.tableHeadCell}>Proof</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className={ui.tableCell}>
                          <strong>#{invoiceLookup.invoiceId}</strong>
                          {invoiceLookup.orderId && invoiceLookup.orderId !== invoiceLookup.invoiceId ? (
                            <div className={ui.tableSubtext}>Order #{invoiceLookup.orderId}</div>
                          ) : null}
                        </td>
                        <td className={ui.tableCell}>
                          <strong>{invoiceLookup.studentName || 'Student'}</strong>
                          <div className={ui.tableSubtext}>{invoiceLookup.studentEmail || '-'}</div>
                        </td>
                        <td className={ui.tableCell}>
                          <strong>{invoiceLookup.planName || '-'}</strong>
                          {invoiceLookup.adminNote ? <div className={ui.tableSubtext}>{invoiceLookup.adminNote}</div> : null}
                        </td>
                        <td className={ui.tableCell}>
                          <span className={ui.tablePill}>{invoiceLookup.type === 'card' ? 'Card / PayHere' : 'Bank transfer'}</span>
                          <div className="mt-1">{statusPill(invoiceLookup.status)}</div>
                        </td>
                        <td className={ui.tableCell}>
                          <strong>
                            {invoiceLookup.currency} {invoiceLookup.amount === null || invoiceLookup.amount === undefined ? '-' : Number(invoiceLookup.amount).toFixed(2)}
                          </strong>
                          {invoiceLookup.type === 'card' && invoiceLookup.payherePaymentId ? (
                            <div className={ui.tableSubtext}>PayHere: {invoiceLookup.payherePaymentId}</div>
                          ) : null}
                          {invoiceLookup.type !== 'card' && invoiceLookup.paymentReference ? (
                            <div className={ui.tableSubtext}>Reference: {invoiceLookup.paymentReference}</div>
                          ) : null}
                        </td>
                        <td className={ui.tableCell}>
                          {invoiceLookup.paymentProofDataUrl ? (
                            <button type="button" className={ui.secondaryAction} onClick={() => setProofPreviewRequest(invoiceLookup)}>
                              View proof
                            </button>
                          ) : (
                            <span className={ui.tableSubtext}>No proof uploaded</span>
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : null}
        </section>

        <section className={ui.panelCard}>
          <div className={ui.panelTop}>
            <div>
              <h2>Upgrade requests</h2>
              <p>Approve or reject student plan requests before manually tracking payment.</p>
            </div>
          </div>

          {!loading && safeRequests.length === 0 ? <div className={ui.emptyBox}>No upgrade requests yet.</div> : null}
          {safeRequests.length ? (
            <div className={ui.tableShell}>
              <table className={ui.modernTable}>
                <thead>
                  <tr>
                    <th className={ui.tableHeadCell}>Student</th>
                    <th className={ui.tableHeadCell}>Plan</th>
                    <th className={ui.tableHeadCell}>Requested</th>
                    <th className={ui.tableHeadCell}>Status</th>
                    <th className={ui.tableHeadCell}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {safeRequests.map((request) => (
                    <tr key={request.id}>
                      <td className={ui.tableCell}>
                        <strong>{request.studentName}</strong>
                        <div className={ui.tableSubtext}>{request.studentEmail}</div>
                        {request.invoiceId ? <div className={ui.tableSubtext}>Invoice #{request.invoiceId}</div> : null}
                        {request.message ? <div className={ui.tableSubtext}>{request.message}</div> : null}
                        {request.paymentProofDataUrl ? (
                          <div className="mt-2 grid gap-1">
                            <span className={statusPill('paid')}>Bank transfer proof uploaded</span>
                            {request.paymentReference ? <div className={ui.tableSubtext}>Reference: {request.paymentReference}</div> : null}
                            <button type="button" className="justify-self-start border-0 bg-transparent p-0 text-[12px] font-bold text-brand-primary" onClick={() => setProofPreviewRequest(request)}>
                              View slip / screenshot
                            </button>
                          </div>
                        ) : null}
                      </td>
                      <td className={ui.tableCell}>
                        <strong>{request.planName}</strong>
                        <div className={ui.tableSubtext}>{request.planCurrency} {Number(request.planEffectivePrice).toFixed(2)}</div>
                        {request.paymentAmount !== null && request.paymentAmount !== undefined ? (
                          <div className={ui.tableSubtext}>Uploaded payment: {request.paymentCurrency || request.planCurrency} {Number(request.paymentAmount).toFixed(2)}</div>
                        ) : null}
                      </td>
                      <td className={ui.tableCell}>{request.requestedAt || '-'}</td>
                      <td className={ui.tableCell}><span className={statusPill(request.status)}>{request.status}</span></td>
                      <td className={ui.tableCell}>
                        {request.status === 'pending' ? (
                          <div className={ui.buttonRow}>
                            <button type="button" className={ui.primaryAction} disabled={Boolean(actionBusyId)} onClick={() => handleResolveRequest(request, 'approved')}>
                              {actionBusyId === `request-${request.id}-approved` ? 'Approving...' : 'Approve'}
                            </button>
                            <button type="button" className={ui.secondaryAction} disabled={Boolean(actionBusyId)} onClick={() => handleResolveRequest(request, 'rejected')}>
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className={ui.tableSubtext}>{request.adminNote || request.resolvedByName || '-'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>

        <div className={subscriptionUi.adminGrid}>
          <section className={ui.panelCard}>
            <div className={ui.panelTop}>
              <div>
                <h2>Assign subscription</h2>
                <p>Manually activate, queue, or renew a student subscription.</p>
              </div>
            </div>

            <form className={ui.stackForm} onSubmit={handleAssignSubmit}>
              <div className={subscriptionUi.metaGrid}>
                <StudentSearchSelect
                  students={safeStudents}
                  value={assignForm.userId}
                  onChange={handleAssignStudentChange}
                />

                <label className={ui.formLabel}>
                  Plan
                  <select className={ui.input} name="planId" value={assignForm.planId} onChange={handleAssignChange} required>
                    <option value="">Select plan</option>
                    {safePlans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name} ({plan.currency} {Number(plan.effectivePrice).toFixed(2)})
                      </option>
                    ))}
                  </select>
                </label>

                <label className={ui.formLabel}>
                  Start date
                  <input className={ui.input} type="date" name="startDate" value={assignForm.startDate} onChange={handleAssignChange} />
                </label>

                <label className={ui.formLabel}>
                  End date
                  <input className={ui.input} type="date" name="endDate" value={assignForm.endDate} onChange={handleAssignChange} />
                </label>

                <label className={ui.formLabel}>
                  Status
                  <select className={ui.input} name="status" value={assignForm.status} onChange={handleAssignChange}>
                    <option value="active">Active</option>
                    <option value="pending">Pending</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </label>

                <label className={ui.formLabel}>
                  Payment status
                  <select className={ui.input} name="paymentStatus" value={assignForm.paymentStatus} onChange={handleAssignChange}>
                    <option value="manual">Manual</option>
                    <option value="paid">Paid</option>
                    <option value="unpaid">Unpaid</option>
                    <option value="waived">Waived</option>
                  </select>
                </label>

                <label className={ui.formLabel}>
                  Amount paid
                  <input className={ui.input} type="number" min="0" step="0.01" name="amountPaid" value={assignForm.amountPaid} onChange={handleAssignChange} placeholder="Optional" />
                </label>

                <label className={ui.formLabel}>
                  Payment method
                  <input className={ui.input} name="paymentMethod" value={assignForm.paymentMethod} onChange={handleAssignChange} placeholder="Cash, bank, card..." />
                </label>

                <label className={ui.formLabel}>
                  Reference
                  <input className={ui.input} name="paymentReference" value={assignForm.paymentReference} onChange={handleAssignChange} placeholder="Receipt or transaction ID" />
                </label>

                <label className={ui.formLabel}>
                  Payment date
                  <input className={ui.input} type="date" name="paymentDate" value={assignForm.paymentDate} onChange={handleAssignChange} />
                </label>
              </div>

              <div className={subscriptionUi.assignDurationPanel}>
                <div>
                  <strong className="text-[13px] text-ink-strong">Quick duration</strong>
                  <p className="m-0 mt-1 text-[12px] leading-relaxed text-ink-soft">
                    Choose a preset from the start date, or edit the date fields manually any time.
                  </p>
                </div>
                <div className={subscriptionUi.durationButtons}>
                  {ASSIGN_DURATION_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      className={subscriptionUi.durationButton}
                      onClick={() => applyAssignDuration(preset)}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className={subscriptionUi.accessScopePanel}>
                <div>
                  <strong className="text-[13px] text-ink-strong">Content access</strong>
                  <p className="m-0 mt-1 text-[12px] leading-relaxed text-ink-soft">
                    Limit single-course or single-lesson purchases while keeping free lessons available.
                  </p>
                </div>
                <div className={subscriptionUi.accessScopeGrid}>
                  <label className={ui.formLabel}>
                    Unlock
                    <select className={ui.input} name="accessScope" value={assignForm.accessScope} onChange={handleAssignChange}>
                      <option value="all">All paid lessons in plan</option>
                      <option value="courses">Selected course(s)</option>
                      <option value="lessons">Selected lesson(s)</option>
                    </select>
                  </label>

                  {assignForm.accessScope === 'courses' ? (
                    <label className={ui.formLabel}>
                      Courses
                      <select
                        className={ui.input}
                        name="courseIds"
                        value={assignForm.courseIds.map(String)}
                        onChange={handleAssignChange}
                        multiple
                        size={Math.min(7, Math.max(3, safeCourses.length || 3))}
                        required
                      >
                        {safeCourses.map((course) => (
                          <option key={course.id} value={course.id}>
                            {course.courseTitle}
                          </option>
                        ))}
                      </select>
                      <span className={subscriptionUi.accessHint}>Hold Cmd/Ctrl to select more than one course.</span>
                    </label>
                  ) : null}

                  {assignForm.accessScope === 'lessons' ? (
                    <label className={ui.formLabel}>
                      Lessons
                      <select
                        className={ui.input}
                        name="lessonIds"
                        value={assignForm.lessonIds.map(String)}
                        onChange={handleAssignChange}
                        multiple
                        size={Math.min(8, Math.max(3, safeLessons.length || 3))}
                        required
                      >
                        {safeLessons.map((lesson) => (
                          <option key={lesson.id} value={lesson.id}>
                            {lesson.courseTitle} - {lesson.lessonTitle}
                          </option>
                        ))}
                      </select>
                      <span className={subscriptionUi.accessHint}>Only these paid lessons unlock. Free lessons stay open.</span>
                    </label>
                  ) : (
                    <div className={subscriptionUi.accessHint}>
                      The subscription behaves like a normal plan and unlocks every paid lesson included by its features.
                    </div>
                  )}
                </div>
              </div>

              <label className={ui.formLabel}>
                Notes
                <textarea className={ui.textarea} name="notes" rows="3" value={assignForm.notes} onChange={handleAssignChange} />
              </label>

              <label className={ui.formLabel}>
                Receipt URL
                <input className={ui.input} name="receiptUrl" value={assignForm.receiptUrl} onChange={handleAssignChange} placeholder="Optional link to receipt or proof" />
              </label>

              <div className={ui.buttonRow}>
                <button type="submit" className={ui.primaryAction} disabled={assigning}>{assigning ? 'Assigning...' : 'Assign subscription'}</button>
              </div>
            </form>
          </section>

          <section className={ui.panelCard}>
            <div className={ui.panelTop}>
              <div>
                <h2>Active and recent subscriptions</h2>
                <p>Track current assignments, payment status, and who assigned each subscription.</p>
              </div>
            </div>

            <div className="mb-4 grid gap-3 md:grid-cols-[minmax(180px,1fr)_150px_140px_140px_130px_auto]">
              <input className={ui.input} name="search" value={subscriptionFilters.search} onChange={handleSubscriptionFilterChange} placeholder="Search student or plan" />
              <select className={ui.input} name="planId" value={subscriptionFilters.planId} onChange={handleSubscriptionFilterChange}>
                <option value="">All plans</option>
                {safePlans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
              </select>
              <select className={ui.input} name="status" value={subscriptionFilters.status} onChange={handleSubscriptionFilterChange}>
                <option value="">All status</option>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="expired">Expired</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <select className={ui.input} name="paymentStatus" value={subscriptionFilters.paymentStatus} onChange={handleSubscriptionFilterChange}>
                <option value="">All payments</option>
                <option value="manual">Manual</option>
                <option value="paid">Paid</option>
                <option value="unpaid">Unpaid</option>
                <option value="waived">Waived</option>
              </select>
              <select className={ui.input} name="expiring" value={subscriptionFilters.expiring} onChange={handleSubscriptionFilterChange}>
                <option value="">Any expiry</option>
                <option value="soon">Expiring soon</option>
              </select>
              <button type="button" className={ui.secondaryAction} onClick={() => setSubscriptionFilters(emptySubscriptionFilters)}>Reset</button>
            </div>

            <div className={ui.tableShell}>
              <table className={ui.modernTable}>
                <thead>
                  <tr>
                    <th className={ui.tableHeadCell}>Student</th>
                    <th className={ui.tableHeadCell}>Plan</th>
                    <th className={ui.tableHeadCell}>Dates</th>
                    <th className={ui.tableHeadCell}>Status</th>
                    <th className={ui.tableHeadCell}>Payment</th>
                    <th className={ui.tableHeadCell}>Assigned by</th>
                    <th className={ui.tableHeadCell}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="7" className={ui.tableEmpty}>Loading subscriptions...</td>
                    </tr>
                  ) : null}
                  {!loading && filteredSubscriptions.length === 0 ? (
                    <tr>
                      <td colSpan="7" className={ui.tableEmpty}>No subscriptions match the current filters.</td>
                    </tr>
                  ) : null}
                  {!loading && filteredSubscriptions.map((subscription) => (
                    <tr key={subscription.id}>
                      <td className={ui.tableCell}>
                        <strong>{subscription.studentName}</strong>
                        <div className={ui.tableSubtext}>{subscription.studentEmail}</div>
                      </td>
                      <td className={ui.tableCell}>
                        <strong>{subscription.planName}</strong>
                        <div className={ui.tableSubtext}>
                          {subscription.planCurrency} {Number(subscription.planEffectivePrice).toFixed(2)}
                        </div>
                        {subscription.accessScope === 'courses' ? (
                          <div className={ui.tableSubtext}>
                            Courses: {(subscription.courseIds || []).map((id) => courseTitleById.get(Number(id)) || `#${id}`).join(', ') || '-'}
                          </div>
                        ) : subscription.accessScope === 'lessons' ? (
                          <div className={ui.tableSubtext}>
                            Lessons: {(subscription.lessonIds || []).map((id) => lessonTitleById.get(Number(id)) || `#${id}`).join(', ') || '-'}
                          </div>
                        ) : (
                          <div className={ui.tableSubtext}>Access: all paid lessons</div>
                        )}
                      </td>
                      <td className={ui.tableCell}>
                        <strong>{subscription.startDate}</strong>
                        <div className={ui.tableSubtext}>Ends {subscription.endDate}</div>
                        {subscription.isExpiringSoon ? <div className={ui.tableSubtext}>Expires in {subscription.daysRemaining} day(s)</div> : null}
                      </td>
                      <td className={ui.tableCell}><span className={statusPill(subscription.computedStatus || subscription.status)}>{subscription.computedStatus || subscription.status}</span></td>
                      <td className={ui.tableCell}>
                        <span className={statusPill(subscription.paymentStatus)}>{subscription.paymentStatus}</span>
                        {subscription.amountPaid !== null && subscription.amountPaid !== undefined ? (
                          <div className={ui.tableSubtext}>{subscription.planCurrency} {Number(subscription.amountPaid).toFixed(2)} {subscription.paymentMethod || ''}</div>
                        ) : null}
                        {subscription.paymentReference ? <div className={ui.tableSubtext}>{subscription.paymentReference}</div> : null}
                      </td>
                      <td className={ui.tableCell}>{subscription.assignedByName || '-'}</td>
                      <td className={ui.tableCell}>
                        <div className={ui.buttonRow}>
                          <button type="button" className={ui.secondaryAction} disabled={Boolean(actionBusyId)} onClick={() => handleExtend(subscription, 7)}>+7d</button>
                          <button type="button" className={ui.secondaryAction} disabled={Boolean(actionBusyId)} onClick={() => handleExtend(subscription, 30)}>+30d</button>
                          <button type="button" className={ui.secondaryAction} disabled={Boolean(actionBusyId)} onClick={() => handleRenew(subscription)}>Renew</button>
                          <button type="button" className={ui.secondaryAction} disabled={Boolean(actionBusyId)} onClick={() => handlePayment(subscription)}>Paid</button>
                          <button type="button" className={ui.dangerAction || ui.secondaryAction} disabled={Boolean(actionBusyId)} onClick={() => handleCancel(subscription)}>Cancel</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <section className={ui.panelCard}>
          <div className={ui.panelTop}>
            <div>
              <h2>Subscription audit log</h2>
              <p>Recent subscription assignments, approvals, renewals, extensions, cancellations, and payment updates.</p>
            </div>
          </div>

          {!loading && safeAuditEvents.length === 0 ? <div className={ui.emptyBox}>No subscription audit events yet.</div> : null}
          {safeAuditEvents.length ? (
            <div className="grid gap-2.5">
              {safeAuditEvents.slice(0, 24).map((event) => (
                <article className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-line-soft bg-surface-1 px-4 py-3 shadow-xs" key={event.id}>
                  <div>
                    <strong className="text-[13px] text-ink-strong">{event.summary}</strong>
                    <div className={ui.tableSubtext}>
                      {event.studentName || 'System'} • {event.actorName || 'System'} • {event.createdAt || '-'}
                    </div>
                  </div>
                  <span className={ui.tablePill}>{event.eventType}</span>
                </article>
              ))}
            </div>
          ) : null}
        </section>

          </>
        ) : null}

        <EntityModal
          open={planModalOpen}
          onClose={resetPlanForm}
          wide
          title={editingPlanId ? 'Edit plan' : 'Add plan'}
          subtitle="Set pricing, offers, status, and feature access in one focused popup."
        >
          <form className={cx(ui.stackForm, ui.modalForm, 'px-6 pb-6 pt-[22px]')} onSubmit={handlePlanSubmit}>
            <div className={subscriptionUi.templateRow}>
              {planTemplates.map((template) => (
                <button key={template.label} type="button" className={ui.secondaryAction} onClick={() => applyPlanTemplate(template)}>
                  Use {template.label}
                </button>
              ))}
            </div>

            <div className={subscriptionUi.metaGrid}>
              <label className={ui.formLabel}>
                Plan name
                <input className={ui.input} name="name" value={planForm.name} onChange={handlePlanChange} required />
              </label>
              <label className={ui.formLabel}>
                Slug
                <input className={ui.input} name="slug" value={planForm.slug} onChange={handlePlanChange} placeholder="basic" />
              </label>
              <label className={ui.formLabel}>
                Regular price
                <input className={ui.input} type="number" min="0" step="0.01" name="regularPrice" value={planForm.regularPrice} onChange={handlePlanChange} required />
              </label>
              <label className={ui.formLabel}>
                Offer price
                <input className={ui.input} type="number" min="0" step="0.01" name="offerPrice" value={planForm.offerPrice} onChange={handlePlanChange} placeholder="Optional" />
              </label>
              <label className={ui.formLabel}>
                Currency
                <input className={ui.input} name="currency" value={planForm.currency} onChange={handlePlanChange} required />
              </label>
              <label className={ui.formLabel}>
                Duration (days)
                <input className={ui.input} type="number" min="1" name="durationDays" value={planForm.durationDays} onChange={handlePlanChange} required />
              </label>
              <label className={ui.formLabel}>
                Sort order
                <input className={ui.input} type="number" min="0" name="sortOrder" value={planForm.sortOrder} onChange={handlePlanChange} />
              </label>
              <label className={ui.formLabel}>
                Status
                <select className={ui.input} name="status" value={planForm.status} onChange={handlePlanChange}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
            </div>

            <label className={ui.formLabel}>
              Description
              <textarea className={ui.textarea} name="description" rows="3" value={planForm.description} onChange={handlePlanChange} />
            </label>

            <div className={subscriptionUi.toggleGrid}>
              <label className={ui.checkboxRow}>
                <input className="mt-px size-[18px] shrink-0 cursor-pointer accent-brand-primary" type="checkbox" name="offerEnabled" checked={planForm.offerEnabled} onChange={handlePlanChange} />
                <span>Enable offer / discount price</span>
              </label>
              <label className={ui.checkboxRow}>
                <input className="mt-px size-[18px] shrink-0 cursor-pointer accent-brand-primary" type="checkbox" name="recommended" checked={planForm.recommended} onChange={handlePlanChange} />
                <span>Mark as recommended plan</span>
              </label>
            </div>

            <div className={subscriptionUi.featurePanel}>
              <div className={ui.panelTop}>
                <div>
                  <h2>Feature checklist</h2>
                  <p>These features are labeled to match the pages and tools inside your LMS.</p>
                </div>
                <div className={subscriptionUi.miniStats}>
                  <span className={ui.tablePill}>{planForm.featureIds.length} selected</span>
                </div>
              </div>

              <PlanFeatureChecklist groupedFeatures={groupedFeatures} selectedIds={planForm.featureIds} onToggle={togglePlanFeature} />
            </div>

            <div className={ui.buttonRow}>
              <button type="submit" className={ui.primaryAction} disabled={savingPlan}>
                {savingPlan ? 'Saving...' : editingPlanId ? 'Update plan' : 'Create plan'}
              </button>
              <button type="button" className={ui.secondaryAction} onClick={resetPlanForm} disabled={savingPlan}>
                Cancel
              </button>
            </div>
          </form>
        </EntityModal>

        <EntityModal
          open={featureModalOpen}
          onClose={resetFeatureForm}
          title={editingFeatureId ? 'Edit feature' : 'Add feature'}
          subtitle="Manage the master feature list that appears as plan checkboxes."
        >
          <form className={cx(ui.stackForm, ui.modalForm, 'question-modal-form gap-[18px]')} onSubmit={handleFeatureSubmit}>
            <div className={subscriptionUi.metaGrid}>
              <label className={ui.formLabel}>
                Feature name
                <input className={ui.input} name="featureName" value={featureForm.featureName} onChange={handleFeatureChange} required />
              </label>
              <label className={ui.formLabel}>
                Feature key
                <input className={ui.input} name="featureKey" value={featureForm.featureKey} onChange={handleFeatureChange} placeholder="ai_quiz_generator" required />
              </label>
              <label className={ui.formLabel}>
                Category
                <select className={ui.input} name="category" value={featureForm.category} onChange={handleFeatureChange}>
                  {safeFeatureCategories.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </label>
              <label className={ui.formLabel}>
                Status
                <select className={ui.input} name="status" value={featureForm.status} onChange={handleFeatureChange}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
            </div>

            <label className={ui.formLabel}>
              Description
              <textarea className={ui.textarea} name="description" rows="2" value={featureForm.description} onChange={handleFeatureChange} />
            </label>

            <div className={ui.buttonRow}>
              <button type="submit" className={ui.primaryAction} disabled={savingFeature}>
                {savingFeature ? 'Saving...' : editingFeatureId ? 'Update feature' : 'Create feature'}
              </button>
              <button type="button" className={ui.secondaryAction} onClick={resetFeatureForm} disabled={savingFeature}>
                Cancel
              </button>
            </div>
          </form>
        </EntityModal>

        <EntityModal
          open={Boolean(proofPreviewRequest)}
          onClose={() => setProofPreviewRequest(null)}
          title="Bank transfer proof"
          subtitle={proofPreviewRequest ? `${proofPreviewRequest.studentName || 'Student'} - ${proofPreviewRequest.planName || 'Plan'}` : ''}
          wide
        >
          {proofPreviewRequest ? <BankTransferProofPreview request={proofPreviewRequest} /> : null}
        </EntityModal>
      </section>
    </main>
  );
}
