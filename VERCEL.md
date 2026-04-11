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

## 2.1 Vercel Blob — so the next `git push` deploy works

The app does **not** read your **store ID** or **region** (for example IAD1 / Washington, D.C.) from code. Those are shown in the dashboard for your reference only. Runtime uploads use the **`BLOB_READ_WRITE_TOKEN`** Vercel attaches when the store is linked to the project.

Do this once per project (then any push to `main` is enough):

1. Open **[Vercel Dashboard](https://vercel.com/dashboard) → Storage** and select your Blob store.
2. Use **Connect Project** and choose the **same** Vercel project that deploys this Git repo.
3. Go to that project → **Settings → Environment Variables** and confirm **`BLOB_READ_WRITE_TOKEN`** exists.
4. Assign that variable to **Production** and **Preview** (and **Development** if you use `vercel dev`). If it is only on Production, **preview** URLs will return **503** on uploads until you add it there too.
5. **Redeploy** the latest commit once after connecting (or push again): the build does not need the token, but **serverless routes** need it at runtime.

No `vercel.json` or store ID in this repository is required.

## 3. Required environment variables

Vercel → **Project → Settings → Environment Variables**:

| Name | Notes |
|------|--------|
| **`DATABASE_URL`** | Full Neon URI from step 1. **Required for build.** |
| **`AUTH_SECRET`** | Long random string, e.g. run `openssl rand -base64 32` locally. |
| **`AUTH_URL`** | **Exact origin users use in the browser** (no trailing slash). Examples: `https://tracker.colorlightcloud.com` for a custom domain, or `https://<project>.vercel.app`. **Do not use `http://localhost:3000` in production** — mismatched Auth.js cookies often cause “page couldn’t load” with `200` on RSC requests. |
| **`NEXTAUTH_URL`** | Same value as `AUTH_URL` (keeps older NextAuth tooling happy). |
| **`BLOB_READ_WRITE_TOKEN`** | **Required for file uploads on Vercel.** Create a Blob store under **Storage** → connect it to this project so Vercel injects this token. Serverless functions cannot write under `public/uploads`. |

After saving, **Redeploy** so the build sees the new values.

### Custom domain (e.g. `tracker.colorlightcloud.com`)

Point **`AUTH_URL`** and **`NEXTAUTH_URL`** at **`https://tracker.colorlightcloud.com`**, not at localhost and not only at the default `*.vercel.app` URL unless that is what people use to sign in. After changing these, **clear cookies** for the site (or use a private window) and **sign in again** so `authjs.callback-url` and session cookies match the live origin.

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

Seed promotes `daniel.gleason@lednets.com` to **SUPER_ADMIN** (new installs: `SEED_ADMIN_PASSWORD` or `please-change-me`), removes legacy `admin@example.com` and `employee1@example.com` if present, and promotes any remaining `ADMIN` role to `SUPER_ADMIN`.

## 6. File uploads

### Vercel Blob (production)

1. Add **`BLOB_READ_WRITE_TOKEN`** (see environment table): **Storage → Blob** → create/connect a store for this project.
2. Objects are uploaded with **`put(..., { access: 'public' })`** so stored URLs work directly in the UI (`<img>`, `<a href>`, `<video src>`). Vercel’s snippets often use `access: 'private'`; **private** blobs need signed URLs or a download proxy, which this app does not implement.
3. **Request size:** Server-side uploads run in Serverless Functions with a **~4.5 MB** body limit. On Vercel (`VERCEL=1`), total file bytes per request (plus thread message text for multipart replies) must stay under **4 MB** so the request is accepted. **Local** dev without Blob still allows up to **100 MB** per file under `public/uploads`.

For files **larger than ~4 MB** in production, plan **[client-side uploads](https://vercel.com/docs/storage/vercel-blob/client-upload)** (not in this repo yet).

### Local env from Vercel

After **`vercel link`**, run **`vercel env pull`** to write `.env.local` with `BLOB_READ_WRITE_TOKEN` and the rest of your project variables.

### Without Blob on Vercel

Upload routes return **503** with setup instructions instead of failing with `ENOENT` on `mkdir`.
