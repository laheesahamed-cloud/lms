-- Drug Randomizer feature — run once on prod DB
-- =============================================

CREATE TABLE IF NOT EXISTS drugs (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name             VARCHAR(255)  NOT NULL,
  drug_class       VARCHAR(255)  NULL,
  uses             TEXT          NULL,
  dosage_adult     TEXT          NULL,
  dosage_pediatric TEXT          NULL,
  side_effects     TEXT          NULL,
  warnings         TEXT          NULL,
  drug_interactions TEXT         NULL,
  pregnancy_info   TEXT          NULL,
  sl_brand_names   TEXT          NULL,
  is_active        TINYINT(1)   NOT NULL DEFAULT 1,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS drug_randomizer_sessions (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED NOT NULL,
  drug_id    INT UNSIGNED NOT NULL,
  spun_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_drug (drug_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Settings rows (run only if they don't exist yet)
INSERT IGNORE INTO settings (`key`, `value`, `label`, `type`)
VALUES
  ('drug_randomizer_enabled', 'true',  'Drug Randomizer: Enabled',        'boolean'),
  ('drug_randomizer_free_limit', '5',  'Drug Randomizer: Free Spin Limit', 'number');
