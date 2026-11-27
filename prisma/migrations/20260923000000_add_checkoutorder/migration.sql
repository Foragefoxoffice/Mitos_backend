CREATE TABLE `checkoutorder` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `razorpayOrderId` VARCHAR(64) NOT NULL,
  `source` VARCHAR(16) NOT NULL DEFAULT 'WEB_GUEST',       -- WEB_GUEST | WEB_AUTH
  `userId` INT NULL,
  `guestPhone` VARCHAR(20) NOT NULL,
  `guestEmail` VARCHAR(255) NULL,
  `items` JSON NOT NULL,                                     -- resolved cart lines snapshot
  `originalAmount` DOUBLE NOT NULL,
  `discountAmount` DOUBLE NOT NULL DEFAULT 0,
  `finalAmount` DOUBLE NOT NULL,
  `couponId` INT NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'PENDING',          -- PENDING | PAID | FULFILLED | FAILED
  `razorpayPaymentId` VARCHAR(64) NULL,
  `fulfilledAt` DATETIME(3) NULL,
  `fulfilledBy` VARCHAR(16) NULL,                           -- VERIFY | WEBHOOK | ADMIN
  `lastError` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `checkoutorder_razorpayOrderId_key` (`razorpayOrderId`),
  KEY `checkoutorder_guestPhone_idx` (`guestPhone`),
  KEY `checkoutorder_status_idx` (`status`),
  KEY `checkoutorder_userId_idx` (`userId`),
  CONSTRAINT `checkoutorder_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
