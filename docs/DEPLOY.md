# Deploying Lost

Lost is a single global game: one map, players who choose a nickname and an animal, and admins who place the treasures. It runs on **Next.js 16** (Vercel) and **Supabase** (database, auth, storage, realtime).

Order: 1) Supabase, 2) admin account, 3) MapTiler key, 4) Vercel, 5) check.

---

## 1. Supabase

### 1.1 Project and anonymous sign-ins

Players sign in anonymously, so anonymous auth must be on.

- Dashboard → **Authentication → Sign In / Providers** → enable **Anonymous Sign-ins** → Save.
- Dashboard → **Authentication → Rate Limits**: anonymous sign-ins are limited per IP per hour (the local config uses 30). Friends on one Wi-Fi share an IP, so raise the limit if many people join at once.

### 1.2 Apply the migrations

The schema lives in `supabase/migrations/`:

| File | What it does |
|---|---|
| `0001_init.sql` | First schema (rooms model). Superseded by 0003. |
| `0002_hardening.sql` | Hardening of the rooms model. Superseded by 0003. |
| `0003_admin_global.sql` | **Global game:** drops rooms, adds `admins` and `players`, admin-only treasures, photo rules. |
| `0004_history_undo.sql` | Location trail (`location_log`), found history (`found_events`), undo for a mistaken find (`unmark_found`). Additive. |

Run them from the repo folder:

```bash
cd /Users/andriihuk/Desktop/Lost
supabase link --project-ref <your-project-ref>   # /project/<ref> in the dashboard URL
supabase migration list --linked                 # shows what is local and what is applied
supabase db push --linked
```

> **Destructive:** 0003 drops the `rooms`, `participants` and `treasures` tables. Any rooms or treasures on the remote project are lost. Your project has only test data so far, so this is expected. Do not run it on a project that holds real data.

Check after the push (SQL editor, read-only):

```sql
select table_name from information_schema.tables
where table_schema = 'public' order by 1;
-- expect: admins, players, treasures

select proname from pg_proc where proname in ('is_admin', 'mark_found', 'unmark_found') order by 1;
-- expect: is_admin, mark_found, unmark_found

select id, file_size_limit from storage.buckets where id = 'treasure-photos';
-- expect: treasure-photos, 5242880
```

### 1.3 Keys

Dashboard → **Project Settings → API**:

- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon / publishable key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

The anon key is public by design; RLS protects the data. **Never** put the `service_role` key in the app or in any `NEXT_PUBLIC_` variable.

### 1.4 Free-plan limits

- A free project **pauses after about 7 days without activity**. Restore it from the dashboard if it stops responding.
- Realtime has a concurrent-connection limit on the free plan. Fine for a friends game.

---

## 2. Admin account

Only admins can place treasures. Admins sign in with email and password on `/admin`. Players never need an account.

1. Dashboard → **Authentication → Users → Add user → Create new user**. Enter an email and a strong password, and tick **Auto Confirm User**.
2. Grant the admin role in the SQL editor (replace the email):

```sql
insert into public.admins (user_id)
select id from auth.users where email = 'you@example.com'
on conflict do nothing;
```

3. Check it: `select count(*) from public.admins;` should be at least 1.

To add another admin, repeat both steps. To remove one, delete the row from `public.admins`.

---

## 3. MapTiler key (for the map)

Without a key the map shows a blank background (no streets).

1. Create a free account at https://cloud.maptiler.com → **Keys** → create a key.
2. Restrict it: **Key → Allowed HTTP origins**. Add:
   - your Vercel domain, e.g. `https://lost-yourname.vercel.app`
   - `http://localhost:3000` (local work)
3. Copy the key → `NEXT_PUBLIC_MAPTILER_KEY`.

**OpenStreetMap is the reserve.** Without a key, or if MapTiler starts refusing requests (401, 403, 429), the map switches to OpenStreetMap tiles. OSM's public tile servers forbid heavy app traffic, so keep MapTiler as the primary for real use. Attribution is shown on the map.

---

## 4. Code on GitHub

The code is already at `https://github.com/andriihukco/lost` (branch `main`). After a change, commit and push:

```bash
cd /Users/andriihuk/Desktop/Lost
git status                      # .env.local and .superpowers are ignored
git add -A
git commit -m "your message"
git push origin HEAD:main
```

---

## 5. Deploy on Vercel

Vercel is recommended over Netlify: Next.js is first-party there, HTTPS is on by default (geolocation and Wake Lock need it), and no adapter is needed.

1. https://vercel.com → **Add New… → Project** → import `andriihukco/lost`. Production branch: `main`.
2. **Environment Variables**, for **Production and Preview**:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL from §1.3 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key from §1.3 |
| `NEXT_PUBLIC_MAPTILER_KEY` | key from §3 |

3. **Deploy.**

Notes:

- `npm install` runs a `postinstall` script that copies the MapLibre worker into `public/`. Nothing to configure.
- Build error "Задайте NEXT_PUBLIC_SUPABASE_URL…" means a variable is missing for that environment.
- `NEXT_PUBLIC_*` values are baked in at build time. After changing one, redeploy.
- Add the Vercel domain to the MapTiler origins (§3).

---

## 6. Check the live site

Use real phones over the HTTPS URL:

1. **Desktop:** open the URL → the map loads with the onboarding sheet → enter a name, pick an animal → **Зберегти і відкрити карту** → the map opens.
2. **Phone 2 (Safari or Chrome):** the same URL → onboarding → you see phone 1's animal move on the map.
3. **Admin:** `/admin` → sign in → add a treasure with coordinates and at least one photo → it appears as an orange pin on both phones.
4. **Found:** stand within about 15 m of a pin → **Підтвердити знахідку** → the pin turns grey on the other phone without reload.

Limits to tell players:

- Tracking pauses when the phone locks or the browser goes to the background (iOS limit).
- No vibration on iPhone.

---

## 7. Updating later

- **Code:** push to `main`; Vercel deploys automatically.
- **Database:** add a new file under `supabase/migrations/` and run `supabase db push --linked`. Do not edit an applied migration.
- **Keys rotated:** update the env var in Vercel and redeploy.

---

## 8. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| "Не вдалося створити сесію" on the map | Anonymous sign-ins off, or the anonymous rate limit reached | §1.1 |
| Map is blank grey, no streets | MapTiler key empty, or the domain is not in its allowed origins | §3 |
| Admin login says "Цей акаунт не має доступу адміністратора" | Admin row missing for that user | §2 step 2 |
| Treasure save fails for admin | 0003 not applied, or the admin is not in `public.admins` | §1.2, §2 |
| Photo upload fails | Photo over 5 MB or not WebP/JPEG, or not admin | Compressed photos are well under 5 MB; check the account |
| No other player visible | Other phone not onboarded, or realtime blocked | Check the project is active; check the browser console |
| Geolocation does nothing on a phone | Page served over HTTP, or permission denied | Use the HTTPS URL; check browser permissions |

---

## 9. Costs

Free tiers throughout: Vercel Hobby, Supabase Free, MapTiler free. Watch Supabase project pausing, realtime connections and MapTiler monthly map loads. A friends game stays well inside all of them.
