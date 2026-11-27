-- CreateTable
CREATE TABLE `personalcouponassignment` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `identifier` VARCHAR(255) NOT NULL,
  `couponId` INTEGER NOT NULL,
  `note` VARCHAR(255) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `personalcouponassignment_identifier_idx`(`identifier`),
  INDEX `personalcouponassignment_couponId_idx`(`couponId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `personalcouponassignment` ADD CONSTRAINT `personalcouponassignment_couponId_fkey` FOREIGN KEY (`couponId`) REFERENCES `coupon`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
