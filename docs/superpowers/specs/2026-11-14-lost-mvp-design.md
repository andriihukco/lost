# Lost MVP — Design

> **Superseded in part (2026-11-14):** the game is now a single global map, not rooms. Admins place treasures; players pick a nickname and an animal avatar. See `supabase/migrations/0003_admin_global.sql` and `docs/DEPLOY.md`. Sections on rooms, room codes, and copy-link describe the earlier design.

Status: draft for approval · Date: 2026-11-14 · Source: PRD v1.0 (Ukrainian), with the five defaults accepted on 2026-11-14.

## 1. Intent and why

Friends hide treasures in a real place and search for them together on their phones. The host adds treasures by typing coordinates or pinning a map, and uploads hint photos. Everyone joins by link in about five seconds, with no app install. The map shows where everyone is, and a treasure counts as found once one player reaches it.

Success for the MVP: the host sets up a room with three treasures in under two minutes from a phone, and a second player on iPhone Safari and one on Android Chrome can join, see each other and the treasures, and find one without reloading the page.

## 2. Goals, non-goals, anti-goals

**Goals**
- Join a room from a link in about five seconds: anonymous session, nickname, colour.
- Host adds treasures by coordinates (typed, pasted, or pinned) with 1–3 photos.
- Live map of members' positions and treasures, updating in near real time.
- Found detection by distance (Haversine) with GPS-accuracy compensation, and a fallback confirm.
- Mobile-first, iOS-feeling UI as set out in PRD §5.

**Non-goals (MVP)**
- Native apps, app-store distribution, push notifications.
- Background location (see §4, constraint C1).
- Accounts, login, password recovery. Sessions are anonymous.
- Short Google/Apple Maps links (`maps.app.goo.gl`, `goo.gl/maps`), GPX import, EXIF-based auto-coordinates.
- Multiple hosts, host transfer, scoring beyond a found count.
- i18n. The UI is Ukrainian only.
- Android-specific tuning. Android Chrome is tested for correctness only.

**Anti-goals (would make the MVP a failure even if it works)**
- The page feels like a web page: browser pull-to-refresh, zoom on input focus, or buttons that stick after a tap.
- Treasure coordinates or hint photos reach someone who is not a room member.
- A hint photo leaks its location through EXIF metadata.
- Two players both see "found by me" for the same treasure.

## 3. Approaches

**A. Next.js (App Router) + Supabase JS + MapLibre GL + Motion + Tailwind, deployed on Vercel.** *(Recommended.)*
PRD-mandated stack. Almost every screen is a client component (map, geolocation, realtime), so the server-side part of Next.js stays small. Vercel deploys with no config and gives HTTPS, which geolocation and Wake Lock require.
Trade-off: more framework than the app strictly needs.

**B. Vite + React SPA + vite-plugin-pwa + the same Supabase setup.**
Simpler and faster to start. No server rendering is needed, so no real benefit is lost.
Trade-off: overturns a stack the PRD fixes. I would only pick this if you want to change the PRD.

**C. Expo (React Native) native app.**
Native background location would be possible, but iOS needs the "always" location permission, which means App Store review. It also breaks the "join by link, no install" goal.
Rejected for the MVP. Revisit only if background tracking becomes a hard requirement.

**Decision: A.** It matches the PRD. B is only a better stack if the PRD changes, and C breaks the core goal.

## 4. Constraints

- **C1. Background tracking does not work on iPhone Safari.** When Safari leaves the foreground, `watchPosition` stops and the WebSocket drops. Wake Lock only keeps the screen on while the page is in front. *Accepted default:* tracking pauses when the phone locks or the app leaves the foreground. The UI shows this state.
- **C2. `navigator.vibrate` is not supported on iOS Safari.** Haptics are best effort on Android and a no-op on iPhone. The Definition of Done is changed accordingly (see §10).
- **C3. Geolocation and Wake Lock need a secure context.** Local dev over plain `http://192.168.x.x` will not work on a phone. Dev and test go through an HTTPS tunnel or the Vercel preview URL.
- **C4. Wake Lock on iOS needs Safari 16.4 or later.** Older versions show "Екран не блокується" in the status bar and the map still works.
- **C5. Map tiles.** The public OSM tile servers forbid heavy use. *Accepted default:* MapTiler free-tier key, set as an env var. OSM attribution stays on the map.
- **C6. Supabase free tier.** Realtime has a concurrent-connection limit, and free projects pause after inactivity. Acceptable for MVP.
- **C7. Source files stay under about 400 lines** (user preference).
- **C8. Stack is web-only.** The Expo QR rule in the global CLAUDE.md does not apply, because there is no `mobile/` folder.

## 5. Data model (Supabase Postgres + PostGIS)

PostGIS is in the PRD but not needed for MVP distance maths (Haversine runs client-side). It is enabled but unused, so it can be dropped without cost.

