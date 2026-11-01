-- AlterTable: Добавляем поле userJoinedGuild в employment_applications
ALTER TABLE `employment_applications` ADD COLUMN `userJoinedGuild` BOOLEAN NOT NULL DEFAULT false;
