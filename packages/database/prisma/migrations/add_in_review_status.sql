-- Migration: Add IN_REVIEW status and processedAt field to blacklist_removals
-- Date: 2026-10-31

-- Добавляем новый статус в ENUM
ALTER TABLE `blacklist_removals` 
MODIFY COLUMN `status` ENUM('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING';

-- Добавляем поле processedAt
ALTER TABLE `blacklist_removals` 
ADD COLUMN `processedAt` DATETIME(3) NULL AFTER `reviewNote`;
