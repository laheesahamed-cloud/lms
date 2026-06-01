import { apiClient } from './client.js';

export async function fetchSubscriptionAdminMeta() {
  const response = await apiClient.get('/subscriptions/admin/meta');
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

export async function fetchSubscriptionAudit() {
  const response = await apiClient.get('/subscriptions/admin/audit');
  return response.data;
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
  return response.data;
}

export async function initiatePayHereCheckout(payload) {
  const response = await apiClient.post('/subscriptions/payhere/initiate', payload);
  return response.data;
}

export async function requestManualPayment(payload) {
  const response = await apiClient.post('/subscriptions/manual-payment/request', payload);
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

export async function fetchMySubscription() {
  const response = await apiClient.get('/subscriptions/me');
  return response.data;
}
