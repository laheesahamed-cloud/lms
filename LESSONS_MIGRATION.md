# Lessons Migration Plan
> Drop `ai_illustrated_notes`, consolidate everything into `lessons` table.
> Single source of truth. "Lessons" everywhere — DB, API, Flutter, admin web.

---

## Status Tracker
- [ ] Phase 1 — DB schema (add columns to lessons, migrate flashcards)
- [ ] Phase 2 — Backend: rewrite ai-notes service queries to use `lessons`
- [ ] Phase 3 — Backend: merge ai-notes module INTO lessons module
- [ ] Phase 4 — Backend: update lessons.controller with new/merged routes
- [ ] Phase 5 — Backend: update schema-sync (add columns, drop ai_illustrated_notes)
- [ ] Phase 6 — Backend: update dashboard + bookmarks services
- [ ] Phase 7 — Backend dist JS (mirror all TS changes)
- [ ] Phase 8 — Admin web: update API calls
- [ ] Phase 9 — Flutter: update API calls
- [ ] Phase 10 — Commit & push

---

## Phase 1 — DB Schema Changes

### Add to `lessons` table:
```sql
ALTER TABLE lessons
  ADD COLUMN note_data LONGTEXT NULL,
  ADD COLUMN raw_text LONGTEXT NULL,
  ADD COLUMN engine_key VARCHAR(32) NOT NULL DEFAULT 'gemini',
  ADD COLUMN is_public TINYINT NOT NULL DEFAULT 1;
```

### Migrate lesson_flashcards (note_id → lesson_id):
`lesson_flashcards` already has `lesson_id`. `note_id` points to `ai_illustrated_notes.id`.
Since each ai_illustrated_note has a `lesson_id`, we can fill gaps:
```sql
UPDATE lesson_flashcards lf
INNER JOIN ai_illustrated_notes n ON n.id = lf.note_id
SET lf.lesson_id = n.lesson_id
WHERE lf.lesson_id IS NULL AND n.lesson_id IS NOT NULL;
```
After migration, `note_id` column stays temporarily until ai_illustrated_notes is dropped.

### Copy note content into lessons:
```sql
UPDATE lessons l
INNER JOIN ai_illustrated_notes n ON n.lesson_id = l.id
SET
  l.note_data = n.note_data,
  l.raw_text = n.raw_text,
  l.engine_key = n.engine_key,
  l.is_public = n.is_public
WHERE n.is_public = 1;
```

### Drop ai_illustrated_notes (LAST — after all code deployed):
```sql
DROP TABLE IF EXISTS ai_illustrated_notes;
ALTER TABLE lesson_flashcards DROP COLUMN note_id;
```

---

## Phase 2 — API Route Mapping (ai-notes → lessons)

| Old route | New route | Notes |
|---|---|---|
| POST /ai-notes/generate | POST /lessons/generate | AI canvas generation |
| GET /ai-notes/admin | merged into GET /lessons/admin | add note_data cols |
| POST /ai-notes/admin | merged into POST /lessons | add note fields |
| GET /ai-notes/admin/:id | GET /lessons/admin/:id | merged |
| PATCH /ai-notes/admin/:id | PATCH /lessons/:id | merged |
| DELETE /ai-notes/admin/:id | DELETE /lessons/:id | merged |
| GET /ai-notes/admin/:id/flashcards | GET /lessons/:id/flashcards | |
| POST /ai-notes/admin/:id/flashcards | POST /lessons/:id/flashcards | |
| POST /ai-notes/admin/:id/flashcards/generate | POST /lessons/:id/flashcards/generate | |
| PATCH /ai-notes/admin/:id/flashcards/:cid | PATCH /lessons/:id/flashcards/:cid | |
| DELETE /ai-notes/admin/:id/flashcards/:cid | DELETE /lessons/:id/flashcards/:cid | |
| GET /ai-notes/admin/hierarchy/courses | GET /lessons/hierarchy/courses | |
| GET /ai-notes/admin/hierarchy/topics | GET /lessons/hierarchy/topics | |
| GET /ai-notes/admin/hierarchy/subtopics | GET /lessons/hierarchy/subtopics | |
| GET /ai-notes (student list) | GET /lessons/student/notes | |
| GET /ai-notes/student/lesson/:lessonId | GET /lessons/:id/note | lessonId=id now |
| GET /ai-notes/:id (student by noteId) | GET /lessons/:id/note | same |
| GET /ai-notes/:id/flashcards | GET /lessons/:id/flashcards | student auth |

---

## Phase 3 — Key Query Changes

### All queries: `ai_illustrated_notes n` → `lessons l`

