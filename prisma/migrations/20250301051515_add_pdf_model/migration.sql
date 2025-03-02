-- CreateTable
CREATE TABLE `Pdf` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `portionId` INTEGER NULL,
    `subjectId` INTEGER NULL,
    `chapterId` INTEGER NULL,
    `topicId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Pdf_portionId_fkey`(`portionId`),
    INDEX `Pdf_subjectId_fkey`(`subjectId`),
    INDEX `Pdf_chapterId_fkey`(`chapterId`),
    INDEX `Pdf_topicId_fkey`(`topicId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Pdf` ADD CONSTRAINT `Pdf_portionId_fkey` FOREIGN KEY (`portionId`) REFERENCES `portion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Pdf` ADD CONSTRAINT `Pdf_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `subject`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Pdf` ADD CONSTRAINT `Pdf_chapterId_fkey` FOREIGN KEY (`chapterId`) REFERENCES `chapter`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Pdf` ADD CONSTRAINT `Pdf_topicId_fkey` FOREIGN KEY (`topicId`) REFERENCES `topic`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
