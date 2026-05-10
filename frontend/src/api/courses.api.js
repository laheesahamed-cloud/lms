import { apiClient } from './client.js';

const STUDENT_COURSES_CACHE_MS = 60_000;
let studentCoursesCache = {
  data: null,
  timestamp: 0,
  promise: null,
};

export async function fetchCourses() {
  const response = await apiClient.get('/courses');
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

  studentCoursesCache.promise = apiClient.get('/courses/student')
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
  const response = await apiClient.get('/courses/student');
  return response.data;
}

export async function fetchStudentCourseDetail(courseId) {
  const response = await apiClient.get(`/courses/student/${courseId}`);
  return response.data;
}

export async function updateStudentLessonProgress(lessonId, payload) {
  const response = await apiClient.patch(`/courses/student/lessons/${lessonId}/progress`, payload);
  return response.data;
}

export async function createCourse(payload) {
  const response = await apiClient.post('/courses', payload);
  return response.data;
}

export async function updateCourse(id, payload) {
  const response = await apiClient.patch(`/courses/${id}`, payload);
  return response.data;
}

export async function deleteCourse(id) {
  const response = await apiClient.delete(`/courses/${id}`);
  return response.data;
}
