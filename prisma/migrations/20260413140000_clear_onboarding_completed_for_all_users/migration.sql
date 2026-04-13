-- Require every account to see the onboarding tour (undo one-time backfill).
UPDATE "User" SET "onboardingCompletedAt" = NULL;
