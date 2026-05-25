import { apiClient } from './client.js';

export async function fetchSubscriptionAdminMeta() {
  const response = await apiClient.get('/admin/subscriptions/meta');
  return response.data;
}

export async function fetchAdminSubscriptions() {
  const response = await apiClient.get('/admin/subscriptions');
  return response.data;
}

export async function fetchAdminSubscriptionRequests() {
  const response = await apiClient.get('/admin/subscriptions/requests');
  return response.data;
}

export async function fetchSubscriptionAudit() {
  const response = await apiClient.get('/admin/subscriptions/audit');
  return response.data;
}

export async function fetchSubscriptionCoupons() {
  const response = await apiClient.get('/admin/subscriptions/coupons');
  return response.data;
}

export async function fetchSubscriptionInvoice(invoiceId) {
  const response = await apiClient.get(`/admin/subscriptions/invoices/${encodeURIComponent(invoiceId)}`);
  return response.data;
}

export async function fetchSubscriptionPaymentProof(invoiceId) {
  const response = await apiClient.get(`/admin/subscriptions/payment-proofs/${encodeURIComponent(invoiceId)}`, {
    responseType: 'blob',
  });
  return response.data;
}

export async function createSubscriptionCoupon(payload) {
  const response = await apiClient.post('/admin/subscriptions/coupons', payload);
  return response.data;
}

export async function updateSubscriptionCoupon(id, payload) {
  const response = await apiClient.put(`/admin/subscriptions/coupons/${id}`, payload);
  return response.data;
}

export async function deleteSubscriptionCoupon(id) {
  const response = await apiClient.delete(`/admin/subscriptions/coupons/${id}`);
  return response.data;
}

export async function assignSubscription(payload) {
  const response = await apiClient.post('/admin/subscriptions/assign', payload);
  return response.data;
}

export async function requestSubscription(payload) {
  const response = await apiClient.post('/student/subscriptions/request', payload);
  return response.data;
}

export async function initiatePayHereCheckout(payload) {
  const response = await apiClient.post('/student/subscriptions/payhere/initiate', payload);
  return response.data;
}

export async function requestManualPayment(payload) {
  const response = await apiClient.post('/student/subscriptions/manual-payment/request', payload);
  return response.data;
}

export async function resolveSubscriptionRequest(id, payload) {
  const response = await apiClient.patch(`/admin/subscriptions/requests/${id}/resolve`, payload);
  return response.data;
}

export async function extendSubscription(id, payload) {
  const response = await apiClient.patch(`/admin/subscriptions/${id}/extend`, payload);
  return response.data;
}

export async function renewSubscription(id, payload) {
  const response = await apiClient.patch(`/admin/subscriptions/${id}/renew`, payload);
  return response.data;
}

export async function cancelSubscription(id, payload) {
  const response = await apiClient.patch(`/admin/subscriptions/${id}/cancel`, payload);
  return response.data;
}

export async function updateSubscriptionPayment(id, payload) {
  const response = await apiClient.patch(`/admin/subscriptions/${id}/payment`, payload);
  return response.data;
}

export async function fetchMySubscription() {
  const response = await apiClient.get('/student/subscriptions');
  return response.data;
}
