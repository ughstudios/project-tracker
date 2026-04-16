-- Relay staging: store chunk bytes in Vercel Blob only; Postgres keeps URLs (Neon size limit).
-- In-flight relay sessions are ephemeral; clear before schema change.
DELETE FROM "BlobRelayChunk";
DELETE FROM "BlobRelayUpload";

ALTER TABLE "BlobRelayChunk" DROP COLUMN "data";

ALTER TABLE "BlobRelayChunk" ADD COLUMN "partUrl" TEXT NOT NULL;
