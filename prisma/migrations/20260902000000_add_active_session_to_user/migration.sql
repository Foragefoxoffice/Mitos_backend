-- AlterTable
ALTER TABLE `user`
  ADD COLUMN `activeSessionId` VARCHAR(64) NULL,
  ADD COLUMN `activeSessionDeviceId` VARCHAR(64) NULL,
  ADD COLUMN `activeSessionLabel` VARCHAR(100) NULL,
  ADD COLUMN `activeSessionAt` DATETIME(3) NULL;
