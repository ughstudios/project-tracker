-- CreateTable
CREATE TABLE "CustomerAttachment" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "customerId" TEXT NOT NULL,
    "uploaderId" TEXT,

    CONSTRAINT "CustomerAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerAttachment_customerId_idx" ON "CustomerAttachment"("customerId");

-- AddForeignKey
ALTER TABLE "CustomerAttachment" ADD CONSTRAINT "CustomerAttachment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomerAttachment" ADD CONSTRAINT "CustomerAttachment_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
