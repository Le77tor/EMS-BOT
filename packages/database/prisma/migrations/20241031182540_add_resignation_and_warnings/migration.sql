-- AlterEnum
ALTER TABLE `applications` MODIFY `type` ENUM('STAFF', 'PROMOTION', 'TRANSFER', 'VACATION', 'RESIGNATION') NOT NULL;

-- AlterEnum
ALTER TABLE `applications` MODIFY `status` ENUM('PENDING', 'REVIEWED', 'APPROVED', 'REJECTED', 'CANCELLED', 'COMPLETED') NOT NULL DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE `warnings` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `reason` TEXT NOT NULL,
    `severity` ENUM('MINOR', 'MODERATE', 'SEVERE') NOT NULL DEFAULT 'MINOR',
    `status` ENUM('ACTIVE', 'EXPIRED', 'REMOVED') NOT NULL DEFAULT 'ACTIVE',
    `issuedBy` VARCHAR(191) NOT NULL,
    `issuedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NULL,
    `removedBy` VARCHAR(191) NULL,
    `removedAt` DATETIME(3) NULL,
    `removeReason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `warnings_userId_idx`(`userId`),
    INDEX `warnings_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `warnings` ADD CONSTRAINT `warnings_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
