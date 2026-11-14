# Deploying Lost

Lost is a Next.js 16 app with a Supabase backend. You need two services: **Supabase** (database, auth, storage, realtime) and a **host for the Next.js app**. Vercel is recommended (see §1).

Order: 1) choose host, 2) Supabase, 3) MapTiler key, 4) push code to GitHub, 5) deploy on Vercel, 6) check.

---

## 1. Host: Vercel or Netlify?

**Use Vercel.** Reasons:

- Next.js is built by the same team, so App Router, Suspense and the build output work without an adapter.
- HTTPS is on by default. Geolocation and Screen Wake Lock both require a secure context, so the app will not work on a phone over plain HTTP.
- Every push to GitHub gets a preview URL. Good for testing on a phone before going live.
- The app has no special hosting needs (no server functions, no cron, no custom headers), so Vercel's free tier covers it.

Netlify also runs Next.js (through its own adapter). It works, but it adds one more layer to debug. If you already use Netlify, the same three environment variables and steps apply.

---

## 2. Supabase

### 2.1 Create the project

1. Go to https://supabase.com/dashboard → **New project**.
2. Pick a region close to your players (for Ukraine, a central-European region).
3. Save the **database password** somewhere safe. You will need it for the CLI.

### 2.2 Enable anonymous sign-ins (required)

Players join without an account, so anonymous auth must be on.

- Dashboard → **Authentication → Sign In / Providers** → enable **Anonymous Sign-ins** → Save.

Note: the local config (`supabase/config.toml`) sets `anonymous_users = 30` (sign-ins per hour per IP). Check the matching rate limit in the dashboard under **Authentication → Rate Limits**. Friends sharing one Wi-Fi share an IP, so raise the limit if many people join at once.

### 2.3 Apply the database migrations

The schema, RLS policies, RPC functions and the private `treasure-photos` bucket all live in `supabase/migrations/`. Apply them to the remote project with the CLI:

```bash
# one-time: install the CLI if missing
brew install supabase/tap/supabase

supabase login
cd /Users/andriihuk/Desktop/Lost
supabase link --project-ref <your-project-ref>   # ref is in the dashboard URL: /project/<ref>
supabase db push                                  # applies 0001_init.sql and 0002_hardening.sql
```

`supabase link` asks for the database password from §2.1.

Migration 0002 (`0002_hardening.sql`) is required. It adds the last-treasure lock, the `join_room_as` RPC that the app uses to join, the participant guard, and the photo size and type limits. Without it, joining and photo uploads will fail.

### 2.4 Check that it worked

In the dashboard **SQL Editor**, run:

```sql
select tablename, rowsecurity from pg_tables where schemaname = 'public';
-- expect: participants, rooms, treasures with rowsecurity = true

select id, public, file_size_limit, allowed_mime_types from storage.buckets;
-- expect: treasure-photos, public = false, file_size_limit = 5242880
```

Also check **Database → Replication**: `treasures` should be in the `supabase_realtime` publication (the migration adds it).

### 2.5 Copy the API keys

Dashboard → **Project Settings → API**:

- **Project URL** → becomes `NEXT_PUBLIC_SUPABASE_URL`
- **anon / publishable key** → becomes `NEXT_PUBLIC_SUPABASE_ANON_KEY`

The anon key is public by design. Security comes from RLS, which is on for every table. **Never** put the `service_role` key in this app or in any `NEXT_PUBLIC_` variable.

### 2.6 Free-plan limits to know

- A free project **pauses after about 7 days without activity**. Open the dashboard and click "Restore" if it stops responding.
- Realtime has a concurrent-connection limit on the free plan. Fine for a friends game.

---

## 3. MapTiler key (for the map)

Without a key, the map shows a blank background (no streets).

1. Create a free account at https://cloud.maptiler.com → **Keys** → create a key.
2. Restrict it to your domains: **Key → Allowed HTTP origins** (referrers). Add:
   - your Vercel domain, e.g. `https://lost-yourname.vercel.app`
   - `http://localhost:3000` (for local work)
3. Copy the key → becomes `NEXT_PUBLIC_MAPTILER_KEY`.

Public OSM tile servers are **not** used, on purpose. Their usage policy forbids heavy app traffic.

---

## 4. Put the code on GitHub

