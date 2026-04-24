-- Add optional project manager relation (any approved user can be assigned).
ALTER TABLE "Project"
ADD COLUMN "managerId" TEXT;

CREATE INDEX "Project_managerId_idx" ON "Project"("managerId");

ALTER TABLE "Project"
ADD CONSTRAINT "Project_managerId_fkey"
FOREIGN KEY ("managerId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
