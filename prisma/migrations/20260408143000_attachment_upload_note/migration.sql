-- AlterTable
ALTER TABLE "IssueAttachment" ADD COLUMN "uploadNote" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "IssueThreadAttachment" ADD COLUMN "uploadNote" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "ProjectAttachment" ADD COLUMN "uploadNote" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "CustomerAttachment" ADD COLUMN "uploadNote" TEXT NOT NULL DEFAULT '';
