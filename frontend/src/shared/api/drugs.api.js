import { apiClient } from './client.js';

export const batchFetchDrugs = (count = 10) =>
  apiClient.get('/student/drugs/batch', { params: { count } }).then((r) => r.data);

export const recordDrugSpin = () =>
  apiClient.post('/student/drugs/record').then((r) => r.data).catch(() => null);

// Admin
export const adminListDrugs = (page = 1, limit = 30, search = '') =>
  apiClient.get('/admin/drugs', { params: { page, limit, search } }).then((r) => r.data);

export const adminGetDrug = (id) =>
  apiClient.get(`/admin/drugs/${id}`).then((r) => r.data);

export const adminCreateDrug = (data) =>
  apiClient.post('/admin/drugs', data).then((r) => r.data);

export const adminUpdateDrug = (id, data) =>
  apiClient.put(`/admin/drugs/${id}`, data).then((r) => r.data);

export const adminDeleteDrug = (id) =>
  apiClient.delete(`/admin/drugs/${id}`).then((r) => r.data);

export const adminToggleDrug = (id) =>
  apiClient.patch(`/admin/drugs/${id}/toggle`).then((r) => r.data);

export const adminGetDrugSettings = () =>
  apiClient.get('/admin/drugs/settings').then((r) => r.data);

export const adminUpdateDrugSettings = (data) =>
  apiClient.put('/admin/drugs/settings', data).then((r) => r.data);

export const adminAiLookupDrug = (name) =>
  apiClient.post('/admin/drugs/ai-lookup', { name }).then((r) => r.data);

export const adminImportDrugs = (file) => {
  const fd = new FormData();
  fd.append('file', file);
  return apiClient.post('/admin/drugs/import', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r) => r.data);
};