The repo has no remote yet. Create an empty repository on GitHub (no README), then run:

```bash
cd /Users/andriihuk/Desktop/Lost
git status                                   # should be clean; .env.local and .superpowers are ignored
git remote add origin https://github.com/<you>/lost.git
git branch -M main                           # optional: Vercel expects main as the production branch
git push -u origin main
```

If you keep the branch name `lost-mvp`, set the production branch to `lost-mvp` in Vercel instead.

Check that `.env.local` is **not** pushed (it contains local keys). `git check-ignore -v .env.local` should print a match.

---

## 5. Deploy on Vercel

### 5.1 Import the repo

1. https://vercel.com → **Add New… → Project** → import the GitHub repo.
2. Framework preset: **Next.js** (auto-detected). Leave build settings as they are.
3. **Environment Variables** — add these three, for **Production and Preview**:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL from §2.5 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key from §2.5 |
| `NEXT_PUBLIC_MAPTILER_KEY` | key from §3 |

4. Click **Deploy**.

Build notes:

- `npm install` runs a `postinstall` script that copies the MapLibre worker into `public/`. This is required; the map will not render without it. Nothing to configure.
- If the build fails with "Задайте NEXT_PUBLIC_SUPABASE_URL…", a variable is missing or was added only to Development.
- Changing an env var needs a **redeploy** (Deployments → ⋯ → Redeploy). `NEXT_PUBLIC_*` values are baked in at build time.

### 5.2 Or deploy from the terminal (no GitHub needed)

```bash
npm i -g vercel
cd /Users/andriihuk/Desktop/Lost
vercel login
vercel link                    # create or pick the project
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add NEXT_PUBLIC_MAPTILER_KEY production
vercel --prod
```

Each `vercel env add` asks for the value on stdin. Add the same three for `preview` if you want preview deploys to work.

### 5.3 Custom domain (optional)

Vercel → Project → **Settings → Domains**. Add the domain, then add it to the MapTiler allowed origins (§3).

---

## 6. Check the live site

Do this on real phones, over the HTTPS URL, not on a laptop:

1. **Desktop browser:** open the URL → "Нова гра" → join form → map loads.
2. **iPhone (Safari):** open the URL on the same room → join → tap **Дозволити** for location → status shows "GPS: точно" after a few seconds.
3. **Android (Chrome):** join the same room with a different nickname → each sees the other's marker move.
4. **Host flow:** add a treasure by coordinates + one photo → it appears as an orange pin on both phones.
5. **Found flow:** stand within about 15 m of a pin → "Підтвердити знахідку" becomes active → tap → the pin turns grey on the other phone without reload.

Full device checklist: spec §10 in `docs/superpowers/specs/2026-11-14-lost-mvp-design.md`.

Known limits to tell players:

- Tracking pauses when the phone locks or the browser goes to the background (iOS limit, spec C1). Keep the screen on and Lost in front.
- No vibration on iPhone (iOS does not support the Vibration API).

---

## 7. Updating later

- **Code changes:** push to the production branch; Vercel deploys automatically.
- **Database changes:** add a new file under `supabase/migrations/`, then run `supabase db push`. Do not edit an applied migration; add a new one.
- **Keys rotated:** update the env var in Vercel and redeploy.

---

## 8. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| "Кімнату не знайдено" for a valid code | Migration 0001 or 0002 not applied | `supabase db push` |
| Join fails with an error | Anonymous sign-ins off, or migration 0002 missing | §2.2 and §2.3 |
| Map is blank grey, no streets | `NEXT_PUBLIC_MAPTILER_KEY` empty, or the domain is not in the key's allowed origins | §3 |
| "Немає зв'язку" on the map | Realtime blocked or project paused | Check the project is active; check the browser console |
| Photo upload fails | Bucket missing or migration 0002 not applied | §2.4 |
| Geolocation does nothing on a phone | Page served over HTTP, or the user denied permission | Use the HTTPS URL; check permission in browser settings |
| Build fails on Vercel with a Supabase error | Env vars missing for the environment being built | §5.1 step 3 |

---

## 9. Costs

Everything here runs on free tiers: Vercel Hobby, Supabase Free, MapTiler free tier. Limits to watch: Supabase project pausing after inactivity, Supabase realtime connections, and MapTiler's monthly map loads. A friends game stays well inside all of them.