```sql
rooms (
  id uuid pk default gen_random_uuid(),
  code text unique not null,          -- 6 chars, see §6.1
  name text,
  host_id uuid not null references auth.users(id),
  status text not null default 'active' check (status in ('active','finished')),
  created_at timestamptz default now()
);

treasures (
  id uuid pk default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  title text not null,
  hint text,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  photo_paths text[] not null default '{}',  -- storage paths, not public URLs (decision D2)
  is_found boolean not null default false,
  found_by uuid references auth.users(id),   -- user id, nickname joined from participants
  found_at timestamptz
);

participants (
  id uuid pk default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  nickname text not null,
  color text not null,                       -- HEX
  unique (room_id, user_id)
);
```

**Changes from the PRD (my calls, D1–D3):**
- **D1.** `participants.found_count` is removed. The count is derived from `treasures.found_by`, so it cannot drift.
- **D2.** `photo_urls` becomes `photo_paths`. Bucket `treasure-photos` is private, and the client requests signed URLs for room members only.
- **D3.** `found_by_name` is replaced by `found_by` (user id). The nickname comes from `participants`, so a renamed player shows their current name.

## 6. Key flows and rules

### 6.1 Rooms and joining
- Room code: 6 characters from `abcdefghjkmnpqrstuvwxyz23456789` (no `0/o`, `1/l/i`). The URL is `/r/{code}` (PRD example `abc-123` is shown only as a display format).
- Joining: visiting `/r/{code}` signs in anonymously if there is no session, asks for a nickname and colour, then inserts a `participants` row. A returning user with a session in `localStorage` goes straight to the map.
- A new device means a new anonymous user and a new participant row. The host can reopen the room from the same browser.

### 6.2 Access control (RLS)
- Every table has RLS on. A user can read rows for rooms they are a participant of. Joining is a row insert where `user_id = auth.uid()` and the room exists.
- Only `host_id` can insert, update or delete treasures and update the room.
- Anyone can read the room by code only through a `rpc('join_room', code)` function, so the room list cannot be enumerated.
- The PRD's trust model is kept: members can see every coordinate, because distance is computed in the client. Anyone with dev tools can read unfound coordinates. This is accepted for a friends game.

### 6.3 Adding treasures (host)
- Input: `lat, lng` pasted or typed, or a full Google/Apple Maps URL that contains coordinates. Short links are not parsed (non-goal). Parser handles decimal degrees with `.` or `,` separators and validates ranges.
- Or tap the map to place a pin and drag it to adjust. Coordinates update live in the form.
- Photos: 1–3, selected from device. Client re-encodes to WebP or JPEG, max 1200 px on the long side, which also strips EXIF (see §6.5).
- Save writes the `treasures` row, then uploads photos to `treasure-photos/{room_id}/{treasure_id}/{n}.webp`.

### 6.4 Found
- Client computes distance from the player's position to each unfound treasure with Haversine.
- The "Підтвердити знахідку" button is enabled when `max(0, distance − accuracy) ≤ 15 m`. Example: 40 m away with 30 m accuracy gives 10 m, so it unlocks. A 40 m reading with 5 m accuracy stays locked.
- Confirm calls `rpc('mark_found', treasure_id)`. The function runs `UPDATE treasures SET is_found = true, found_by = auth.uid(), found_at = now() WHERE id = $1 AND is_found = false` and returns the winner. A losing player gets "Скарб уже знайдено" and the map updates.
- When the last treasure is found, the function sets `rooms.status = 'finished'`.
- **Manual confirm (D4):** a secondary action "Підтвердити вручну" opens a dialog with a required one-line note. It goes through the same RPC and is recorded with a `manual` flag. Keeps the PRD's fallback without letting anyone mark a treasure from anywhere silently.

### 6.5 Photo privacy
- Re-encoding to a canvas strips EXIF, including GPS. This is mandatory, and the upload path has no raw-file branch.
- Bucket is private. Signed URLs expire after one hour and are created only for room members (via storage policy on the path prefix).

## 7. Realtime

- Channel per room: `room:{code}`.
- **Positions use Broadcast**, not Presence. Positions are sent every 2–3 s while moving more than 2 m, which is heavier than Presence is designed for. Each message carries `{user_id, lat, lng, accuracy, heading?, ts}`.
- **Presence only for online state** (joined / left), so a marker can fade when someone drops.
- Markers interpolate between the last two positions over the expected update interval. Markers older than 30 s fade to 40% opacity.
- Found events arrive through **Postgres Changes** on `treasures` (filtered by `room_id`), as the PRD specifies. Postgres Changes is used only for these low-frequency updates.
- Reconnect: on `CHANNEL_ERROR`/`CLOSED`, re-subscribe with exponential backoff capped at 10 s. A status pill shows "Немає зв'язку" while down.

## 8. Screen Wake Lock and tracking states

- On map mount: `navigator.wakeLock.request('screen')` if supported. Re-request on `visibilitychange` when visible.
- Top bar shows GPS and wake lock states: "GPS: точно / слабко / немає", "Екран активний" or "Екран не блокується".
- If geolocation is denied: the map still loads, shows treasures and other players' last known positions, and shows "Увімкніть геолокацію, щоб шукати".
- Vibration: `navigator.vibrate?.(15)` on found and nearby events. Silent on iPhone (C2).

