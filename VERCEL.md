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

Defaults from seed: `admin@example.com` / `admin123` — change in production.

## 6. File uploads

`.rcvbp` / `.cbp` uploads write under `public/uploads` on disk; on Vercel that is **not durable**. Plan blob storage later if you need persistent files.
