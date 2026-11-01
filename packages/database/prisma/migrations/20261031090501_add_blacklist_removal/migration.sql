-- CreateTable
CREATE TABLE `blacklist_removals` (
    `id` VARCHAR(191) NOT NULL,
    `firstName` VARCHAR(191) NOT NULL,
    `lastName` VARCHAR(191) NOT NULL,
    `static` VARCHAR(191) NOT NULL,
    `discordId` VARCHAR(191) NOT NULL,
    `blacklistReason` TEXT NOT NULL,
    `removalReason` TEXT NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `sentToDiscord` BOOLEAN NOT NULL DEFAULT false,
    `discordMessageId` VARCHAR(191) NULL,
    `reviewedBy` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `reviewNote` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `blacklist_removals_status_idx`(`status`),
    INDEX `blacklist_removals_sentToDiscord_idx`(`sentToDiscord`),
    INDEX `blacklist_removals_discordId_idx`(`discordId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
