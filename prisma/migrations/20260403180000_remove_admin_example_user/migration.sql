-- Remove legacy demo user admin@example.com (reassign required FKs when another user exists).

UPDATE "Issue" SET "assigneeId" = NULL
WHERE "assigneeId" IN (SELECT id FROM "User" WHERE email = 'admin@example.com');

WITH rep AS (
  SELECT id AS rid FROM "User" WHERE email <> 'admin@example.com' ORDER BY "createdAt" ASC LIMIT 1
)
UPDATE "Issue" i SET "reporterId" = rep.rid FROM rep
WHERE i."reporterId" IN (SELECT id FROM "User" WHERE email = 'admin@example.com')
  AND EXISTS (SELECT 1 FROM rep);

WITH rep AS (
  SELECT id AS rid FROM "User" WHERE email <> 'admin@example.com' ORDER BY "createdAt" ASC LIMIT 1
)
UPDATE "IssueThreadEntry" e SET "authorId" = rep.rid FROM rep
WHERE e."authorId" IN (SELECT id FROM "User" WHERE email = 'admin@example.com')
  AND EXISTS (SELECT 1 FROM rep);

WITH rep AS (
  SELECT id AS rid FROM "User" WHERE email <> 'admin@example.com' ORDER BY "createdAt" ASC LIMIT 1
)
UPDATE "ProjectNote" n SET "authorId" = rep.rid FROM rep
WHERE n."authorId" IN (SELECT id FROM "User" WHERE email = 'admin@example.com')
  AND EXISTS (SELECT 1 FROM rep);

DELETE FROM "User" WHERE email = 'admin@example.com';
