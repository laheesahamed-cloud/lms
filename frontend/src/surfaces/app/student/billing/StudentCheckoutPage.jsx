import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { fetchMySubscription, initiatePayHereCheckout, readMySubscriptionCache, requestManualPayment } from '../../../../shared/api/subscriptions.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { AppHeader } from '../../../../shared/layout/AppHeader.jsx';
import { useAuthStore } from '../../../../shared/stores/authStore.js';
import { cx, ui } from '../../../../shared/styles/tailwindClasses.js';
import { FeedbackNotice } from '../../../../shared/ui/FeedbackNotice.jsx';
import { SuccessBurst } from '../../../../shared/ui/SuccessBurst.jsx';
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

function getCheckoutBilling(data) {
  return {
    availablePlans: Array.isArray(data?.availablePlans) ? data.availablePlans : [],
    requests: Array.isArray(data?.requests) ? data.requests : [],
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
  const paymentCartNotice = String(location.state?.paymentCartNotice || '').trim();
  const shouldCreateManualInvoice = Boolean(location.state?.createManualInvoice);
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
  const [manualInvoice, setManualInvoice] = useState(null);
  const [manualInvoiceLoading, setManualInvoiceLoading] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [proofFile, setProofFile] = useState(null);
  const invoiceAutoCreatePlanRef = useRef('');
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
    setLoading(true);
    setError('');
    try {
      const data = await fetchMySubscription({ force: true });
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
  const accessScopeLabel = useMemo(() => getAccessScopeLabel(accessScope, courseIds, lessonIds), [accessScope, courseIds, lessonIds]);
  const bankTransferDetails = String(billing.payment?.bankTransferDetails || '').trim();
  const pendingManualRequest = useMemo(() => {
    return (Array.isArray(billing.requests) ? billing.requests : []).find((request) => (
      request?.status === 'pending'
      && Number(request?.planId) === Number(planId)
      && (request?.invoiceId || request?.paymentMethod === 'bank_transfer')
    )) || null;
  }, [billing.requests, planId]);
  const pendingProofUploaded = Boolean(pendingManualRequest?.paymentProofDataUrl);
  const pendingCartMessage = pendingManualRequest?.invoiceId && !pendingProofUploaded
    ? `This package is already in your payment cart. Invoice #${pendingManualRequest.invoiceId} is ready. Upload your bank slip to continue.`
    : '';

  useEffect(() => {
    if (!pendingManualRequest?.invoiceId || manualInvoice?.invoiceId) return;
    setManualInvoice({
      id: pendingManualRequest.id,
      invoiceId: pendingManualRequest.invoiceId,
      amount: pendingManualRequest.paymentAmount,
      currency: pendingManualRequest.paymentCurrency || pendingManualRequest.planCurrency,
      proofUploaded: Boolean(pendingManualRequest.paymentProofDataUrl),
    });
    setPaymentMode('manual');
  }, [manualInvoice?.invoiceId, pendingManualRequest]);

  useEffect(() => {
    if (!shouldCreateManualInvoice || loading || !plan || pendingProofUploaded || manualInvoice?.invoiceId || manualInvoiceLoading) return;
    const autoCreatePlanKey = String(plan.id);
    if (invoiceAutoCreatePlanRef.current === autoCreatePlanKey) return;
    invoiceAutoCreatePlanRef.current = autoCreatePlanKey;
    setPaymentMode('manual');
    createManualInvoice().then((invoice) => {
      if (!invoice?.invoiceId) {
        invoiceAutoCreatePlanRef.current = '';
      }
    });
  }, [loading, manualInvoice?.invoiceId, manualInvoiceLoading, pendingProofUploaded, plan, shouldCreateManualInvoice]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function goBackToPlans() {
    navigate('/subscriptions', {
      state: { fromCheckout: true },
    });
  }

  async function createManualInvoice() {
    if (!plan) return null;
    if (pendingManualRequest?.invoiceId) {
      const invoice = {
        id: pendingManualRequest.id,
        invoiceId: pendingManualRequest.invoiceId,
        amount: pendingManualRequest.paymentAmount,
        currency: pendingManualRequest.paymentCurrency || pendingManualRequest.planCurrency,
        proofUploaded: Boolean(pendingManualRequest.paymentProofDataUrl),
      };
      setManualInvoice(invoice);
      return invoice;
    }
    setManualInvoiceLoading(true);
    setError('');
    try {
      const invoice = await requestManualPayment({
        planId: plan.id,
        couponCode: couponCode.trim() || undefined,
        message: customSelectionNote || undefined,
        accessScope,
        courseIds: accessScope === 'courses' ? courseIds : [],
        lessonIds: accessScope === 'lessons' ? lessonIds : [],
      });
      setManualInvoice(invoice);
      return invoice;
    } catch (invoiceError) {
      setError(getErrorMessage(invoiceError, 'Unable to create bank transfer invoice'));
      return null;
    } finally {
      setManualInvoiceLoading(false);
    }
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
      const invoice = manualInvoice || await createManualInvoice();
      if (!invoice?.invoiceId) {
        throw new Error('Unable to create invoice before uploading proof');
      }
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
      setManualInvoice(result);
      const successMessage = result?.couponCode
        ? `Payment proof uploaded. Invoice #${result.invoiceId || 'created'} is waiting for admin approval. Coupon ${result.couponCode} applied; bank transfer amount is ${result.currency || plan.currency} ${result.amount}.`
        : `Payment proof uploaded. Invoice #${result?.invoiceId || 'created'} is waiting for admin approval.`;
      setSuccess(successMessage);
      setProofFile(null);
      setPaymentReference('');
      setCouponCode('');
      await load();
      navigate('/subscriptions', { state: { paymentNotice: successMessage } });
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
          title="Subscriptions"
          subtitle="Plan Access"
        />

        {error ? <FeedbackNotice tone="error">{error}</FeedbackNotice> : null}
        {paymentCartNotice || pendingCartMessage ? (
          <FeedbackNotice tone="warning">{paymentCartNotice || pendingCartMessage}</FeedbackNotice>
        ) : null}
        {pendingProofUploaded ? (
          <FeedbackNotice tone="success">Payment proof already uploaded. Waiting for admin approval.</FeedbackNotice>
        ) : null}
        {success ? (
          <div className="flex flex-col items-center gap-3 py-2">
            <SuccessBurst />
            <FeedbackNotice tone="success">{success}</FeedbackNotice>
          </div>
        ) : null}
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
              <div className="grid gap-3 border-t border-line-soft pt-4">
                <div>
                  <span className={ui.eyebrow}>Plan details</span>
                  <p className="m-0 mt-2 text-[13px] font-semibold leading-relaxed text-ink-soft">
                    {accessScopeLabel} for {plan.name}. Access begins after payment confirmation.
                  </p>
                </div>

                <dl className="m-0 grid divide-y divide-line-soft text-[13px] leading-relaxed text-ink-soft">
                  <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 py-2 max-[520px]:grid-cols-1 max-[520px]:gap-1">
                    <dt className="font-bold text-ink-muted">Access</dt>
                    <dd className="m-0 font-bold text-ink-strong">{getPlanDurationLabel(plan)}</dd>
                  </div>
                  <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 py-2 max-[520px]:grid-cols-1 max-[520px]:gap-1">
                    <dt className="font-bold text-ink-muted">Coverage</dt>
                    <dd className="m-0 font-bold text-ink-strong">{accessScopeLabel}</dd>
                  </div>
                  <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 py-2 max-[520px]:grid-cols-1 max-[520px]:gap-1">
                    <dt className="font-bold text-ink-muted">Activation</dt>
                    <dd className="m-0 font-bold text-ink-strong">After payment confirmation</dd>
                  </div>
                </dl>

                {customSelectionNote ? <FeedbackNotice tone="success">{customSelectionNote}</FeedbackNotice> : null}
              </div>
              {paymentMode === 'manual' ? (
                <div className="grid gap-2 rounded-xl border border-line-soft bg-surface-2 p-3.5">
                  <span className={ui.eyebrow}>Bank details</span>
                  <p className="m-0 whitespace-pre-line text-[13px] leading-relaxed text-ink-medium">
                    {bankTransferDetails || 'Bank transfer details are not configured yet. Add them in Admin Settings > Payment before students transfer payment.'}
                  </p>
                </div>
              ) : null}
              {pendingManualRequest?.invoiceId ? (
                <FeedbackNotice tone={pendingProofUploaded ? 'success' : 'warning'}>
                  {pendingProofUploaded
                    ? `Invoice #${pendingManualRequest.invoiceId} is waiting for admin approval.`
                    : `Invoice #${pendingManualRequest.invoiceId} is already created. Upload your bank slip to complete payment.`}
                </FeedbackNotice>
              ) : null}
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
                    disabled={pendingProofUploaded}
                    onClick={() => {
                      setPaymentMode('manual');
                      if (!manualInvoice && !manualInvoiceLoading) {
                        createManualInvoice();
                      }
                    }}
                  >
                    {pendingProofUploaded ? 'Waiting for approval' : pendingManualRequest?.invoiceId ? 'View invoice' : 'Bank transfer'}
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
                    {manualInvoiceLoading ? (
                      <FeedbackNotice tone="warning">Creating your invoice...</FeedbackNotice>
                    ) : manualInvoice?.invoiceId ? (
                      <div className="grid gap-1 rounded-xl border border-brand-primary/25 bg-brand-primary/8 p-3.5">
                        <span className={ui.eyebrow}>Invoice</span>
                        <strong className="text-lg text-ink-strong">#{manualInvoice.invoiceId}</strong>
                        <p className="m-0 text-[12.5px] leading-relaxed text-ink-soft">
                          Use this invoice number when uploading your bank slip.
                        </p>
                      </div>
                    ) : null}
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
                      <button className={ui.primaryAction} type="submit" disabled={pendingProofUploaded || manualSubmitting || submitting || manualInvoiceLoading}>
                        {pendingProofUploaded ? 'Waiting for approval' : manualSubmitting ? 'Uploading proof...' : 'Upload proof for admin approval'}
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