#### adminList:
```sql
SELECT l.id, l.lesson_title AS title, NULL AS raw_text, NULL AS note_data,
       l.engine_key, l.course_id, l.topic_id, l.subtopic_id, l.video_url,
       l.is_free, l.status, l.pdf_url, l.created_at, l.updated_at,
       c.course_title, t.topic_name, s.subtopic_name
FROM lessons l
LEFT JOIN courses c ON c.id = l.course_id
LEFT JOIN topics t ON t.id = l.topic_id
LEFT JOIN subtopics s ON s.id = l.subtopic_id
WHERE l.is_public = 1 AND l.engine_key = ?
ORDER BY l.updated_at DESC
```

#### studentFindByLesson (simplified — lessonId IS the lesson):
```sql
SELECT l.id, l.lesson_title AS title, l.note_data, l.engine_key,
       l.course_id, l.topic_id, l.subtopic_id, l.video_url, l.pdf_url,
       l.is_free, l.status, l.created_at, l.updated_at,
       slp.status AS lesson_progress_status, ...
FROM lessons l
LEFT JOIN student_lesson_progress slp ON slp.lesson_id = l.id AND slp.user_id = ?
LEFT JOIN courses c ON c.id = l.course_id
...
WHERE l.id = ? AND l.is_public = 1 AND l.status = 'active' AND l.note_data IS NOT NULL
```

#### lesson_flashcards: all `note_id = ?` → `lesson_id = ?`

---

## Phase 4 — Files to Change

### Backend TS:
- `backend/src/modules/ai-notes/ai-notes.service.ts` → rewrite queries → move into lessons.service.ts
- `backend/src/modules/ai-notes/ai-notes.controller.ts` → routes merged into lessons.controller.ts
- `backend/src/modules/lessons/lessons.service.ts` → absorbs all ai-notes methods
- `backend/src/modules/lessons/lessons.controller.ts` → absorbs all ai-notes routes
- `backend/src/modules/ai-notes/ai-notes.module.ts` → DELETE file
- `backend/src/modules/lessons/lessons.module.ts` → remove AiNotesService dep
- `backend/src/app.module.ts` → remove AiNotesModule import
- `backend/src/modules/dashboard/dashboard.service.ts` → fix JOIN query
- `backend/src/modules/study-bookmarks/study-bookmarks.service.ts` → fix 2 queries
- `backend/src/modules/schema/schema-sync.service.ts` → add columns, remove ai_illustrated_notes table creation

### Backend dist JS (mirror every TS change):
- `backend/dist/modules/lessons/lessons.controller.js`
- `backend/dist/modules/lessons/lessons.service.js`
- `backend/dist/modules/ai-notes/` → DELETE files (or empty out)
- `backend/dist/app.module.js`
- `backend/dist/modules/dashboard/dashboard.service.js`
- `backend/dist/modules/study-bookmarks/study-bookmarks.service.js`
- `backend/dist/modules/schema/schema-sync.service.js`

### Admin web:
- `frontend/src/shared/api/lessons.api.js` → update all /api/ai-notes/ calls to /api/lessons/
- `frontend/src/surfaces/admin/pages/ai-notes/AdminAiNotesEditorPage.jsx` → update API calls
- `frontend/src/surfaces/admin/pages/ai-notes/AdminAiNotesListPage.jsx` → update API calls
- `frontend/src/app/router.jsx` → keep same routes (just api underneath changes)

### Flutter:
- `mobile/lib/features/ai_notes/note_canvas_page.dart` → API call update
- Wherever `lessonNoteProvider` hits `/api/ai-notes/student/lesson/:id` → `/api/lessons/:id/note`
- Flashcard endpoint if used directly

---

## Phase 5 — After Deploy

Run on live DB:
```sql
-- 1. Add columns
ALTER TABLE lessons ADD COLUMN note_data LONGTEXT NULL, ADD COLUMN raw_text LONGTEXT NULL, ADD COLUMN engine_key VARCHAR(32) NOT NULL DEFAULT 'gemini', ADD COLUMN is_public TINYINT NOT NULL DEFAULT 1;

-- 2. Copy content from ai_illustrated_notes → lessons
UPDATE lessons l INNER JOIN ai_illustrated_notes n ON n.lesson_id = l.id SET l.note_data = n.note_data, l.raw_text = n.raw_text, l.engine_key = n.engine_key, l.is_public = n.is_public WHERE n.is_public = 1;

-- 3. Fix flashcard lesson_ids
UPDATE lesson_flashcards lf INNER JOIN ai_illustrated_notes n ON n.id = lf.note_id SET lf.lesson_id = n.lesson_id WHERE lf.lesson_id IS NULL AND n.lesson_id IS NOT NULL;

-- 4. Drop old table + column (AFTER confirming everything works)
DROP TABLE IF EXISTS ai_illustrated_notes;
ALTER TABLE lesson_flashcards DROP COLUMN note_id;
```
