-- 2026-11-13 performance indexes. Safe to run more than once: each index is
-- created only if a same-named one is missing. Adds indexes only; no data or
-- column changes. Run in phpMyAdmin on the live database (SQL tab).

-- Admin dashboard "questions added per day" (was a full scan of questions).
SET @x := (SELECT COUNT(*) FROM information_schema.statistics
           WHERE table_schema = DATABASE() AND table_name = 'questions' AND index_name = 'idx_questions_created_at');
SET @s := IF(@x = 0, 'CREATE INDEX idx_questions_created_at ON questions (created_at)', 'SELECT ''idx_questions_created_at already exists''');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- Admin dashboard "lessons added per day" (was a full scan of lessons).
SET @x := (SELECT COUNT(*) FROM information_schema.statistics
           WHERE table_schema = DATABASE() AND table_name = 'lessons' AND index_name = 'idx_lessons_created_at');
SET @s := IF(@x = 0, 'CREATE INDEX idx_lessons_created_at ON lessons (created_at)', 'SELECT ''idx_lessons_created_at already exists''');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- Question of the day "exactly one correct option" check, answered from the index.
SET @x := (SELECT COUNT(*) FROM information_schema.statistics
           WHERE table_schema = DATABASE() AND table_name = 'question_options' AND index_name = 'idx_question_options_question_correct');
SET @s := IF(@x = 0, 'CREATE INDEX idx_question_options_question_correct ON question_options (question_id, is_correct)', 'SELECT ''idx_question_options_question_correct already exists''');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
