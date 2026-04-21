-- AlterTable
ALTER TABLE "PublicCustomerRequest" ADD COLUMN "assigneeId" TEXT;

-- CreateIndex
CREATE INDEX "PublicCustomerRequest_assigneeId_idx" ON "PublicCustomerRequest"("assigneeId");

-- AddForeignKey
ALTER TABLE "PublicCustomerRequest" ADD CONSTRAINT "PublicCustomerRequest_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
