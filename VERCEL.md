# Deploy on Vercel

This app uses **PostgreSQL** (required on Vercel; SQLite is not suitable for serverless).

## 1. Create a database

Use a free tier such as [Neon](https://neon.tech) or [Supabase](https://supabase.com). Copy the connection string (PostgreSQL URL).

## 2. Create a Vercel project

- Import this repository (or connect the Git repo).
- **Root directory**: `issue-tracker` if the repo root is `colorlight_python`; otherwise use the folder that contains `package.json`.

## 3. Environment variables

In Vercel → Project → Settings → Environment Variables, add:

| Name | Value |
|------|--------|
| `DATABASE_URL` | Your Postgres URL (often append `?sslmode=require` for Neon). |
| `AUTH_SECRET` | Run `openssl rand -base64 32` and paste the result. |
| `AUTH_URL` | `https://<your-deployment>.vercel.app` (update after first deploy if the URL changes). |
| `NEXTAUTH_URL` | Same as `AUTH_URL` (optional but safe to set). |

Redeploy after changing env vars.

## 4. Build

The `build` script runs `prisma migrate deploy` so the schema is applied on each production build. Ensure `DATABASE_URL` is set for **Production** (and Preview if you use preview DBs).

## 5. Seed data (first user)

Locally (or any machine with Node), set `DATABASE_URL` to the **same** production database, then:

```bash
cd issue-tracker
npm ci
npx prisma generate
npm run db:seed
```

Default login after seed: `admin@example.com` / `admin123` (change in production).

## 6. File uploads

Project `.rcvbp` / `.cbp` uploads are stored on the local filesystem under `public/uploads`. On Vercel, that storage is **not durable**. For production uploads, plan to move to blob storage (e.g. Vercel Blob, S3); the rest of the app works without changing the DB.
