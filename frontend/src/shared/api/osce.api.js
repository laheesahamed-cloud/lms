import { apiClient } from './client.js';

// ── Systems ──
export const adminListOsceSystems = () =>
  apiClient.get('/admin/osce/systems').then((r) => r.data);

// ── Categories (OSCE's own, not lesson subjects) ──
export const adminCreateOsceCategory = (data) =>
  apiClient.post('/admin/osce/categories', data).then((r) => r.data);

export const adminUpdateOsceCategory = (id, data) =>
  apiClient.put(`/admin/osce/categories/${id}`, data).then((r) => r.data);

export const adminDeleteOsceCategory = (id) =>
  apiClient.delete(`/admin/osce/categories/${id}`).then((r) => r.data);

export const adminReorderOsceCategories = (ids) =>
  apiClient.put('/admin/osce/categories-order', { ids }).then((r) => r.data);

export const adminReorderOsceCases = (ids) =>
  apiClient.put('/admin/osce/cases-order', { ids }).then((r) => r.data);

// ── Shared long-case art ──
export const adminOsceGlobalMedia = () =>
  apiClient.get('/admin/osce/global-media').then((r) => r.data);

export const adminUploadOsceGlobal = (slot, file) => {
  const form = new FormData();
  form.append('file', file);
  return apiClient.post(`/admin/osce/global-media/${slot}`, form, {
    headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000,
  }).then((r) => r.data);
};

export const adminGenerateOsceGlobal = (slot) =>
  apiClient.post(`/admin/osce/global-media/${slot}/generate`, {}, { timeout: 180000 })
    .then((r) => r.data);

// ── Cases ──
export const adminListOsceCases = (systemKey) =>
  apiClient.get('/admin/osce/cases', { params: systemKey ? { system: systemKey } : {} })
    .then((r) => r.data);

export const adminGetOsceCase = (id) =>
  apiClient.get(`/admin/osce/cases/${id}`).then((r) => r.data);

export const adminCreateOsceCase = (data) =>
  apiClient.post('/admin/osce/cases', data).then((r) => r.data);

/** AI writes the case text and declares its image slots. ~15–30s. */
export const adminGenerateOsceCase = (data) =>
  apiClient.post('/admin/osce/cases/generate', data, { timeout: 180000 }).then((r) => r.data);

export const adminUpdateOsceCase = (id, data) =>
  apiClient.put(`/admin/osce/cases/${id}`, data).then((r) => r.data);

export const adminDeleteOsceCase = (id) =>
  apiClient.delete(`/admin/osce/cases/${id}`).then((r) => r.data);

/** The case as the app would receive it, published or not. */
/** Existing ECG cards and auscultation clips that can be attached to a case. */
export const adminOsceLinkable = (q) =>
  apiClient.get('/admin/osce/linkable', { params: q ? { q } : {} }).then((r) => r.data);

export const adminOscePreview = (id) =>
  apiClient.get(`/admin/osce/cases/${id}/preview`).then((r) => r.data);

export const adminOsceShotList = (id) =>
  apiClient.get(`/admin/osce/cases/${id}/shot-list`).then((r) => r.data);

export const adminPublishOsceCase = (id) =>
  apiClient.post(`/admin/osce/cases/${id}/publish`).then((r) => r.data);

export const adminUnpublishOsceCase = (id) =>
  apiClient.post(`/admin/osce/cases/${id}/unpublish`).then((r) => r.data);

// ── Media ──

/**
 * Upload one slot. The caller optimises to WebP first (see optimizeImageFile) —
 * the backend has no image library, so the browser is where resizing happens.
 */
export const adminUploadOsceSlot = (caseId, slot, { file, width, height, thumb, source }) => {
  const form = new FormData();
  form.append('file', file);
  if (width) form.append('width', String(width));
  if (height) form.append('height', String(height));
  if (thumb) form.append('thumb', thumb);
  if (source) form.append('source', String(source));
  return apiClient
    .post(`/admin/osce/cases/${caseId}/media/${encodeURIComponent(slot)}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    })
    .then((r) => r.data);
};

/** Image-capable models this API key can reach. */
export const adminOsceImageModels = () =>
  apiClient.get('/admin/osce/image-models', { timeout: 40000 }).then((r) => r.data);

export const adminOsceSettings = () =>
  apiClient.get('/admin/osce/settings').then((r) => r.data);

export const adminSaveOsceSettings = (data) =>
  apiClient.put('/admin/osce/settings', data).then((r) => r.data);

/** Fill a slot with an AI placeholder. Slow — image models take 10–40s. */
export const adminGenerateOsceSlot = (caseId, slot, prompt) =>
  apiClient
    .post(`/admin/osce/cases/${caseId}/media/${encodeURIComponent(slot)}/generate`,
      prompt ? { prompt } : {}, { timeout: 180000 })
    .then((r) => r.data);

export const adminOsceSlotPrompt = (caseId, slot) =>
  apiClient.get(`/admin/osce/cases/${caseId}/media/${encodeURIComponent(slot)}/prompt`)
    .then((r) => r.data);

export const adminClearOsceSlot = (caseId, slot) =>
  apiClient.delete(`/admin/osce/cases/${caseId}/media/${encodeURIComponent(slot)}`)
    .then((r) => r.data);

// ── Inbox (files bulk-dropped into uploads/osce/_inbox) ──
export const adminOsceInbox = () =>
  apiClient.get('/admin/osce/inbox').then((r) => r.data);

export const adminOsceInboxFile = (fileName) =>
  apiClient.get(`/admin/osce/inbox/${encodeURIComponent(fileName)}`).then((r) => r.data);

export const adminOsceArchiveInboxFile = (fileName) =>
  apiClient.post(`/admin/osce/inbox/${encodeURIComponent(fileName)}/archive`).then((r) => r.data);
