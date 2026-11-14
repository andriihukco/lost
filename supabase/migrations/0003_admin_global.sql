-- Global game (no rooms). Admins place treasures; everyone else is a player who picks
-- a nickname and an animal avatar. Replaces the room model from 0001/0002.

-- Drop the room model. Policies on storage that use the room helpers go first.
drop policy if exists photos_read_members on storage.objects;
drop policy if exists photos_insert_host on storage.objects;
drop policy if exists photos_delete_host on storage.objects;

drop table if exists public.participants cascade;
drop table if exists public.treasures cascade;
drop table if exists public.rooms cascade;

drop function if exists public.join_room(text);
drop function if exists public.join_room_as(text, text, text);
drop function if exists public.mark_found(uuid, text);
drop function if exists public.is_room_member(uuid);
drop function if exists public.is_room_host(uuid);
drop function if exists public.forbid_participant_identity_change();

-- Admins: rows added by hand (see docs/DEPLOY.md). No client writes.
create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- Players: one row per browser identity, created when the player saves onboarding.
create table public.players (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 24),
  avatar text not null check (avatar in (
    'fox', 'bear', 'panda', 'koala', 'tiger', 'lion', 'frog', 'monkey', 'penguin',
    'rabbit', 'pig', 'cow', 'dog', 'cat', 'octopus', 'owl', 'unicorn', 'turtle'
  )),
  created_at timestamptz not null default now()
);

-- Treasures: global. Only admins write them.
create table public.treasures (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 80),
  hint text,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  photo_paths text[] not null default '{}',
  is_found boolean not null default false,
  found_by uuid references auth.users(id),
  found_at timestamptz,
  found_manual boolean not null default false,
  found_note text,
  created_at timestamptz not null default now(),
  check (is_found = false or (found_by is not null and found_at is not null))
);

alter table public.admins enable row level security;
alter table public.players enable row level security;
alter table public.treasures enable row level security;

create policy admins_select_self on public.admins for select to authenticated
  using (user_id = auth.uid());

create policy players_select_all on public.players for select to authenticated
  using (true);
create policy players_insert_self on public.players for insert to authenticated
  with check (user_id = auth.uid());
create policy players_update_self on public.players for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy treasures_select_all on public.treasures for select to authenticated
  using (true);
create policy treasures_insert_admin on public.treasures for insert to authenticated
  with check (public.is_admin());
create policy treasures_update_admin on public.treasures for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy treasures_delete_admin on public.treasures for delete to authenticated
  using (public.is_admin());

-- First claim wins (spec §6.4). Only players may claim. Atomic on the treasure row.
create or replace function public.mark_found(p_treasure_id uuid, p_manual_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_by uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from public.players where user_id = auth.uid()) then
    return jsonb_build_object('status', 'not_player', 'found_by', null);
  end if;
  if not exists (select 1 from public.treasures where id = p_treasure_id) then
    return jsonb_build_object('status', 'not_found', 'found_by', null);
  end if;

  update public.treasures
     set is_found = true, found_by = auth.uid(), found_at = now(),
         found_manual = (p_manual_note is not null), found_note = p_manual_note
   where id = p_treasure_id and is_found = false
   returning found_by into v_by;

  if not found then
    select found_by into v_by from public.treasures where id = p_treasure_id;
    return jsonb_build_object('status', 'taken', 'found_by', v_by);
  end if;

  return jsonb_build_object('status', 'won', 'found_by', v_by);
end $$;

revoke execute on function public.mark_found(uuid, text) from public, anon;
grant execute on function public.mark_found(uuid, text) to authenticated;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Photos: any player reads (signed URLs); only admins upload or delete.
create policy photos_read_authenticated on storage.objects for select to authenticated
  using (bucket_id = 'treasure-photos');
create policy photos_insert_admin on storage.objects for insert to authenticated
  with check (bucket_id = 'treasure-photos' and public.is_admin());
create policy photos_delete_admin on storage.objects for delete to authenticated
  using (bucket_id = 'treasure-photos' and public.is_admin());

-- Found events reach clients through Postgres Changes (the table was dropped and re-created).
alter publication supabase_realtime add table public.treasures;
