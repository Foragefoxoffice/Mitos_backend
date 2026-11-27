-- AlterTable
ALTER TABLE `user` ADD COLUMN `fcmPlatform` VARCHAR(10) NULL;

-- AlterTable
ALTER TABLE `notification` ADD COLUMN `campaignId` INTEGER NULL;

-- CreateIndex
CREATE INDEX `notification_campaignId_idx` ON `notification`(`campaignId`);

-- CreateTable
CREATE TABLE `notificationcampaign` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` TEXT NOT NULL,
    `message` LONGTEXT NOT NULL,
    `imageUrl` TEXT NULL,
    `deepLinkScreen` VARCHAR(191) NULL,
    `platform` VARCHAR(10) NOT NULL DEFAULT 'ALL',
    `audience` TEXT NOT NULL,
    `forceResend` BOOLEAN NOT NULL DEFAULT false,
    `totalUsers` INTEGER NOT NULL DEFAULT 0,
    `skippedAlreadyNotified` INTEGER NOT NULL DEFAULT 0,
    `skippedOtherPlatform` INTEGER NOT NULL DEFAULT 0,
    `delivered` INTEGER NOT NULL DEFAULT 0,
    `noToken` INTEGER NOT NULL DEFAULT 0,
    `invalidToken` INTEGER NOT NULL DEFAULT 0,
    `failedOther` INTEGER NOT NULL DEFAULT 0,
    `sentByUserId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notificationcampaign_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Backfill fcmPlatform for users who already have a token, from the device
-- label the mobile app sends at login (brand + model, e.g. "Apple iPhone15,2"
-- / "samsung SM-S911B", or the "iOS 17" / "Android 34" fallback). Anyone
-- left NULL gets filled in by saveFcmToken's User-Agent fallback the next
-- time they open the app.
UPDATE `user` SET `fcmPlatform` = 'ios'
  WHERE `fcmToken` IS NOT NULL
    AND (`activeSessionLabel` LIKE 'Apple %' OR `activeSessionLabel` LIKE 'iOS %');
UPDATE `user` SET `fcmPlatform` = 'android'
  WHERE `fcmToken` IS NOT NULL AND `fcmPlatform` IS NULL
    AND `activeSessionLabel` IS NOT NULL;
