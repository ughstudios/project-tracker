-- CreateEnum
CREATE TYPE "PublicCustomerRequestKind" AS ENUM ('CALIBRATION', 'PROCESSOR_RMA');

-- CreateTable
CREATE TABLE "PublicCustomerRequest" (
    "submissionId" TEXT NOT NULL,
    "kind" "PublicCustomerRequestKind" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "closedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "sourceAuditLogId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicCustomerRequest_pkey" PRIMARY KEY ("submissionId")
);

-- CreateTable
CREATE TABLE "PublicCustomerRequestThreadEntry" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "submissionId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,

    CONSTRAINT "PublicCustomerRequestThreadEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PublicCustomerRequest_archivedAt_createdAt_idx" ON "PublicCustomerRequest"("archivedAt", "createdAt");

-- CreateIndex
CREATE INDEX "PublicCustomerRequest_status_closedAt_archivedAt_idx" ON "PublicCustomerRequest"("status", "closedAt", "archivedAt");

-- CreateIndex
CREATE INDEX "PublicCustomerRequestThreadEntry_submissionId_createdAt_idx" ON "PublicCustomerRequestThreadEntry"("submissionId", "createdAt");

-- AddForeignKey
ALTER TABLE "PublicCustomerRequestThreadEntry" ADD CONSTRAINT "PublicCustomerRequestThreadEntry_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "PublicCustomerRequest"("submissionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicCustomerRequestThreadEntry" ADD CONSTRAINT "PublicCustomerRequestThreadEntry_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill from existing public-form audit rows
INSERT INTO "PublicCustomerRequest" ("submissionId", "kind", "status", "closedAt", "archivedAt", "sourceAuditLogId", "createdAt", "updatedAt")
SELECT
    al."entityId",
    CASE
        WHEN al."entityType" = 'PublicCalibrationRequest' THEN 'CALIBRATION'::"PublicCustomerRequestKind"
        ELSE 'PROCESSOR_RMA'::"PublicCustomerRequestKind"
    END,
    'PENDING',
    NULL,
    NULL,
    al."id",
    al."createdAt",
    al."createdAt"
FROM "AuditLog" al
WHERE al."action" = 'CREATE'
  AND al."entityType" IN ('PublicCalibrationRequest', 'PublicProcessorRmaRequest')
  AND NOT EXISTS (
      SELECT 1 FROM "PublicCustomerRequest" p WHERE p."submissionId" = al."entityId"
  );