## 9. UI and interaction

- Full-bleed map at `100dvh`. `viewport-fit=cover`. Floating chrome uses `env(safe-area-inset-*)`.
- Bottom sheet with three snap points (Peek 18%, Half 50%, Full 92%). Implemented with Motion's drag and inertia, not hand-rolled (my call, D5). Rubber-banding above 92%. Grab offset preserved.
- Momentum: the sheet snaps to the projected end point from velocity, with the inertia decay Motion provides. Matching `decelerationRate = 0.998` is not a goal.
- Transitions: critically damped spring for normal UI (no bounce). Light bounce only on fast flick. Reduced motion falls back to a 150 ms opacity cross-fade.
- Material: `apple-material-thick` from the PRD, with `prefers-reduced-transparency` raising opacity to 96%. `backdrop-filter` is tested on a mid-range Android before it is kept (risk R2).
- Typography and tokens as in PRD §5.5. Inputs are `font-size: 16px` minimum. No `user-scalable=no`.
- Copy uses exact actions: "Додати на карту", "Підтвердити знахідку", "Скопіювати посилання".

## 10. Definition of Done (adjusted)

PRD DoD, with two changes:
1. Haptic feedback is verified on Android only. iPhone is verified visually, not by vibration.
2. "Екран не блокується автоматично" is verified on iPhone Safari 16.4+ and Android Chrome.

Other checks:
- Host creates a room and adds three treasures with photos in under two minutes, timed on a phone.
- Second player on iPhone Safari and on Android Chrome joins by link, sees the other player and treasures, and finds one without reloading.
- Two players tapping "Found" at once: exactly one wins, the other sees the conflict message.
- Uploaded photo has no EXIF GPS tag (checked with `exiftool` on the stored file).
- Pull-to-refresh and input zoom do not occur on iPhone.
- Unit tests (Vitest) for Haversine, the coordinate parser, and the found-threshold function. Manual test on physical devices for the rest.

## 11. Risks

| # | Risk | Mitigation |
|---|---|---|
| R1 | Tracking stops in background on iPhone (C1) | Accepted and shown in UI. Native app is the fix if required later. |
| R2 | `backdrop-filter` over WebGL map is slow on mid Android | Test early on a real device. Fall back to a solid surface on low-end. |
| R3 | GPS accuracy of 5–30 m makes the 15 m unlock unreliable | Accuracy compensation plus manual confirm with a note. |
| R4 | Anonymous session lost when browser data is cleared | Accepted for MVP. Host can reopen from the same browser. |
| R5 | Full visibility of unfound coordinates to members | Accepted for a friends game. Coordinates never reach non-members. |
| R6 | Realtime connection limit on Supabase free tier | Fine for a friends group. Monitor. |

## 12. Testing

- Unit: Haversine, coordinate parser (decimal, comma and dot separators, range errors), found threshold with accuracy.
- Integration: RLS policies checked with two anonymous users and one non-member (Supabase local or a dev project). The `mark_found` race is tested with two concurrent calls.
- Manual on physical devices: iPhone Safari and Android Chrome, over an HTTPS tunnel.
- No E2E framework in MVP.

## 13. Build order (after approval)

1. `git init`, Next.js app, Supabase project, migrations with RLS and the two RPCs.
2. Join flow and anonymous session.
3. Map with MapTiler style, own position, treasures list.
4. Host: add treasure by coordinates, then by map pin, with photo pipeline.
5. Realtime: Broadcast positions, Presence for online state, Postgres Changes for found.
6. Found flow, manual confirm, finished state.
7. Wake Lock and GPS status indicators.
8. Bottom sheet with Motion, then the Apple styling pass.
9. Device testing and fixes.

## 14. Decisions I made (please check)

- **D1.** `found_count` removed; derived from `treasures`.
- **D2.** Photos are private and stored as paths, not public URLs.
- **D3.** `found_by` is a user id; the nickname is joined from `participants`.
- **D4.** Manual confirm is kept, requires a note, and is flagged `manual`.
- **D5.** Bottom sheet uses Motion's drag and inertia, not a custom physics engine.
- **D6.** Room code is 6 characters from an unambiguous alphabet, stored without a hyphen.
- **D7.** Vercel is the host.
- **D8.** Ukrainian UI only, one host per room, no host transfer.
- **D9.** Treasures can be added at any time while the room is active, not only before the game starts.
- **D10.** Room becomes `finished` automatically when the last treasure is found.

## 15. Accepted defaults (the five from the chat, 2026-11-14)

1. Unfound pins are shown to seekers, as the PRD says.
2. Tracking pauses in background (C1).
3. Map tiles from MapTiler free tier.
4. New Supabase project, anonymous auth on, RLS on.
5. Ukrainian UI only.
