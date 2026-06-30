# Operation DHURANDAR — Neon Database Setup

The Command Centre (Add Officer, Create Mission, points, achievements, postings)
used to fail in production because the app wrote to flat files (`auth.txt`,
`*.json`) and **Vercel's filesystem is read-only** — every write was silently
rejected. All data now lives in a **Neon Postgres** database, so writes persist
locally *and* on Vercel. Logins are also stored in the database, so sessions no
longer drop on serverless.

Follow these steps once.

---

## 1. Create a free Neon database

1. Go to https://neon.tech and sign up (free tier is plenty).
2. Click **Create project**. Give it a name (e.g. `dhurandar`). Pick the region
   closest to you. Click **Create**.
3. On the project dashboard, open **Connection Details**.
4. In the dropdown, choose the **Pooled connection** (the host contains
   `-pooler`). Copy the full connection string. It looks like:

   ```
   postgresql://USER:PASSWORD@ep-xxxx-pooler.REGION.aws.neon.tech/neondb?sslmode=require
   ```

   > Use the **pooled** string for a serverless app like this — it prevents
   > running out of database connections on Vercel.

---

## 2. Configure your local project

1. In the `operation-dhurandar` folder, copy `.env.example` to `.env`:

   ```bash
   cp .env.example .env
   ```

2. Open `.env` and paste your Neon string:

   ```
   DATABASE_URL=postgresql://USER:PASSWORD@ep-xxxx-pooler.REGION.aws.neon.tech/neondb?sslmode=require
   SESSION_SECRET=some-long-random-string-you-make-up
   HASH_PASSWORDS=false
   ```

3. Install dependencies and create + seed the tables (this reads your existing
   `data/` files and loads them into Neon):

   ```bash
   npm install
   npm run db:init
   ```

   You should see: `done ✓  seeded 4 officers, 9 missions.`

   - Re-running `npm run db:init` is safe (it upserts).
   - To wipe and reload everything from the `data/` files: `npm run db:fresh`.

4. Run it locally:

   ```bash
   npm run dev
   ```

   Open http://localhost:3000 and log in as `Piyush / EmotionalPaaji`
   (Brigadier). The Command Centre now saves everything to Neon.

---

## 3. Deploy on Vercel

1. Push your code to GitHub (the repo is already connected).
2. In the Vercel project: **Settings → Environment Variables**, add:

   | Name             | Value                                   |
   |------------------|-----------------------------------------|
   | `DATABASE_URL`   | your Neon **pooled** connection string  |
   | `SESSION_SECRET` | a long random string                    |
   | `HASH_PASSWORDS` | `false` (or `true` to use bcrypt)       |

3. **Redeploy** (Deployments → ⋯ → Redeploy) so the new env vars apply.

That's it. The same database powers local and production. You only need to run
`npm run db:init` once per database (you can also run it locally and it will
seed your Neon DB that Vercel uses).

---

## What changed (for reference)

- `server/db.js` — Postgres connection pool (reads `DATABASE_URL`).
- `server/store.js` — every read/write now goes to Postgres (was flat files).
- `scripts/init-db.js` — creates tables + seeds from `data/` files.
- `server.js` — sessions stored in Postgres via `connect-pg-simple`.
- Command Centre — new **Officer Dossiers** panel: update posting, add/remove
  achievements, and edit the full service record per officer.

## Optional: switch on hashed passwords

Set `HASH_PASSWORDS=true` (locally and on Vercel), then run `npm run db:fresh`
to re-seed with bcrypt-hashed passwords. New officers created from the Command
Centre will then be hashed automatically.
