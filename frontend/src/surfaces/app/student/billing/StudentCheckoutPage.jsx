import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { fetchMySubscription, initiatePayHereCheckout, readMySubscriptionCache, requestManualPayment } from '../../../../shared/api/subscriptions.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { AppHeader } from '../../../../shared/layout/AppHeader.jsx';
import { useAuthStore } from '../../../../shared/stores/authStore.js';
import { cx, ui } from '../../../../shared/styles/tailwindClasses.js';
import { FeedbackNotice } from '../../../../shared/ui/FeedbackNotice.jsx';
import { hasUnsafeFileNameCharacters } from '../../../../shared/utils/fileValidation.js';

function getPlanDurationLabel(plan) {
  const days = Number(plan?.durationDays || 0);
  if (!days) return 'Plan duration is confirmed after checkout';
  if (days % 30 === 0) {
    const months = Math.round(days / 30);
    return `${months} month${months === 1 ? '' : 's'} of access`;
  }
  return `${days} day${days === 1 ? '' : 's'} of access`;
}

function getAccessScopeLabel(accessScope, courseIds, lessonIds) {
  if (accessScope === 'courses') {
    const count = courseIds.length;
    return count ? `${count} selected course${count === 1 ? '' : 's'}` : 'Selected course access';
  }
  if (accessScope === 'lessons') {
    const count = lessonIds.length;
    return count ? `${count} selected lesson${count === 1 ? '' : 's'}` : 'Selected lesson access';
  }
  return 'Full plan coverage';
}

function getPlanBenefitGroups(plan) {
  const featureKeys = new Set((Array.isArray(plan?.enabledFeatures) ? plan.enabledFeatures : [])
    .map((feature) => String(feature.featureKey || feature.key || '').trim())
    .filter(Boolean));

  const groups = [
    {
      label: 'Learn',
      detail: 'Lessons and study materials',
      keys: ['lessons_access_full', 'lessons_access_limited', 'notes_canvas_study_mode'],
    },
    {
      label: 'Practice',
      detail: 'Question practice and exam preparation',
      keys: ['question_bank_full', 'question_bank_limited', 'practice_mode', 'exam_mode', 'mock_paper_access', 'past_paper_access'],
    },
    {
      label: 'Review',
      detail: 'Results, progress, and revision history',
      keys: ['results_tracking', 'progress_tracking_basic', 'progress_tracking_advanced', 'performance_analytics', 'weak_area_analysis'],
    },
    {
      label: 'Support',
      detail: 'Help tools and student support features',
      keys: ['report_question', 'ai_quiz_generator'],
    },
  ];

  return groups.filter((group) => group.keys.some((key) => featureKeys.has(key))).slice(0, 3);
}

function getCheckoutBilling(data) {
  return {
    availablePlans: Array.isArray(data?.availablePlans) ? data.availablePlans : [],
    payment: data?.payment || null,
  };
}

function submitHostedCheckout(checkout) {
  if (!checkout?.actionUrl || !checkout?.fields) {
    throw new Error('PayHere checkout details were not returned by the server.');
  }

  const form = document.createElement('form');
  form.method = 'POST';
  form.action = checkout.actionUrl;
  form.style.display = 'none';

  Object.entries(checkout.fields).forEach(([name, value]) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = String(value ?? '');
    form.appendChild(input);
  });

  document.body.appendChild(form);
  form.submit();
}

const PAYMENT_PROOF_MAX_BYTES = 4 * 1024 * 1024;
const PAYMENT_PROOF_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'application/pdf']);

function validatePaymentProofFile(file) {
  if (!file) return 'Please upload the bank slip or payment screenshot.';
  const name = String(file.name || 'payment-proof').trim();
  if (!PAYMENT_PROOF_TYPES.has(String(file.type || '').toLowerCase())) {
    return 'Upload a PNG, JPG, WEBP, or PDF payment proof.';
  }
  if (file.size > PAYMENT_PROOF_MAX_BYTES) {
    return 'Payment proof is too large. Please upload a file under 4MB.';
  }
  if (!name || name.length > 180 || hasUnsafeFileNameCharacters(name)) {
    return 'Rename the proof file without special path characters, then upload again.';
  }
  return '';
}

function readProofFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Unable to read payment proof file'));
    reader.readAsDataURL(file);
  });
}

export function StudentCheckoutPage() {
  const { planId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const customSelectionNote = String(location.state?.customSelectionNote || '').trim();
  const accessScope = location.state?.accessScope || 'all';
  const courseIds = useMemo(
    () => (Array.isArray(location.state?.courseIds) ? location.state.courseIds.map(Number).filter(Boolean) : []),
    [location.state?.courseIds]
  );
  const lessonIds = useMemo(
    () => (Array.isArray(location.state?.lessonIds) ? location.state.lessonIds.map(Number).filter(Boolean) : []),
    [location.state?.lessonIds]
  );
  const [billing, setBilling] = useState(() => getCheckoutBilling(readMySubscriptionCache()));
  const [loading, setLoading] = useState(() => readMySubscriptionCache() === undefined);
  const [submitting, setSubmitting] = useState(false);
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [paymentMode, setPaymentMode] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [proofFile, setProofFile] = useState(null);
  const [form, setForm] = useState({
    billingName: user?.fullName || '',
    billingEmail: user?.email || '',
    phone: '',
    address: '',
    city: 'Colombo',
    country: 'Sri Lanka',
  });

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    setForm((current) => ({
      ...current,
      billingName: current.billingName || user?.fullName || '',
      billingEmail: current.billingEmail || user?.email || '',
    }));
  }, [user?.fullName, user?.email]);

  async function load() {
    setLoading(readMySubscriptionCache() === undefined);
    setError('');
    try {
      const data = await fetchMySubscription();
      setBilling(getCheckoutBilling(data));
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Unable to load checkout details'));
    } finally {
      setLoading(false);
    }
  }

  const plan = useMemo(() => {
    return billing.availablePlans.find((item) => String(item?.id) === String(planId)) || null;
  }, [billing.availablePlans, planId]);
  const planBenefitGroups = useMemo(() => getPlanBenefitGroups(plan), [plan]);
  const accessScopeLabel = useMemo(() => getAccessScopeLabel(accessScope, courseIds, lessonIds), [accessScope, courseIds, lessonIds]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function goBackToPlans() {
    navigate('/subscriptions', {
      state: { fromCheckout: true },
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!plan) return;
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const checkout = await initiatePayHereCheckout({
        planId: plan.id,
        message: customSelectionNote || undefined,
        accessScope,
        courseIds: accessScope === 'courses' ? courseIds : [],
        lessonIds: accessScope === 'lessons' ? lessonIds : [],
        ...form,
      });
      submitHostedCheckout(checkout);
    } catch (submitError) {
      setError(getErrorMessage(submitError, 'Unable to create PayHere order'));
      setSubmitting(false);
    }
  }

  async function handleManualSubmit(event) {
    event.preventDefault();
    if (!plan) return;
    const proofError = validatePaymentProofFile(proofFile);
    if (proofError) {
      setError(proofError);
      return;
    }

    setManualSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const proofDataUrl = await readProofFile(proofFile);
      const result = await requestManualPayment({
        planId: plan.id,
        couponCode: couponCode.trim() || undefined,
        paymentReference: paymentReference.trim() || undefined,
        proofFileName: proofFile.name,
        proofMimeType: proofFile.type,
        proofDataUrl,
        message: customSelectionNote || undefined,
        accessScope,
        courseIds: accessScope === 'courses' ? courseIds : [],
        lessonIds: accessScope === 'lessons' ? lessonIds : [],
      });
      setSuccess(result?.couponCode
        ? `Payment proof uploaded. Invoice #${result.invoiceId || 'created'} is waiting for admin approval. Coupon ${result.couponCode} applied; bank transfer amount is ${result.currency || plan.currency} ${result.amount}.`
        : `Payment proof uploaded. Invoice #${result?.invoiceId || 'created'} is waiting for admin approval.`);
      setProofFile(null);
      setPaymentReference('');
      setCouponCode('');
      await load();
    } catch (submitError) {
      setError(getErrorMessage(submitError, 'Unable to upload bank transfer proof'));
    } finally {
      setManualSubmitting(false);
    }
  }

  return (
    <main className="dashboard-page study-hub-page student-checkout-page">
      <section className="study-hub-shell">
        <AppHeader
          title="Checkout"
          subtitle="Plan Checkout"
          actions={(
            <button className={cx(ui.secondaryAction, 'whitespace-nowrap')} type="button" onClick={goBackToPlans}>
              Back to plans
            </button>
          )}
        />

        {error ? <FeedbackNotice tone="error">{error}</FeedbackNotice> : null}
        {success ? <FeedbackNotice tone="success">{success}</FeedbackNotice> : null}
        {loading ? <div className={ui.emptyBox}>Loading checkout...</div> : null}
        {!loading && !plan ? (
          <div className={ui.emptyBox}>This plan is not available. Please choose another subscription plan.</div>
        ) : null}

        {!loading && plan ? (
          <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(320px,1.1fr)] gap-5 max-[900px]:grid-cols-1">
            <section className={cx(ui.panelCard, 'grid gap-4')}>
              <div>
                <span className={ui.eyebrow}>Order summary</span>
                <h2 className="m-0 mt-2 text-2xl font-extrabold text-ink-strong">{plan.name}</h2>
                <p className="m-0 mt-2 text-[13px] leading-relaxed text-ink-soft">{plan.description}</p>
              </div>
              <div>
                <strong className="text-3xl font-black text-brand-primary">{plan.currency} {Number(plan.effectivePrice).toFixed(2)}</strong>
                {plan.offerEnabled && Number(plan.regularPrice || 0) > Number(plan.effectivePrice || 0) ? (
                  <span className="ml-2 text-sm font-semibold text-ink-muted line-through">{plan.currency} {Number(plan.regularPrice).toFixed(2)}</span>
                ) : null}
              </div>
              <div className="grid gap-3 rounded-xl border border-line-soft bg-surface-2 p-3.5">
                <div>
                  <span className={ui.eyebrow}>Quick summary</span>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] font-extrabold text-ink-soft">
                    <span className={ui.tablePill}>xyndrome</span>
                    <span aria-hidden="true">/</span>
                    <span className={ui.tablePill}>{plan.name}</span>
                    <span aria-hidden="true">/</span>
                    <span className={ui.tablePill}>{accessScopeLabel}</span>
                  </div>
                </div>

                <div className="grid gap-2 text-[13px] leading-relaxed text-ink-soft">
                  <div className="flex items-start justify-between gap-3 rounded-lg bg-surface-card px-3 py-2">
                    <span>Duration</span>
                    <strong className="text-right text-ink-strong">{getPlanDurationLabel(plan)}</strong>
                  </div>
                  <div className="flex items-start justify-between gap-3 rounded-lg bg-surface-card px-3 py-2">
                    <span>Activation</span>
                    <strong className="text-right text-ink-strong">After payment confirmation</strong>
                  </div>
                </div>

                {customSelectionNote ? <FeedbackNotice tone="success">{customSelectionNote}</FeedbackNotice> : null}

                {planBenefitGroups.length ? (
                  <div className="grid gap-2">
                    {planBenefitGroups.map((group) => (
                      <div className="flex items-start justify-between gap-3 rounded-lg border border-line-soft bg-surface-card px-3 py-2" key={group.label}>
                        <div>
                          <strong className="block text-[13px] text-ink-strong">{group.label}</strong>
                          <span className="text-[12px] leading-relaxed text-ink-soft">{group.detail}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </section>

            <div className="grid gap-5">
              <section className={ui.panelCard}>
                <div className={ui.panelTop}>
                  <div>
                    <h2>Payment method</h2>
                    <p>Choose how you want to pay for this package.</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 max-[640px]:grid-cols-1">
                  <button
                    type="button"
                    className={paymentMode === 'card' ? ui.primaryAction : ui.secondaryAction}
                    onClick={() => setPaymentMode('card')}
                  >
                    Card / PayHere
                  </button>
                  <button
                    type="button"
                    className={paymentMode === 'manual' ? ui.primaryAction : ui.secondaryAction}
                    onClick={() => setPaymentMode('manual')}
                  >
                    Bank transfer
                  </button>
                </div>
              </section>

              {paymentMode === 'card' ? (
                <section className={ui.panelCard}>
                  <div className={ui.panelTop}>
                    <div>
                      <h2>Billing information</h2>
                      <p>These details are sent with your PayHere order. Coupon codes are available for bank transfers only.</p>
                    </div>
                  </div>
                  <form className={ui.stackForm} onSubmit={handleSubmit}>
                    <div className={ui.formGrid}>
                      <label className={ui.formLabel}>
                        Full name
                        <input className={ui.input} name="billingName" value={form.billingName} onChange={handleChange} required autoComplete="name" />
                      </label>
                      <label className={ui.formLabel}>
                        Email
                        <input className={ui.input} name="billingEmail" type="email" value={form.billingEmail} onChange={handleChange} required autoComplete="email" />
                      </label>
                      <label className={ui.formLabel}>
                        Phone
                        <input className={ui.input} name="phone" value={form.phone} onChange={handleChange} placeholder="0771234567" autoComplete="tel" />
                      </label>
                      <label className={ui.formLabel}>
                        City
                        <input className={ui.input} name="city" value={form.city} onChange={handleChange} autoComplete="address-level2" />
                      </label>
                    </div>
                    <label className={ui.formLabel}>
                      Address
                      <input className={ui.input} name="address" value={form.address} onChange={handleChange} placeholder="Optional" autoComplete="street-address" />
                    </label>
                    <label className={ui.formLabel}>
                      Country
                      <input className={ui.input} name="country" value={form.country} onChange={handleChange} autoComplete="country-name" />
                    </label>
                    <div className={ui.buttonRow}>
                      <button className={ui.primaryAction} type="submit" disabled={submitting || !billing.payment?.enabled || !billing.payment?.configured}>
                        {submitting ? 'Creating order...' : 'Continue to PayHere'}
                      </button>
                      <button className={ui.secondaryAction} type="button" onClick={goBackToPlans} disabled={submitting}>
                        Change plan
                      </button>
                    </div>
                  </form>
                </section>
              ) : null}

              {paymentMode === 'manual' ? (
                <section className={ui.panelCard}>
                  <div className={ui.panelTop}>
                    <div>
                      <h2>Bank transfer</h2>
                      <p>Upload the slip for admin approval.</p>
                    </div>
                  </div>
                  <form className={ui.stackForm} onSubmit={handleManualSubmit}>
                    <FeedbackNotice tone="warning">
                      Your package will activate only after the admin verifies this payment proof.
                    </FeedbackNotice>
                    <label className={ui.formLabel}>
                      Coupon code
                      <input className={ui.input} value={couponCode} onChange={(event) => setCouponCode(event.target.value)} placeholder="Optional bank transfer coupon" autoComplete="off" />
                    </label>
                    <label className={ui.formLabel}>
                      Reference or transaction ID
                      <input className={ui.input} value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} placeholder="Optional bank reference" autoComplete="off" />
                    </label>
                    <label className={ui.formLabel}>
                      Upload slip or screenshot
                      <input
                        className={ui.input}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,application/pdf"
                        onChange={(event) => {
                          const nextFile = event.target.files?.[0] || null;
                          const proofError = validatePaymentProofFile(nextFile);
                          if (proofError && nextFile) {
                            setError(proofError);
                            setProofFile(null);
                            event.target.value = '';
                            return;
                          }
                          setError('');
                          setProofFile(nextFile);
                        }}
                      />
                    </label>
                    {proofFile ? <div className={ui.tableSubtext}>{proofFile.name}</div> : null}
                    <div className={ui.buttonRow}>
                      <button className={ui.primaryAction} type="submit" disabled={manualSubmitting || submitting}>
                        {manualSubmitting ? 'Uploading proof...' : 'Upload proof for admin approval'}
                      </button>
                      <button className={ui.secondaryAction} type="button" onClick={goBackToPlans} disabled={manualSubmitting}>
                        Change plan
                      </button>
                    </div>
                  </form>
                </section>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
