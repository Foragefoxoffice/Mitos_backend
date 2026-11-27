-- CreateTable
CREATE TABLE `whatsappconversation` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `userId` INTEGER NULL,
  `phoneNumber` VARCHAR(20) NOT NULL,
  `ownerTest` BOOLEAN NOT NULL DEFAULT false,
  `preview` BOOLEAN NOT NULL DEFAULT false,
  `status` VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  `channel` VARCHAR(20) NOT NULL DEFAULT 'WHATSAPP',
  `lastMessageAt` DATETIME(3) NULL,
  `lastInboundAt` DATETIME(3) NULL,
  `lastOutboundAt` DATETIME(3) NULL,
  `lastMessagePreview` VARCHAR(255) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `whatsappconversation_phoneNumber_key`(`phoneNumber`),
  INDEX `whatsappconversation_userId_idx`(`userId`),
  INDEX `whatsappconversation_ownerTest_idx`(`ownerTest`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `whatsappmessage` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `conversationId` INTEGER NOT NULL,
  `waMessageId` VARCHAR(100) NULL,
  `direction` VARCHAR(20) NOT NULL,
  `senderRole` VARCHAR(20) NOT NULL,
  `messageType` VARCHAR(30) NOT NULL,
  `status` VARCHAR(30) NOT NULL DEFAULT 'accepted',
  `text` LONGTEXT NULL,
  `rawPayload` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `whatsappmessage_waMessageId_key`(`waMessageId`),
  INDEX `whatsappmessage_conversationId_createdAt_idx`(`conversationId`, `createdAt`),
  INDEX `whatsappmessage_status_idx`(`status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `saleslead` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `conversationId` INTEGER NULL,
  `userId` INTEGER NULL,
  `phoneNumber` VARCHAR(20) NOT NULL,
  `stage` VARCHAR(20) NOT NULL DEFAULT 'NEW',
  `leadScore` INTEGER NOT NULL DEFAULT 0,
  `lastSummary` LONGTEXT NULL,
  `objectionTags` JSON NULL,
  `nextAction` VARCHAR(100) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `saleslead_conversationId_key`(`conversationId`),
  INDEX `saleslead_userId_idx`(`userId`),
  INDEX `saleslead_phoneNumber_idx`(`phoneNumber`),
  INDEX `saleslead_stage_idx`(`stage`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `salesoffer` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `leadId` INTEGER NOT NULL,
  `offerType` VARCHAR(40) NULL,
  `title` VARCHAR(120) NULL,
  `couponCode` VARCHAR(60) NULL,
  `planCode` VARCHAR(60) NULL,
  `checkoutUrl` TEXT NULL,
  `metadata` JSON NULL,
  `sentAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `salesoffer_leadId_idx`(`leadId`),
  INDEX `salesoffer_planCode_idx`(`planCode`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `saleshandoff` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `leadId` INTEGER NOT NULL,
  `reason` VARCHAR(120) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'OPEN',
  `notes` LONGTEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `resolvedAt` DATETIME(3) NULL,
  INDEX `saleshandoff_leadId_idx`(`leadId`),
  INDEX `saleshandoff_status_idx`(`status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `aireplyaudit` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `conversationId` INTEGER NULL,
  `leadId` INTEGER NULL,
  `sourceMessageId` INTEGER NULL,
  `promptVersion` VARCHAR(40) NULL,
  `provider` VARCHAR(20) NULL,
  `model` VARCHAR(100) NULL,
  `systemPrompt` LONGTEXT NULL,
  `promptText` LONGTEXT NULL,
  `replyText` LONGTEXT NULL,
  `toolTrace` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `aireplyaudit_conversationId_idx`(`conversationId`),
  INDEX `aireplyaudit_leadId_idx`(`leadId`),
  INDEX `aireplyaudit_sourceMessageId_idx`(`sourceMessageId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `whatsappconversation`
  ADD CONSTRAINT `whatsappconversation_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `whatsappmessage`
  ADD CONSTRAINT `whatsappmessage_conversationId_fkey`
  FOREIGN KEY (`conversationId`) REFERENCES `whatsappconversation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `saleslead`
  ADD CONSTRAINT `saleslead_conversationId_fkey`
  FOREIGN KEY (`conversationId`) REFERENCES `whatsappconversation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `saleslead`
  ADD CONSTRAINT `saleslead_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `salesoffer`
  ADD CONSTRAINT `salesoffer_leadId_fkey`
  FOREIGN KEY (`leadId`) REFERENCES `saleslead`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `saleshandoff`
  ADD CONSTRAINT `saleshandoff_leadId_fkey`
  FOREIGN KEY (`leadId`) REFERENCES `saleslead`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `aireplyaudit`
  ADD CONSTRAINT `aireplyaudit_conversationId_fkey`
  FOREIGN KEY (`conversationId`) REFERENCES `whatsappconversation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `aireplyaudit`
  ADD CONSTRAINT `aireplyaudit_leadId_fkey`
  FOREIGN KEY (`leadId`) REFERENCES `saleslead`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `aireplyaudit`
  ADD CONSTRAINT `aireplyaudit_sourceMessageId_fkey`
  FOREIGN KEY (`sourceMessageId`) REFERENCES `whatsappmessage`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
