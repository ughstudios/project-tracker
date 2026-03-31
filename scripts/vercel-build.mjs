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
  const maxAttempts = 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = run("npx", ["prisma", "migrate", "deploy"]);
    if (result.status === 0) return;

    const combinedOutput = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
    const shouldRetry = isAdvisoryLockTimeout(combinedOutput) && attempt < maxAttempts;
    if (!shouldRetry) {
      process.exit(result.status ?? 1);
    }

    const waitMs = 2000 * attempt;
    console.warn(
      `Prisma migrate deploy hit advisory lock timeout (attempt ${attempt}/${maxAttempts}). Retrying in ${waitMs}ms...`,
    );
    await sleep(waitMs);
  }
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
3. Add AUTH_SECRET (run locally: openssl rand -base64 32)
4. Add AUTH_URL = https://YOUR-PROJECT.vercel.app (your real Vercel URL, no trailing slash)
5. Save → Deployments → latest → … → Redeploy

See VERCEL.md in this repo for the full checklist.
================================================================================
`);
  process.exit(1);
}

await runOrExit("npx", ["prisma", "generate"]);
await runMigrateDeployWithRetry();
await runOrExit("npx", ["next", "build"]);
