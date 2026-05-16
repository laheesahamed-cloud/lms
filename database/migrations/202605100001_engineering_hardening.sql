-- Versioned migration foundation for engineering hardening changes.
-- The runner records this file in schema_migrations after successful execution.

CREATE TABLE IF NOT EXISTS lesson_doubts (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  lesson_id INT NULL,
  subject VARCHAR(220) NOT NULL,
  message TEXT NOT NULL,
  reply TEXT NULL,
  status ENUM('open','answered','closed') NOT NULL DEFAULT 'open',
  answered_by INT NULL,
  answered_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_lesson_doubts_user (user_id),
  INDEX idx_lesson_doubts_lesson (lesson_id),
  INDEX idx_lesson_doubts_status (status)
);

SET @lesson_doubts_question_id_sql = IF(
  (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'lesson_doubts'
      AND column_name = 'question_id'
  ) = 0,
  'ALTER TABLE lesson_doubts ADD COLUMN question_id INT NULL AFTER lesson_id',
  'SELECT 1'
);
PREPARE lesson_doubts_question_id_stmt FROM @lesson_doubts_question_id_sql;
EXECUTE lesson_doubts_question_id_stmt;
DEALLOCATE PREPARE lesson_doubts_question_id_stmt;

SET @lesson_doubts_context_type_sql = IF(
  (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'lesson_doubts'
      AND column_name = 'context_type'
  ) = 0,
  'ALTER TABLE lesson_doubts ADD COLUMN context_type ENUM(''lesson'',''question'',''general'') NOT NULL DEFAULT ''general'' AFTER question_id',
  'SELECT 1'
);
PREPARE lesson_doubts_context_type_stmt FROM @lesson_doubts_context_type_sql;
EXECUTE lesson_doubts_context_type_stmt;
DEALLOCATE PREPARE lesson_doubts_context_type_stmt;

SET @lesson_doubts_faq_answer_sql = IF(
  (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'lesson_doubts'
      AND column_name = 'faq_answer'
  ) = 0,
  'ALTER TABLE lesson_doubts ADD COLUMN faq_answer TEXT NULL AFTER reply',
  'SELECT 1'
);
PREPARE lesson_doubts_faq_answer_stmt FROM @lesson_doubts_faq_answer_sql;
EXECUTE lesson_doubts_faq_answer_stmt;
DEALLOCATE PREPARE lesson_doubts_faq_answer_stmt;

SET @lesson_doubts_converted_to_faq_sql = IF(
  (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'lesson_doubts'
      AND column_name = 'converted_to_faq'
  ) = 0,
  'ALTER TABLE lesson_doubts ADD COLUMN converted_to_faq TINYINT(1) NOT NULL DEFAULT 0 AFTER faq_answer',
  'SELECT 1'
);
PREPARE lesson_doubts_converted_to_faq_stmt FROM @lesson_doubts_converted_to_faq_sql;
EXECUTE lesson_doubts_converted_to_faq_stmt;
DEALLOCATE PREPARE lesson_doubts_converted_to_faq_stmt;

SET @lesson_doubts_question_idx_sql = IF(
  (
    SELECT COUNT(*)
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'lesson_doubts'
      AND index_name = 'idx_lesson_doubts_question'
  ) = 0,
  'ALTER TABLE lesson_doubts ADD INDEX idx_lesson_doubts_question (question_id)',
  'SELECT 1'
);
PREPARE lesson_doubts_question_idx_stmt FROM @lesson_doubts_question_idx_sql;
EXECUTE lesson_doubts_question_idx_stmt;
DEALLOCATE PREPARE lesson_doubts_question_idx_stmt;
