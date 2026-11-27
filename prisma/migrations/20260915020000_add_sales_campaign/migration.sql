-- CreateTable
CREATE TABLE `salescampaign` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `templateName` VARCHAR(255) NOT NULL,
  `templateLanguage` VARCHAR(10) NOT NULL,
  `templateCategory` VARCHAR(20) NOT NULL,
  `totalTargeted` INTEGER NOT NULL DEFAULT 0,
  `sentCount` INTEGER NOT NULL DEFAULT 0,
  `skippedCount` INTEGER NOT NULL DEFAULT 0,
  `failedCount` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `salescampaign_createdAt_idx`(`createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `whatsappmessage` ADD COLUMN `campaignId` INTEGER NULL;

-- CreateIndex
CREATE INDEX `whatsappmessage_campaignId_idx` ON `whatsappmessage`(`campaignId`);

-- AddForeignKey
ALTER TABLE `whatsappmessage` ADD CONSTRAINT `whatsappmessage_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `salescampaign`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
