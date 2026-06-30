-- Auscultation (Heart & Lung Sounds) feature.
-- Run once on production (schema-sync is off in prod).
-- Audio clips are stored as files in backend/uploads/sound-clips/;
-- these tables hold only the filename + metadata.
-- =============================================================

CREATE TABLE IF NOT EXISTS auscultation_topics (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category    ENUM('heart','lung') NOT NULL DEFAULT 'heart',
  title       VARCHAR(255) NOT NULL,
  description TEXT         NULL,
  position    INT          NOT NULL DEFAULT 0,
  is_active   TINYINT(1)   NOT NULL DEFAULT 1,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_ausc_topics_cat (category),
  INDEX idx_ausc_topics_active (is_active),
  INDEX idx_ausc_topics_position (position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auscultation_cards (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  topic_id    INT UNSIGNED NOT NULL,
  title       VARCHAR(255) NOT NULL,
  audio_file  VARCHAR(255) NULL,   -- filename in uploads/sound-clips/
  audio_mime  VARCHAR(80)  NULL,
  explanation TEXT         NULL,
  position    INT          NOT NULL DEFAULT 0,
  is_active   TINYINT(1)   NOT NULL DEFAULT 1,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_ausc_cards_topic (topic_id),
  INDEX idx_ausc_cards_active (is_active),
  INDEX idx_ausc_cards_position (position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auscultation_quiz_questions (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category      ENUM('heart','lung') NOT NULL DEFAULT 'heart',
  question_text VARCHAR(500) NOT NULL DEFAULT 'What is this sound?',
  audio_file    VARCHAR(255) NULL,
  audio_mime    VARCHAR(80)  NULL,
  source_card_id INT UNSIGNED NULL,  -- reuse an existing auscultation_cards clip
  options_json  JSON         NULL,   -- [{ "text": "...", "correct": true|false }]
  explanation   TEXT         NULL,
  position      INT          NOT NULL DEFAULT 0,
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_ausc_quiz_cat (category),
  INDEX idx_ausc_quiz_active (is_active),
  INDEX idx_ausc_quiz_position (position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
