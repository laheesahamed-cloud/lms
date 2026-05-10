import { apiClient } from './client.js';

export async function fetchActivePlans() {
  const response = await apiClient.get('/plans');
  return response.data;
}

export async function fetchAdminPlans() {
  const response = await apiClient.get('/plans/admin');
  return response.data;
}

export async function fetchPlanFeatures() {
  const response = await apiClient.get('/plans/features');
  return response.data;
}

export async function createPlan(payload) {
  const response = await apiClient.post('/plans', payload);
  return response.data;
}

export async function updatePlan(id, payload) {
  const response = await apiClient.patch(`/plans/${id}`, payload);
  return response.data;
}

export async function createPlanFeature(payload) {
  const response = await apiClient.post('/plans/features', payload);
  return response.data;
}

export async function updatePlanFeature(id, payload) {
  const response = await apiClient.patch(`/plans/features/${id}`, payload);
  return response.data;
}

export async function deletePlan(id) {
  const response = await apiClient.delete(`/plans/${id}`);
  return response.data;
}
