-- Many-to-many issue assignees (replaces Issue.assigneeId).

CREATE TABLE "IssueAssignment" (
    "issueId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "IssueAssignment_pkey" PRIMARY KEY ("issueId","userId")
);

CREATE INDEX "IssueAssignment_userId_idx" ON "IssueAssignment"("userId");

ALTER TABLE "IssueAssignment" ADD CONSTRAINT "IssueAssignment_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IssueAssignment" ADD CONSTRAINT "IssueAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "IssueAssignment" ("issueId", "userId")
SELECT "id", "assigneeId" FROM "Issue" WHERE "assigneeId" IS NOT NULL;

ALTER TABLE "Issue" DROP CONSTRAINT "Issue_assigneeId_fkey";

ALTER TABLE "Issue" DROP COLUMN "assigneeId";
