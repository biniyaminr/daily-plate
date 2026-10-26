# Benji’s Daily Plate

Benji’s personal meal, workout and progress website: a seven-day Ethiopian meal
plan, a five-day training schedule with two recovery days, a food log with macro
totals, weigh-ins, and walking and sleep check-ins.

Built with Next.js on Vercel, with Supabase for the database (PostgreSQL) and
for email/password accounts. The public home page describes the site only.
Every log, weigh-in and backup is private to the signed-in account.

## How it is put together

| Part | Where |
| --- | --- |
| Public home page and account pages (sign in, sign up, reset password) | `app/` (Next.js App Router) |
| The meal and workout app: the original pages, kept as they were | `shell/index.html`, `shell/nutrition.html`, served only to signed-in users by `app/app/route.ts` and `app/app/nutrition/route.ts` |
| App scripts and styles | `public/plate/` (`fitness.js`, `app.js`, `visuals.js`, `merge.js`, `sync.js`, `importer.js`, `dates.js`, `fitness.css`, `extra.css`) |
| Records API | `app/api/progress/route.ts` (GET/PUT), `app/api/progress/validate/route.ts` (checks a backup without saving) |
| Validation and save rules | `lib/progress/schema.ts`, `lib/progress/handler.ts` |
| Database | `supabase/migrations/20261026000000_progress.sql` |
| Session refresh and route protection | `proxy.ts`, `lib/supabase/` |

**Records.** Each account has two records, `fitness` (profile, daily logs, weigh-ins)
and `nutrition` (targets and weighed food entries). Both use the same JSON shape as the original site, so old
backups import directly.

**Privacy.**
- Identity always comes from the verified Supabase session on the server.
- The database applies row-level security. A user can only select, insert or update their own rows; delete is not allowed at all.
- The app never uses the Supabase service-role key. Every query runs as the signed-in user, so the database itself enforces isolation.
- Responses carrying personal data are sent with `Cache-Control: private, no-store`.

**No silent overwrites.** Every save is a compare-and-swap on a revision number
(`save_progress()` in the migration). If another tab or device saved first, the
save is refused with HTTP 409 and the page offers two choices:
- merge this tab's new entries into the latest data, keeping the newer values where they differ;
- load the latest data and drop this tab's changes.

In both cases a copy of this tab's version downloads first.

**Saving states.** The bar at the top of the app shows one of: saving, saved,
offline, error, signed out, or conflict. "Saved" appears only after the server
confirms the write. Unsaved edits are kept in this browser, per account, until
they reach the server.

**Version history.** Every update copies the previous version into
`progress_history` (the last 50 per record). This is a safety net for undoing a
mistaken import (see *Recovering an earlier version* below).

**Dates.** Calendar days follow `Africa/Addis_Ababa`, whatever timezone the
device uses. `public/plate/dates.js` does date maths on plain `YYYY-MM-DD`
strings so days never shift.

## Local development

Needs Node 22.13+ and pnpm 11 (`corepack enable` or `npx pnpm@11.25.0`).
`pnpm-workspace.yaml` only installs package versions that have been public for at
least 7 days.

```bash
pnpm install
cp .env.example .env.local      # fill in your Supabase URL and publishable key
pnpm dev                         # http://localhost:3000
```

## Supabase setup (one time)

1. **Create a project.** On supabase.com, create a new project (the free plan is fine). Pick a region close to Addis Ababa, such as Frankfurt (eu-central-1).
2. **Create the tables.** Open **SQL Editor**, paste in all of `supabase/migrations/20261026000000_progress.sql`, and run it.
3. **Set the sign-in URLs.** Go to **Authentication → URL Configuration**:
   - Site URL: `https://www.biniyam.site` (the bare domain redirects to `www`)
   - Redirect URLs:
     - `https://biniyam.site/**`
     - `https://www.biniyam.site/**`
     - `http://localhost:3000/**`
     - `https://daily-plate-sooty.vercel.app/**`
     - `https://*-biniyaminrs-projects.vercel.app/**` (Vercel preview deployments)
