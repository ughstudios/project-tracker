ALTER TABLE "User"
ADD COLUMN "approvalStatus" TEXT NOT NULL DEFAULT 'APPROVED',
ADD COLUMN "approvedAt" TIMESTAMP(3);

UPDATE "User"
SET "approvalStatus" = 'APPROVED'
WHERE "approvalStatus" IS NULL;
