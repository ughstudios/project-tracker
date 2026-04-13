ALTER TABLE "Issue"
ADD COLUMN "titleTranslated" TEXT,
ADD COLUMN "symptomTranslated" TEXT,
ADD COLUMN "causeTranslated" TEXT,
ADD COLUMN "solutionTranslated" TEXT,
ADD COLUMN "contentLanguage" TEXT;

ALTER TABLE "IssueThreadEntry"
ADD COLUMN "contentTranslated" TEXT,
ADD COLUMN "contentLanguage" TEXT;
