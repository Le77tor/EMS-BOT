-- Add displayName column to users table
-- Migration: 001_add_display_name
-- Date: 2026-10-28

-- Check if column exists before adding
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists 
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'users' 
  AND COLUMN_NAME = 'displayName';

-- Add column only if it doesn't exist
SET @query = IF(@col_exists = 0,
    'ALTER TABLE `users` ADD COLUMN `displayName` VARCHAR(255) NULL AFTER `username`',
    'SELECT "Column displayName already exists" AS msg'
);

PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Update existing users: set displayName = username as fallback
UPDATE `users` 
SET `displayName` = `username` 
WHERE `displayName` IS NULL;

SELECT 'Migration 001_add_display_name completed successfully' AS result;
