import { apiClient } from './client.js';
import { createTimedApiCache } from './cache.js';

const STUDENT_COURSES_CACHE_MS = 60_000;
const STUDENT_COURSE_DETAIL_CACHE_MS = 60_000;
const studentCoursesCache = createTimedApiCache({
  ttlMs: STUDENT_COURSES_CACHE_MS,
  load: () => apiClient.get('/student/courses').then((response) => response.data),
});
const studentCourseDetailCache = createTimedApiCache({
  ttlMs: STUDENT_COURSE_DETAIL_CACHE_MS,
  key: (courseId) => String(courseId || ''),
  load: (courseId) => apiClient.get(`/student/courses/${courseId}`).then((response) => response.data),
});

export async function fetchCourses() {
  const response = await apiClient.get('/admin/courses');
  return response.data;
}

export async function fetchStudentCourses({ force = false } = {}) {
  if (force) studentCoursesCache.clear();
  return studentCoursesCache.get();
}

export function readStudentCoursesCache() {
  return studentCoursesCache.peek();
}

export function clearStudentCoursesCache() {
  studentCoursesCache.clear();
}

export function clearStudentCourseDetailCache(courseId) {
  if (courseId === undefined || courseId === null) {
    studentCourseDetailCache.clear();
    return;
  }

  studentCourseDetailCache.clear(String(courseId));
}

export async function fetchStudentCourseDetail(courseId, { force = false } = {}) {
  if (force) studentCourseDetailCache.clear(String(courseId || ''));
  return studentCourseDetailCache.get(courseId);
}

export function readStudentCourseDetailCache(courseId) {
  return studentCourseDetailCache.peek(courseId);
}

export async function updateStudentLessonProgress(lessonId, payload) {
  const response = await apiClient.patch(`/student/courses/lessons/${lessonId}/progress`, payload);
  clearStudentCoursesCache();
  clearStudentCourseDetailCache();
  return response.data;
}

export async function createCourse(payload) {
  const response = await apiClient.post('/admin/courses', payload);
  return response.data;
}

export async function updateCourse(id, payload) {
  const response = await apiClient.patch(`/admin/courses/${id}`, payload);
  return response.data;
}

export async function deleteCourse(id) {
  const response = await apiClient.delete(`/admin/courses/${id}`);
  return response.data;
}
