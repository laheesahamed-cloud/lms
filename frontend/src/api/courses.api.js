import { apiClient } from './client.js';

const STUDENT_COURSES_CACHE_MS = 60_000;
let studentCoursesCache = {
  data: null,
  timestamp: 0,
  promise: null,
};

export async function fetchCourses() {
  const response = await apiClient.get('/admin/courses');
  return response.data;
}

export async function fetchStudentCourses({ force = false } = {}) {
  const now = Date.now();
  if (!force && studentCoursesCache.data && now - studentCoursesCache.timestamp < STUDENT_COURSES_CACHE_MS) {
    return studentCoursesCache.data;
  }
  if (!force && studentCoursesCache.promise) {
    return studentCoursesCache.promise;
  }

  studentCoursesCache.promise = apiClient.get('/student/courses')
    .then((response) => {
      studentCoursesCache = {
        data: response.data,
        timestamp: Date.now(),
        promise: null,
      };
      return response.data;
    })
    .catch((error) => {
      studentCoursesCache.promise = null;
      throw error;
    });

  return studentCoursesCache.promise;
}

export function clearStudentCoursesCache() {
  studentCoursesCache = {
    data: null,
    timestamp: 0,
    promise: null,
  };
}

export async function fetchStudentCoursesUncached() {
  const response = await apiClient.get('/student/courses');
  return response.data;
}

export async function fetchStudentCourseDetail(courseId) {
  const response = await apiClient.get(`/student/courses/${courseId}`);
  return response.data;
}

export async function updateStudentLessonProgress(lessonId, payload) {
  const response = await apiClient.patch(`/student/courses/lessons/${lessonId}/progress`, payload);
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
