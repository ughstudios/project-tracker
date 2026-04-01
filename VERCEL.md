# Deploy on Vercel

This app uses **PostgreSQL**. Vercel’s build runs Prisma, so **`DATABASE_URL` must exist before `npm run build`** — otherwise you get `P1012 Environment variable not found: DATABASE_URL`.

## 0. Order of operations (important)

1. Create Postgres (Neon below) and copy `DATABASE_URL`.
2. In Vercel → **Settings → Environment Variables**, add **all** variables below for **Production** (and **Preview** if you use preview deployments).
3. **Redeploy** (or trigger a new deploy). Do not expect the first deploy to succeed if `DATABASE_URL` was missing.

## 1. Postgres on Neon (free)

1. Open [Neon](https://neon.tech) and sign in.
2. **Create project** → choose a region close to your Vercel region (e.g. US East).
3. In the Neon dashboard, open **Connection details** / **Connection string**.
4. Copy the **PostgreSQL URI** (user, password, host, database).  
   - If Neon offers **pooled** vs **direct**: either works for Prisma migrate; pooled is fine for serverless runtime.
   - Append **`?sslmode=require`** if the string does not already include SSL params.

Example shape (yours will differ):

```text
postgresql://USER:PASSWORD@HOST.neon.tech/neondb?sslmode=require
```

### Neon CLI (same database; good for local + copy/paste to Vercel)

Install nothing permanently; commands use `npx` under the hood (`package.json` scripts wrap them).

1. **Log in** (opens browser once):

   ```bash
   npm run neon:auth
   ```

2. **Create a project** in a region near Vercel (US East is `aws-us-east-1`; change `--name` / `--region-id` if you like):

   ```bash
   npm run neon:create
   ```

   Or create manually in the [Neon console](https://console.neon.tech) and run **`npm run neon:url`** after selecting that project with `neonctl set-context` if needed.

3. **Print a Prisma-friendly pooled connection string** (use this as `DATABASE_URL` in `.env` locally and in Vercel):

   ```bash
   npm run neon:url
   ```

   Copy the full URI into Vercel → Environment Variables → `DATABASE_URL`.

4. **Optional — `neonctl init` for Cursor** (Neon’s “AI assistant” starter; not required for the app to run):

   ```bash
   npm run neon:init
   ```

   See also: [Neon CLI — connection-string](https://neon.com/docs/reference/neon-cli).

## 2. Vercel project

- Import [github.com/ughstudios/project-tracker](https://github.com/ughstudios/project-tracker).
- **Root directory**: leave default (this repo’s `package.json` is at the repo root).

## 3. Required environment variables

Vercel → **Project → Settings → Environment Variables**:

| Name | Notes |
|------|--------|
| **`DATABASE_URL`** | Full Neon URI from step 1. **Required for build.** |
| **`AUTH_SECRET`** | Long random string, e.g. run `openssl rand -base64 32` locally. |
| **`AUTH_URL`** | `https://<your-project>.vercel.app` (no trailing slash). Use your real production hostname. |
| **`NEXTAUTH_URL`** | Same value as `AUTH_URL` (keeps older NextAuth tooling happy). |

After saving, **Redeploy** so the build sees the new values.

## 4. What the build does

`npm run build` runs (via `scripts/vercel-build.mjs`):

1. `prisma generate`
2. `prisma migrate deploy` (applies `prisma/migrations` to your Neon database)
3. `next build`

## 5. First login (seed)

After a successful deploy, create users in the **same** database Neon URI:

```bash
cd issue-tracker
export DATABASE_URL="postgresql://..."   # same as Vercel
npm ci
npm run db:generate
npm run db:seed
```

Seed promotes `daniel.gleason@lednets.com` to ADMIN (new installs: `SEED_ADMIN_PASSWORD` or `please-change-me`), ensures `admin@example.com` / `admin123` as **EMPLOYEE**, and removes legacy `employee1@example.com` if present.

## 6. File uploads

`.rcvbp` / `.cbp` uploads write under `public/uploads` on disk; on Vercel that is **not durable**. Plan blob storage later if you need persistent files.
