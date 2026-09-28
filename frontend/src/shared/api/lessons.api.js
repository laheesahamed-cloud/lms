import { apiClient } from './client.js';

export async function createLesson(payload) {
  const response = await apiClient.post('/admin/lessons', payload);
  return response.data;
}

export async function updateLesson(id, payload) {
  const response = await apiClient.patch(`/admin/lessons/${id}`, payload);
  return response.data;
}

/**
 * Options shared by the file uploads.
 *
 * The client's default timeout is 30s, which is fine for JSON and hopeless for
 * a video — the upload aborted on the clock long before the file finished, and
 * the UI reported it as a size problem. `timeout: 0` lets the transfer take as
 * long as it takes.
 *
 * `__skipTimeoutRetry` matters just as much: timed-out writes are retried twice
 * by default, so a slow upload was re-sending the whole file three times over.
 */
function uploadOptions(onProgress) {
  return {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 0,
    __skipTimeoutRetry: true,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    onUploadProgress: (event) => {
      if (!onProgress) return;
      // `total` is absent on some browsers/proxies; report bytes sent instead of
      // a percentage that would otherwise read NaN.
      const total = event.total || 0;
      onProgress({
        loaded: event.loaded || 0,
        total,
        percent: total > 0
          ? Math.min(100, Math.round((event.loaded / total) * 100))
          : null,
      });
    },
  };
}

export async function uploadLessonPdf(id, file, onProgress) {
  const form = new FormData();
  form.append('file', file);
  const response = await apiClient.post(
    `/admin/lessons/${id}/pdf`, form, uploadOptions(onProgress));
  return response.data;
}

export async function removeLessonPdf(id) {
  const response = await apiClient.delete(`/admin/lessons/${id}/pdf`);
  return response.data;
}

export async function uploadLessonVideo(id, file, onProgress) {
  const form = new FormData();
  form.append('file', file);
  const response = await apiClient.post(
    `/admin/lessons/${id}/video`, form, uploadOptions(onProgress));
  return response.data;
}

export async function removeLessonVideo(id) {
  const response = await apiClient.delete(`/admin/lessons/${id}/video`);
  return response.data;
}
