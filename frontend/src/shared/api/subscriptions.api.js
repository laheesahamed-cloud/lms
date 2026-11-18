import { apiClient } from './client.js';
import { createTimedApiCache } from './cache.js';

const mySubscriptionCache = createTimedApiCache({
  ttlMs: 3600000,
  persistKey: 'student.subscription',
  load: () => apiClient.get('/subscriptions/me').then((response) => response.data),
});

function clearMySubscriptionCache() {
  mySubscriptionCache.clear();
}

export async function fetchSubscriptionAdminMeta() {
  const response = await apiClient.get('/subscriptions/admin/meta');
  return response.data;
}

/// Apple in-app purchases for the admin panel (read-only).
///
/// A row whose `planName` is null is a product no plan carries, which is
/// exactly why redeeming it fails — the symptom that hid the unmapped yearly
/// product.
export async function fetchAppleTransactions(params) {
  const requestParams = { ...(params || {}) };
  if (!requestParams.limit) requestParams.limit = 100;
  const response = await apiClient.get('/subscriptions/apple/transactions', { params: requestParams });
  return response.data;
}

export async function fetchAdminSubscriptions(params) {
  const requestParams = { ...(params || {}) };
  if (!requestParams.limit) requestParams.limit = 100;
  const response = await apiClient.get('/subscriptions/admin', { params: requestParams });
  return response.data;
}

export async function fetchAdminSubscriptionRequests() {
  const response = await apiClient.get('/subscriptions/admin/requests');
  return response.data;
}

export async function fetchSubscriptionAudit(limit) {
  const response = await apiClient.get('/subscriptions/admin/audit', { params: limit ? { limit } : {} });
  return response.data;
}

// Subscriptions page header: counts + course list, one small request.
export async function fetchSubscriptionsOverview() {
  const response = await apiClient.get('/subscriptions/admin/overview');
  return response.data;
}

// Every subscription except the free plan, without plan features per row.
export async function fetchAdminPaidSubscriptions() {
  const response = await apiClient.get('/subscriptions/admin/paid');
  return response.data;
}

// Finance "Gateway totals" (online payment transactions per status).
export async function fetchPaymentTotals() {
  const response = await apiClient.get('/subscriptions/admin/payment-totals');
  return Array.isArray(response.data) ? response.data : [];
}

// Assign form: students by name or e-mail (up to 20).
export async function searchSubscriptionStudents(q, { signal } = {}) {
  const response = await apiClient.get('/subscriptions/admin/students', { params: { q }, signal });
  return Array.isArray(response.data) ? response.data : [];
}

// Lesson titles: by id (a subscription's details) or all (lesson scope in the assign form).
export async function fetchSubscriptionLessonTitles(ids) {
  const response = await apiClient.get('/subscriptions/admin/lessons', { params: ids ? { ids: ids.join(',') } : {} });
  return Array.isArray(response.data) ? response.data : [];
}

export async function fetchSubscriptionCoupons() {
  const response = await apiClient.get('/subscriptions/admin/coupons');
  return response.data;
}

export async function fetchSubscriptionInvoice(invoiceId) {
  const response = await apiClient.get(`/subscriptions/admin/invoices/${encodeURIComponent(invoiceId)}`);
  return response.data;
}

export async function fetchSubscriptionPaymentProof(invoiceId) {
  const response = await apiClient.get(`/subscriptions/admin/payment-proofs/${encodeURIComponent(invoiceId)}`, {
    responseType: 'blob',
  });
  return response.data;
}

export async function createSubscriptionCoupon(payload) {
  const response = await apiClient.post('/subscriptions/admin/coupons', payload);
  return response.data;
}

export async function updateSubscriptionCoupon(id, payload) {
  const response = await apiClient.put(`/subscriptions/admin/coupons/${id}`, payload);
  return response.data;
}

export async function deleteSubscriptionCoupon(id) {
  const response = await apiClient.delete(`/subscriptions/admin/coupons/${id}`);
  return response.data;
}

export async function assignSubscription(payload) {
  const response = await apiClient.post('/subscriptions/assign', payload);
  return response.data;
}

export async function requestSubscription(payload) {
  const response = await apiClient.post('/subscriptions/request', payload);
  clearMySubscriptionCache();
  return response.data;
}

export async function previewSubscriptionCoupon(payload) {
  const response = await apiClient.post('/subscriptions/checkout/coupon-preview', payload);
  return response.data;
}

export async function requestCouponApproval(payload) {
  const response = await apiClient.post('/subscriptions/coupon-approval/request', payload);
  clearMySubscriptionCache();
  return response.data;
}

export async function initiatePayHereCheckout(payload) {
  const response = await apiClient.post('/subscriptions/payhere/initiate', payload);
  clearMySubscriptionCache();
  return response.data;
}

export async function requestManualPayment(payload) {
  const response = await apiClient.post('/subscriptions/manual-payment/request', payload);
  clearMySubscriptionCache();
  return response.data;
}

export async function cancelPendingSubscriptionInvoice(id) {
  const response = await apiClient.delete(`/subscriptions/requests/${id}`);
  clearMySubscriptionCache();
  return response.data;
}

export async function resolveSubscriptionRequest(id, payload) {
  const response = await apiClient.patch(`/subscriptions/requests/${id}/resolve`, payload);
  return response.data;
}

export async function extendSubscription(id, payload) {
  const response = await apiClient.patch(`/subscriptions/${id}/extend`, payload);
  return response.data;
}

export async function renewSubscription(id, payload) {
  const response = await apiClient.patch(`/subscriptions/${id}/renew`, payload);
  return response.data;
}

export async function cancelSubscription(id, payload) {
  const response = await apiClient.patch(`/subscriptions/${id}/cancel`, payload);
  return response.data;
}

export async function updateSubscriptionPayment(id, payload) {
  const response = await apiClient.patch(`/subscriptions/${id}/payment`, payload);
  return response.data;
}

export async function fetchMySubscription({ force = false } = {}) {
  if (force) clearMySubscriptionCache();
  return mySubscriptionCache.get();
}

export function readMySubscriptionCache() {
  return mySubscriptionCache.peek();
}
