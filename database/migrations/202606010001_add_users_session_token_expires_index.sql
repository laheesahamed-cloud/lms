SET @index_exists := (
  SELECT COUNT(1)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND INDEX_NAME = 'idx_users_session_token_expires'
);

SET @ddl := IF(
  @index_exists = 0,
  'ALTER TABLE users ADD INDEX idx_users_session_token_expires (session_token, session_expires_at)',
  'SELECT 1'
);

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
