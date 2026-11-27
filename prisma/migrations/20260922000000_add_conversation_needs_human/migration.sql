-- AlterTable
ALTER TABLE `whatsappconversation`
  ADD COLUMN `needsHuman` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `needsHumanReason` VARCHAR(255) NULL,
  ADD COLUMN `needsHumanAt` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `whatsappconversation_needsHuman_idx` ON `whatsappconversation`(`needsHuman`);
