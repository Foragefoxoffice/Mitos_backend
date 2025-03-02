/*
  Warnings:

  - You are about to drop the column `questionText` on the `question` table. All the data in the column will be lost.
  - You are about to drop the `test` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `portionId` to the `question` table without a default value. This is not possible if the table is not empty.
  - Added the required column `question` to the `question` table without a default value. This is not possible if the table is not empty.
  - Added the required column `portionId` to the `subject` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `test` DROP FOREIGN KEY `test_questionId_fkey`;

-- AlterTable
ALTER TABLE `question` DROP COLUMN `questionText`,
    ADD COLUMN `image` VARCHAR(191) NULL,
    ADD COLUMN `portionId` INTEGER NOT NULL,
    ADD COLUMN `question` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `subject` ADD COLUMN `portionId` INTEGER NOT NULL;

-- DropTable
DROP TABLE `test`;

-- CreateTable
CREATE TABLE `portion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Portion_id_fkey`(`id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TestResult` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `score` INTEGER NOT NULL,
    `totalMarks` INTEGER NOT NULL,
    `answered` INTEGER NOT NULL,
    `correct` INTEGER NOT NULL,
    `wrong` INTEGER NOT NULL,
    `unanswered` INTEGER NOT NULL,
    `accuracy` DOUBLE NOT NULL,
    `totalTimeTaken` INTEGER NOT NULL,
    `resultsByType` JSON NOT NULL,
    `resultsByChapter` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TestResult_userId_fkey`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Question_portionId_fkey` ON `question`(`portionId`);

-- CreateIndex
CREATE INDEX `subject_portionId_fkey` ON `subject`(`portionId`);

-- AddForeignKey
ALTER TABLE `subject` ADD CONSTRAINT `subject_portionId_fkey` FOREIGN KEY (`portionId`) REFERENCES `portion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `question` ADD CONSTRAINT `question_portionId_fkey` FOREIGN KEY (`portionId`) REFERENCES `portion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TestResult` ADD CONSTRAINT `TestResult_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
