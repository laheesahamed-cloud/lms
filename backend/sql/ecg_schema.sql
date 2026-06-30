-- ECG Library feature — tables auto-create via schema-sync on boot.
-- This file is for reference / manual provisioning only.
-- =============================================================

CREATE TABLE IF NOT EXISTS ecg_topics (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title       VARCHAR(255) NOT NULL,
  description TEXT         NULL,
  position    INT          NOT NULL DEFAULT 0,
  is_active   TINYINT(1)   NOT NULL DEFAULT 1,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_ecg_topics_active (is_active),
  INDEX idx_ecg_topics_position (position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ecg_cards (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  topic_id    INT UNSIGNED NOT NULL,
  title       VARCHAR(255) NOT NULL,
  image_url   LONGTEXT     NULL,   -- base64 data URI
  explanation TEXT         NULL,
  position    INT          NOT NULL DEFAULT 0,
  is_active   TINYINT(1)   NOT NULL DEFAULT 1,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_ecg_cards_topic (topic_id),
  INDEX idx_ecg_cards_active (is_active),
  INDEX idx_ecg_cards_position (position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ecg_quiz_questions (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  question_text VARCHAR(500) NOT NULL DEFAULT 'What does this ECG show?',
  image_url     LONGTEXT     NULL,   -- base64 data URI
  options_json  JSON         NULL,   -- [{ "text": "...", "correct": true|false }]
  explanation   TEXT         NULL,
  position      INT          NOT NULL DEFAULT 0,
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_ecg_quiz_active (is_active),
  INDEX idx_ecg_quiz_position (position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
