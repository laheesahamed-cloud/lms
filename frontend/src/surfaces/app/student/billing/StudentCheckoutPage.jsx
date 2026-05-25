import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { fetchMySubscription, initiatePayHereCheckout, requestManualPayment } from '../../../../shared/api/subscriptions.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { AppHeader } from '../../../../shared/layout/AppHeader.jsx';
import { useAuthStore } from '../../../../shared/stores/authStore.js';
import { cx, ui } from '../../../../shared/styles/tailwindClasses.js';

function getPlanEndDate(plan) {
  const days = Number(plan?.durationDays || 0);
  if (!days) return '';
  const date = new Date();
  date.setDate(date.getDate() + Math.max(1, days) - 1);
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
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
  const courseIds = Array.isArray(location.state?.courseIds) ? location.state.courseIds.map(Number).filter(Boolean) : [];
  const lessonIds = Array.isArray(location.state?.lessonIds) ? location.state.lessonIds.map(Number).filter(Boolean) : [];
  const [billing, setBilling] = useState({ availablePlans: [], payment: null });
  const [loading, setLoading] = useState(true);
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
    setLoading(true);
    setError('');
    try {
      const data = await fetchMySubscription();
      setBilling({
        availablePlans: Array.isArray(data?.availablePlans) ? data.availablePlans : [],
        payment: data?.payment || null,
      });
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Unable to load checkout details'));
    } finally {
      setLoading(false);
    }
  }

  const plan = useMemo(() => {
    return billing.availablePlans.find((item) => String(item?.id) === String(planId)) || null;
  }, [billing.availablePlans, planId]);

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
    if (!proofFile) {
      setError('Please upload the bank slip or payment screenshot.');
      return;
    }
    if (!['image/png', 'image/jpeg', 'image/webp', 'application/pdf'].includes(proofFile.type)) {
      setError('Upload a PNG, JPG, WEBP, or PDF payment proof.');
      return;
    }
    if (proofFile.size > 4 * 1024 * 1024) {
      setError('Payment proof is too large. Please upload a file under 4MB.');
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

        {error ? <div className={ui.feedbackError}>{error}</div> : null}
        {success ? <div className={ui.feedbackSuccess}>{success}</div> : null}
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
              <div className={ui.tableSubtext}>Access ends on {getPlanEndDate(plan)}</div>
              {customSelectionNote ? <div className={ui.feedbackSuccess}>{customSelectionNote}</div> : null}
              <div className="flex flex-wrap gap-2">
                {(Array.isArray(plan.enabledFeatures) ? plan.enabledFeatures : []).slice(0, 10).map((feature) => (
                  <span className={ui.tablePill} key={feature.id}>{feature.featureName}</span>
                ))}
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
                    <div className={ui.warningFeedback}>
                      Your package will activate only after the admin verifies this payment proof.
                    </div>
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
                        onChange={(event) => setProofFile(event.target.files?.[0] || null)}
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
