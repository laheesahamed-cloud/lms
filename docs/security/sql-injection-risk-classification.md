# SQL injection risk classification

Date: 2026-05-23

This file classifies the risky raw SQL patterns found during the A03 verification pass. The backend uses `mysql2` directly, so raw SQL is expected. The important question is whether user-controlled values are interpolated into SQL text.

## High-risk pattern review

| Pattern/result | Location | Classification | Evidence |
| --- | --- | --- | --- |
| SQL identifier helper | `backend/src/database/sql-safety.ts:5` | Safe | `sqlIdentifier` only permits identifier characters and optional allow-list membership. |
| SQL fragment helper | `backend/src/database/sql-safety.ts:21` | Safe | `allowedSqlFragment` only returns exact allow-listed SQL fragments. |
| Placeholder helper | `backend/src/database/sql-safety.ts:30` | Safe | `sqlPlaceholders` emits only `?` tokens. Values are passed separately. |
| Question search `LIKE` | `backend/src/modules/questions/questions.service.ts:141` | Safe | SQL text appends `LIKE ?`; payload is pushed into params at lines 143-144. |
| Question dynamic filters | `backend/src/modules/questions/questions.service.ts:147-184` | Safe | Status/type/category/id filters use allow-listed values and placeholders. |
| Question static ordering | `backend/src/modules/questions/questions.service.ts:191` | Safe | `ORDER BY q.id DESC` is static. |
| Question bulk `IN` | `backend/src/modules/questions/questions.service.ts:665-699` | Safe | `sqlPlaceholders(questionIds)` creates placeholder list; values passed as params. |
| Question lookup table | `backend/src/modules/questions/questions.service.ts:876-879` | Safe | Table name goes through `sqlIdentifier` with `QUESTION_LOOKUP_TABLES` allow-list. |
| Question export search/filters/order | `backend/src/modules/questions/questions.service.ts:1002-1054` | Safe | Search/id filters are placeholders; ordering is static. |
| Quiz admin search | `backend/src/modules/quizzes/quizzes.service.ts:116` | Safe | Search uses `LIKE ?`; no user SQL fragment. |
| Quiz card ownership/query | `backend/src/modules/quizzes/quizzes.service.ts:672-711` | Safe | Quiz id and IN values are parameterized; order is static. |
| Quiz attempt result/review | `backend/src/modules/quiz-attempts/quiz-attempts.service.ts:461-510` | Safe | Attempt id and user id are placeholders. |
| Lesson annotations | `backend/src/modules/lessons/lessons.service.ts:224-303` | Safe | Lesson id, annotation id, and user id are placeholders. |
| Smart note dynamic update | `backend/src/modules/smart-notes/smart-notes.service.ts:105-117` | Safe | `fields` is built only from server-defined DTO property branches; values and ownership ids are placeholders. |
| AI illustrated note dynamic update | `backend/src/modules/ai-notes/ai-notes.service.ts:235` | Safe with note | `fields` is server-defined in code branches; values are parameterized. Keep DTO-to-field mapping internal. |
| User dynamic update | `backend/src/modules/users/users.service.ts:255` | Safe with note | `updates` is server-defined in code branches; values are parameterized. |
| Push audience dynamic `WHERE` | `backend/src/modules/push-notifications/push-notifications.service.ts:266-277` | Safe | `IN` values use `sqlPlaceholders`; role is parameterized; joined predicates are internal strings. |
| Admin report dynamic filters | `backend/src/modules/workspace/workspace.service.ts:754-786` | Safe | Dynamic columns are passed through `allowedSqlFragment` before insertion; values are placeholders. |
| Schema dynamic DDL | `backend/src/modules/schema/schema-sync.service.ts:1077-1152` | Safe for runtime A03 | Startup/internal table/column/index names go through `sqlIdentifier`; not request-controlled. |
| `db.query('SELECT 1')` | `backend/src/health.controller.ts:26` | Safe | Static readiness query. |

## Remaining A03 risk

- No unsafe user-controlled SQL interpolation was confirmed in the reviewed dynamic query surfaces.
- Residual risk is coverage breadth: direct `mysql2` use means future code can reintroduce unsafe string interpolation unless regression/static checks continue to run.
- Dynamic `SET ${fields.join(', ')}` patterns are safe only while field arrays remain server-defined, not derived from request keys.
