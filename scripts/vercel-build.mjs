import { spawnSync } from "node:child_process";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function run(cmd, args) {
  const result = spawnSync(cmd, args, {
    stdio: "pipe",
    env: process.env,
    shell: false,
    encoding: "utf8",
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw result.error;
  return result;
}

async function runOrExit(cmd, args) {
  const result = run(cmd, args);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function isAdvisoryLockTimeout(output) {
  return (
    output.includes("P1002") &&
    output.includes("pg_advisory_lock")
  );
}

async function runMigrateDeployWithRetry() {
  const maxAttempts = 8;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = run("npx", ["prisma", "migrate", "deploy"]);
    if (result.status === 0) return;

    const combinedOutput = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
    const shouldRetry = isAdvisoryLockTimeout(combinedOutput) && attempt < maxAttempts;
    if (!shouldRetry) {
      process.exit(result.status ?? 1);
    }

    const waitMs = Math.min(16_000, 2000 * 2 ** (attempt - 1));
    console.warn(
      `Prisma migrate deploy hit advisory lock timeout (attempt ${attempt}/${maxAttempts}). Retrying in ${waitMs}ms...`,
    );
    await sleep(waitMs);
  }
}

/**
 * Convert legacy HEIC/HEIF attachment blobs to JPEG (idempotent). Runs after `next build` on Vercel
 * when `BLOB_READ_WRITE_TOKEN` is set. Skip with `SKIP_HEIC_MIGRATION_ON_DEPLOY=1`.
 * For non-Vercel CI, set `RUN_HEIC_MIGRATION_ON_DEPLOY=1`.
 */
function shouldRunHeicAttachmentMigration() {
  if (process.env.SKIP_HEIC_MIGRATION_ON_DEPLOY === "1") {
    console.log("Skipping HEIC attachment migration (SKIP_HEIC_MIGRATION_ON_DEPLOY=1).");
    return false;
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    console.log("Skipping HEIC attachment migration: BLOB_READ_WRITE_TOKEN not set.");
    return false;
  }
  if (process.env.VERCEL === "1") return true;
  if (process.env.RUN_HEIC_MIGRATION_ON_DEPLOY === "1") return true;
  console.log(
    "Skipping HEIC attachment migration (local build). Deploy on Vercel or set RUN_HEIC_MIGRATION_ON_DEPLOY=1.",
  );
  return false;
}

const dbUrl = process.env.DATABASE_URL?.trim();
if (!dbUrl) {
  console.error(`
================================================================================
BUILD FAILED: DATABASE_URL is not set.

Prisma reads prisma/schema.prisma at build time and requires DATABASE_URL.

FIX (about 2 minutes):
1. Create Postgres: https://neon.tech → sign in → New project → copy the connection string.
   Use the URI meant for Prisma / psql (often ends with /neondb or your DB name).
   If Neon shows parameters, add: ?sslmode=require
2. Vercel → your Project → Settings → Environment Variables
   Add DATABASE_URL for Production (and Preview if you deploy previews).
   If DATABASE_URL uses Neon’s pooler (host contains \`-pooler\`), also add DATABASE_DIRECT_URL
   (non-pooled Prisma URI — see VERCEL.md / \`npm run neon:url:direct\`) so \`prisma migrate deploy\` avoids P1002 advisory lock timeouts.
3. Add AUTH_SECRET (run locally: openssl rand -base64 32)
4. Add AUTH_URL = https://YOUR-PROJECT.vercel.app (your real Vercel URL, no trailing slash)
5. Save → Deployments → latest → … → Redeploy

See VERCEL.md in this repo for the full checklist.
================================================================================
`);
  process.exit(1);
}

const directUrl = process.env.DATABASE_DIRECT_URL?.trim();
if (!directUrl) {
  console.error(`
================================================================================
BUILD FAILED: DATABASE_DIRECT_URL is not set.

Migrations (\`prisma migrate deploy\`) must use a direct Postgres connection.
Use your normal pooled DATABASE_URL for the app; set DATABASE_DIRECT_URL to Neon’s
non-pooled Prisma string (host without \`-pooler\`). Same password and database name.

CLI (after \`neonctl\` context):  npm run neon:url:direct
See VERCEL.md → Environment Variables.
================================================================================
`);
  process.exit(1);
}

await runOrExit("npx", ["prisma", "generate"]);
await runMigrateDeployWithRetry();
await runOrExit("npx", ["next", "build"]);

if (shouldRunHeicAttachmentMigration()) {
  console.log("\nRunning HEIC → JPEG attachment migration (no-op if nothing to convert)...\n");
  const mig = run("npx", ["tsx", "scripts/migrate-heic-attachments.ts"]);
  if (mig.status !== 0) {
    console.error("\nHEIC attachment migration failed. Fix errors or set SKIP_HEIC_MIGRATION_ON_DEPLOY=1.\n");
    process.exit(mig.status ?? 1);
  }
}
