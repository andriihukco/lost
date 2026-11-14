-- Map marks: admin-placed warnings and notes (a dangerous dog, a closed entrance). Shown on the map only:
-- they are not treasures, so they never count, never show on the compass or nearby list, and cannot be found.
create table public.map_marks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 80),
  note text check (note is null or char_length(note) <= 300),
  emoji text not null default '⚠️' check (char_length(emoji) between 1 and 8),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  created_at timestamptz not null default now()
);

alter table public.map_marks enable row level security;

-- Every signed-in player reads the marks; only admins write them.
create policy map_marks_select_all on public.map_marks for select to authenticated
  using (true);
create policy map_marks_insert_admin on public.map_marks for insert to authenticated
  with check (public.is_admin());
create policy map_marks_update_admin on public.map_marks for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy map_marks_delete_admin on public.map_marks for delete to authenticated
  using (public.is_admin());
