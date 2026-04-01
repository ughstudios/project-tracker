-- AlterTable
ALTER TABLE "public"."Issue" ADD COLUMN     "customerId" TEXT;

-- AddForeignKey
ALTER TABLE "public"."Issue" ADD CONSTRAINT "Issue_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
