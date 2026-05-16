import { apiClient } from './client.js';

export async function fetchActivePlans() {
  const response = await apiClient.get('/plans');
  return response.data;
}

export async function fetchAdminPlans() {
  const response = await apiClient.get('/admin/plans');
  return response.data;
}

export async function fetchPlanFeatures() {
  const response = await apiClient.get('/admin/plans/features');
  return response.data;
}

export async function createPlan(payload) {
  const response = await apiClient.post('/admin/plans', payload);
  return response.data;
}

export async function updatePlan(id, payload) {
  const response = await apiClient.patch(`/admin/plans/${id}`, payload);
  return response.data;
}

export async function createPlanFeature(payload) {
  const response = await apiClient.post('/admin/plans/features', payload);
  return response.data;
}

export async function updatePlanFeature(id, payload) {
  const response = await apiClient.patch(`/admin/plans/features/${id}`, payload);
  return response.data;
}

export async function deletePlan(id) {
  const response = await apiClient.delete(`/admin/plans/${id}`);
  return response.data;
}
