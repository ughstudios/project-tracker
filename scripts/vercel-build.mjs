import { spawnSync } from "node:child_process";

function run(cmd, args) {
  const result = spawnSync(cmd, args, {
    stdio: "inherit",
    env: process.env,
    shell: false,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
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

run("npx", ["prisma", "generate"]);
run("npx", ["prisma", "migrate", "deploy"]);
run("npx", ["next", "build"]);
