/**
 * One-time / maintenance: convert existing HEIC/HEIF attachment blobs to JPEG and update DB rows.
 *
 * From `issue-tracker/` (loads `.env` via dotenv):
 *   npm run migrate:heic -- --dry-run
 *   npm run migrate:heic -- --limit=20
 *   npm run migrate:heic
 *
 * Requires: DATABASE_URL, BLOB_READ_WRITE_TOKEN, same blob access env as the app.
 */
import "dotenv/config";

import { runHeicAttachmentMigration } from "../src/lib/heic-attachment-migration";

function parseArgs(argv: string[]) {
  let dryRun = false;
  let limit: number | undefined;
  for (const a of argv) {
    if (a === "--dry-run") dryRun = true;
    const m = /^--limit=(\d+)$/.exec(a);
    if (m) limit = Number(m[1]);
  }
  return { dryRun, limit };
}

async function main() {
  const { dryRun, limit } = parseArgs(process.argv.slice(2));
  console.log(
    dryRun
      ? "Dry run: no database or blob changes."
      : "Live run: will update rows and replace blobs.",
  );
  if (limit !== undefined) console.log(`Processing at most ${limit} attachment(s) (oldest first).`);

  const summary = await runHeicAttachmentMigration({ dryRun, limit });
  console.log(JSON.stringify(summary, null, 2));
  if (summary.errors.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
