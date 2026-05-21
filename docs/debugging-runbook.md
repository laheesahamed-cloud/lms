# LMS Debugging Runbook

Use this when something breaks. The goal is to narrow the problem to frontend, API, database, auth, or data.

## 1. Check The API First

Start or restart the API:

```bash
npm run start:api:bg
```

Check status:

```bash
npm run status:api
```

Check health:

```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/health/ready
curl http://localhost:3000/api/health/metrics
```

Expected:

- `/api/health` returns `ok: true`.
- `/api/health/ready` returns `database.ok: true`.
- `/api/health/metrics` returns counts for users, courses, lessons, questions, and quiz attempts.

If `/api/health` works but `/api/health/ready` fails, the API is running but database access is broken.

If `/api/` returns 404, that is normal. There is no plain API index route.

## 2. Check Frontend Build

```bash
npm run build:frontend
```

If this fails, the issue is usually a React import, syntax error, or missing asset.

The Apache-served app uses the built bundle from `frontend/dist/`. After changing frontend code, rebuild before testing through:

```text
http://localhost/lms/
```

## 3. Check Backend Build

```bash
npm run build:backend
```

If this fails, the issue is TypeScript or NestJS wiring. Fix this before debugging browser behavior.

## 4. Check The Full Smoke Pass

```bash
npm test
npm run build
```

`npm test` currently runs a static LMS smoke check. It confirms core files and module wiring exist. It is not a full end-to-end test suite yet.

## 5. Network Error In Login Or App

Most common causes:

| Symptom | Check |
| --- | --- |
| Login says network error | Run `curl http://localhost:3000/api/health` |
| API health 404 for a new route | Restart API with `npm run stop:api:bg && npm run start:api:bg` |
| API health works but data does not load | Check browser Network tab for failing route |
| CORS error | Check request origin and `backend/src/main.ts` allowed origins |
| Student/admin redirects wrong | Check `/api/auth/me` response and user role/status |

## 6. Auth And Permission Debugging

Auth lives in:

```text
backend/src/modules/auth/
frontend/src/shared/stores/authStore.js
frontend/src/shared/auth/
```

Useful checks:

```bash
curl http://localhost:3000/api/auth/me
```

Most authenticated API calls require the `lms_session` cookie or bearer token. In the browser, inspect:

- Application tab -> Cookies -> `lms_session`
- Network tab -> request headers/cookies
- `/api/auth/me` response

Admin/staff permission mapping lives in:

```text
backend/src/modules/auth/role-permissions.ts
```

If an admin route returns 403, check:

1. User role in `users.role`
2. Permission required by controller decorator
3. Permission list in `role-permissions.ts`

## 7. Results Debugging

Student results use:

```text
backend/src/modules/results/
backend/src/modules/quiz-attempts/
frontend/src/surfaces/app/student/results/
```

Important routes:

```text
GET /api/results
GET /api/results/:attemptId
GET /api/results/review/:attemptId
```

Legacy quiz-attempt routes still exist:

```text
GET /api/quiz-attempts/results
GET /api/quiz-attempts/result/:attemptId
GET /api/quiz-attempts/review/:attemptId
```

If results are empty, check:

```sql
SELECT * FROM quiz_attempts ORDER BY id DESC;
SELECT * FROM student_answers ORDER BY id DESC;
```

## 8. Content Audit And Version Debugging

Question create/update/delete now writes governance records.

Tables:

```sql
SELECT * FROM content_audit_events ORDER BY id DESC;
SELECT * FROM content_versions ORDER BY id DESC;
```

If records are missing:

1. Restart API so schema sync runs.
2. Create or edit a question from admin.
3. Check the tables again.

Current scope:

- Question create writes audit + version.
- Question update writes audit + version.
- Question delete writes audit.
- Bulk delete writes audit.
- Bulk keyword update writes audit.

## 9. Course/Lesson Debugging

Frontend:

```text
frontend/src/surfaces/app/student/courses/
frontend/src/surfaces/app/student/ai-notes/AiNotesPage.jsx
frontend/src/shared/styles/04-pages/courses.css
frontend/src/shared/styles/04-pages/lessons.css
```

Backend:

```text
backend/src/modules/courses/
backend/src/modules/lessons/
backend/src/modules/ai-notes/
```

Common checks:

```sql
SELECT id, course_title, status FROM courses;
SELECT id, course_id, topic_name, status FROM topics;
SELECT id, topic_id, subtopic_name, status FROM subtopics;
SELECT id, course_id, topic_id, subtopic_id, lesson_title, is_free, status FROM lessons;
SELECT * FROM student_lesson_progress ORDER BY updated_at DESC;
```

## 10. Quiz Debugging

Frontend:

```text
frontend/src/surfaces/app/student/quizzes/
frontend/src/surfaces/admin/pages/quizzes/
```

Backend:

```text
backend/src/modules/quizzes/
backend/src/modules/quiz-attempts/
backend/src/modules/questions/
```

Common checks:

```sql
SELECT id, quiz_title, status, is_free FROM quizzes ORDER BY id DESC;
SELECT * FROM question_quizzes WHERE quiz_id = ? ORDER BY sort_order;
SELECT * FROM quiz_attempts WHERE quiz_id = ? ORDER BY id DESC;
```

## 11. Subscription Debugging

Frontend:

```text
frontend/src/surfaces/app/student/billing/
frontend/src/surfaces/admin/pages/subscriptions/
```

Backend:

```text
backend/src/modules/plans/
backend/src/modules/subscriptions/
```

Common checks:

```sql
SELECT id, name, slug, status FROM plans;
SELECT * FROM user_subscriptions ORDER BY id DESC;
SELECT * FROM subscription_requests ORDER BY id DESC;
SELECT * FROM subscription_audit_events ORDER BY id DESC;
```

## 12. Mobile/Capacitor Debugging

Build and sync:

```bash
npm run mobile:cap:sync
```

Native output:

```text
frontend/dist-capacitor/
frontend/android/
frontend/ios/
```

If the mobile app shows an old UI, rebuild and sync again.

## 13. Logs

Background API log:

```text
.runtime/api.log
```

Commands:

```bash
tail -100 .runtime/api.log
npm run status:api
```

If a background API process is stale, restart it:

```bash
npm run stop:api:bg
npm run start:api:bg
```

