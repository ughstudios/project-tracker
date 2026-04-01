-- AlterTable
ALTER TABLE "Issue" DROP CONSTRAINT "Issue_projectId_fkey";

ALTER TABLE "Issue" ALTER COLUMN "projectId" DROP NOT NULL;

ALTER TABLE "Issue" ADD CONSTRAINT "Issue_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
