# React + NestJS Migration Plan

## Target architecture

- `frontend/`: React app for auth, admin, and student flows
- `backend/`: NestJS API for auth, users, courses, topics, subtopics, lessons, questions, quizzes, attempts, and results
- Current PHP LMS stays live during migration

## Recommended module order

1. Auth
2. Users and roles
3. Courses
4. Topics
5. Subtopics
6. Questions
7. Quizzes
8. Quiz attempts
9. Results and review
10. Lessons
11. Admin and student dashboards

## Database shape

- `users`
- `courses`
- `topics`
- `subtopics`
- `lessons`
- `questions`
- `question_options`
- `quizzes`
- `quiz_questions`
- `quiz_attempts`
- `quiz_attempt_answers`
- `results`

## Migration strategy

1. Keep the current MySQL database first
2. Introduce NestJS APIs one module at a time
3. Rebuild screens in React against the new APIs
4. Swap old PHP pages only after the React screen is stable
5. Remove duplicated PHP logic at the end

## First delivery slice

- Backend:
  - `auth` API scaffolded
  - `courses` API scaffolded
- Frontend:
  - login page scaffolded
  - admin courses page scaffolded

## Notes for this repo

- Existing Vite assets at repo root remain untouched
- The new rebuild lives in `frontend/` and `backend/`
- This lets the old LMS keep working while the new stack is built safely

## Current implementation status

- `backend/src/modules/auth/*` now mirrors current PHP login/register rules
- `backend/src/modules/courses/*` now exposes CRUD endpoints for courses
- `frontend/src/surfaces/website/auth/LoginPage.jsx` calls the new auth API
- `frontend/src/surfaces/admin/pages/courses/CoursesPage.jsx` calls the new courses API

## Next recommended slice

1. Add backend `users`, `topics`, and `subtopics`
2. Add React register page
3. Replace the admin structure screen with a full React hierarchy manager
