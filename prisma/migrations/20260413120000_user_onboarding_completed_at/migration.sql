ALTER TABLE "User" ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3);

UPDATE "User" SET "onboardingCompletedAt" = NOW() WHERE "onboardingCompletedAt" IS NULL;