4. **Turn on sign-up.** Go to **Authentication → Sign In / Providers → Email** and keep "Confirm email" on.
5. **Make email links work on any device.** In **Authentication → Emails → Templates**, replace the link in these two templates:
   - **Confirm signup:** `<a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email">Confirm your email</a>`
   - **Reset password:** `<a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=recovery">Choose a new password</a>`

   The app already puts `?next=…` in the redirect address, which is why these links start with `&`. Unchanged default templates also work, but only when the link is opened in the same browser that asked for it.
6. **Copy the keys.** In **Project Settings → API keys**, copy the Project URL and the **publishable** key into Vercel (see below). Never copy the secret or service-role key.
7. **Optional, after creating your own account:** turn off **Allow new users to sign up** if nobody else should be able to create an account.

The free email sender is rate limited to a few emails per hour. For dependable
emails, set up custom SMTP under **Authentication → Emails → SMTP Settings**.

## Vercel

1. Import the GitHub repository `biniyaminr/daily-plate` into Vercel. The framework is detected as Next.js and the defaults are fine.
2. Under **Settings → Environment Variables**, add these for Production, Preview and Development:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
3. Under **Settings → Domains**, add `biniyam.site` and `www.biniyam.site`. Set one to redirect to the other, then add the DNS records Vercel shows at your registrar. Leave any other DNS records alone.
4. Redeploy after changing environment variables, so the build picks them up.

## Tests

```bash
pnpm test        # unit: merge, import preview, Addis Ababa date handling
pnpm test:db     # PostgreSQL: the real migration + RLS + API handler
pnpm typecheck && pnpm lint && pnpm build
```

`pnpm test:db` starts a throwaway local PostgreSQL (15 or newer; set `PGBIN` if
it isn't on your `PATH`). It applies a small stand-in for Supabase's `auth`
schema (`tests/db/supabase-stub.sql`) and then the real migration. It checks:
- sign-in requirements and the same-origin check;
- validation and size limits;
- user isolation, both through the API and directly in SQL;
- that records cannot be deleted;
- stale writes, and two tabs saving at the same moment;
- version history;
- backup validation.

For browser testing without Supabase, run
`node --experimental-strip-types tests/e2e/local-server.mjs`. It serves the real
pages and the real API handler with an in-memory store and a fixed test user.

## Moving progress from the old website

The old site kept data either in its own database (signed in with ChatGPT) or
in that browser only. Neither carries over automatically: a browser keeps saved
data separately for each website, so biniyam.site cannot see the old site's.

1. On the old site, open **My progress** and choose **Download backup**. If you
   used it without signing in, use **Download browser backup** on the device
   where you logged things.
2. Sign in on biniyam.site. **Import before logging anything new.** Otherwise the
   new account creates its own profile (with today's start date), and the
   import keeps the account's values where they differ.
3. Choose **Import backup**, either in the top bar or under **My progress**, and
   pick the file. It is checked on the server and nothing is saved yet.
4. Read the preview. It shows how many weigh-ins, logged days and food entries
   are new, and lists each value that differs from your account.
5. Keep **Add missing records** selected (the default) and choose Import. This
   never removes or changes what is already in your account, and importing the
   same file again adds nothing.

   **Replace my account records** is only for starting over. You must type
   REPLACE to confirm, and your current records download first.
6. The confirmation lists exactly what was added. Check your other devices: the
   records are there after a refresh.

Keep the old site and its data until you have checked everything on biniyam.site.

## Recovering an earlier version

In the Supabase **SQL Editor** (which runs as the project owner):

```sql
select id, kind, revision, replaced_at
from progress_history
where user_id = '<your user id>'
order by id desc;
```

To restore one, copy its `payload` out to a JSON file shaped like
`{ "version": 1, "fitness": … }` and import it with **Replace**.

## Not in this version

- **No offline start-up.** There is no service worker, so the app needs a
  connection to open. Edits made after it loads are kept if the connection drops.
- **Food values are estimates.** The food list gives values per 100 g, and
  Ethiopian dishes are marked "estimated". Use package labels for exact numbers.
- **The original workout PDF was not part of the source.** The plan comes from
  what was already in the code.
