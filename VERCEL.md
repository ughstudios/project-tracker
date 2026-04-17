# Deploy on Vercel

This app uses **PostgreSQL**. Vercel’s build runs Prisma, so **`DATABASE_URL`** and **`DATABASE_DIRECT_URL`** must exist before `npm run build`** — otherwise you get `P1012 Environment variable not found: …`.

## 0. Order of operations (important)

1. Create Postgres (Neon below) and copy **`DATABASE_URL`** (pooled is best for serverless) plus **`DATABASE_DIRECT_URL`** (non-pooled for migrations — avoids Prisma **P1002** / `pg_advisory_lock` timeouts on Neon’s pooler).
2. In Vercel → **Settings → Environment Variables**, add **all** variables below for **Production** (and **Preview** if you use preview deployments).
3. **Redeploy** (or trigger a new deploy). Do not expect the first deploy to succeed if **`DATABASE_URL`** or **`DATABASE_DIRECT_URL`** was missing.

## 1. Postgres on Neon (free)

1. Open [Neon](https://neon.tech) and sign in.
2. **Create project** → choose a region close to your Vercel region (e.g. US East).
3. In the Neon dashboard, open **Connection details** / **Connection string**.
4. Copy the **PostgreSQL URI** (user, password, host, database).  
   - Use **pooled** for `DATABASE_URL` (Neon host contains `-pooler`) and **direct** (non-pooled host) for `DATABASE_DIRECT_URL`. Prisma runs **`migrate deploy`** over `directUrl`; using only the pooler often causes **P1002** advisory lock timeouts during Vercel builds.
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

3. **Print Prisma-friendly connection strings** (pooled for the app, direct for migrations):

   ```bash
   npm run neon:url
   npm run neon:url:direct
   ```

   Copy the first URI to **`DATABASE_URL`** and the second to **`DATABASE_DIRECT_URL`** in Vercel (and `.env` locally).

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
| **`DATABASE_URL`** | Pooled Neon URI (**`npm run neon:url`**). **Required for build** and for the app at runtime. |
| **`DATABASE_DIRECT_URL`** | Non-pooled Neon URI (**`npm run neon:url:direct`**). **Required for build** so `prisma migrate deploy` uses a direct session (avoids **P1002** / `pg_advisory_lock` timeouts). If you use a single non-pooled URL locally, you may set this to the **same** value as `DATABASE_URL`. |
| **`AUTH_SECRET`** | Long random string, e.g. run `openssl rand -base64 32` locally. |
| **`AUTH_URL`** | **Exact origin users use in the browser** (no trailing slash). Examples: `https://tracker.colorlightcloud.com` for a custom domain, or `https://<project>.vercel.app`. **Do not use `http://localhost:3000` in production** — mismatched Auth.js cookies often cause “page couldn’t load” with `200` on RSC requests. |
| **`NEXTAUTH_URL`** | Same value as `AUTH_URL` (keeps older NextAuth tooling happy). |
| **`BLOB_READ_WRITE_TOKEN`** | **Required for file uploads on Vercel.** Create a Blob store under **Storage** → connect it to this project so Vercel injects this token. Serverless functions cannot write under `public/uploads`. |
| **`AI_GATEWAY_API_KEY`** | Optional; from **Vercel → AI Gateway → API keys**. Required for the in-app **AI assistant** and (when set) for **EN↔ZH issue/thread translation** via the [AI Gateway](https://vercel.com/docs/ai-gateway/getting-started/text). If omitted, the assistant is disabled and translations fall back to direct OpenAI keys below, or original text only. |
| **`AI_CHAT_MODEL`** | Optional chat model id for the assistant. Default: `gpt-5.4` (sent to the gateway as `openai/gpt-5.4`). You may set a full gateway id such as `anthropic/claude-sonnet-4.5`. |
| **`OPENAI_TRANSLATION_MODEL`** | Optional override for the translation model. Default: `gpt-4o-mini` (gateway: `openai/gpt-4o-mini`). |
| **`AI_KEY`** or **`OPENAI_API_KEY`** | Optional **fallback** for translation **only** when `AI_GATEWAY_API_KEY` is not set. Uses the public OpenAI API. |

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
export DATABASE_URL="postgresql://..."          # same as Vercel
export DATABASE_DIRECT_URL="postgresql://..."   # same as Vercel (non-pooled, or same as URL if not using pooler)
npm ci
npm run db:generate
npm run db:seed
```

Seed promotes `daniel.gleason@lednets.com` to **SUPER_ADMIN** (new installs: `SEED_ADMIN_PASSWORD` or `please-change-me`), removes legacy `admin@example.com` and `employee1@example.com` if present, and promotes any remaining `ADMIN` role to `SUPER_ADMIN`.

## 6. File uploads

### Vercel Blob (production)

1. Add **`BLOB_READ_WRITE_TOKEN`** (see environment table): **Storage → Blob** → create/connect a store for this project.
2. Objects are uploaded with **`put(..., { access: 'public' })`** so stored URLs work directly in the UI (`<img>`, `<a href>`, `<video src>`). Vercel’s snippets often use `access: 'private'`; **private** blobs need signed URLs or a download proxy, which this app does not implement.
3. **Request size:** Server-side uploads run in Serverless Functions with a **~4.5 MB** body limit. On Vercel (`VERCEL=1`), total file bytes per request (plus thread message text for multipart replies) must stay under **4 MB** so the request is accepted. **Local** dev without Blob still allows up to **1 GB** per file under `public/uploads`.

For files **larger than ~4 MB** in production, plan **[client-side uploads](https://vercel.com/docs/storage/vercel-blob/client-upload)** (not in this repo yet).

### Local env from Vercel

After **`vercel link`**, run **`vercel env pull`** to write `.env.local` with `BLOB_READ_WRITE_TOKEN` and the rest of your project variables.

### Without Blob on Vercel

Upload routes return **503** with setup instructions instead of failing with `ENOENT` on `mkdir`.
