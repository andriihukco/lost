-- Lost MVP schema (spec §5, §6.2, §6.4, §6.5). Decisions D1–D4 applied.

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[abcdefghjkmnpqrstuvwxyz23456789]{6}$'),
  name text,
  host_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'finished')),
  created_at timestamptz not null default now()
);

create table public.treasures (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  hint text,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  photo_paths text[] not null default '{}',              -- decision D2
  is_found boolean not null default false,
  found_by uuid references auth.users(id),               -- decision D3
  found_at timestamptz,
  found_manual boolean not null default false,           -- decision D4
  found_note text,
  check (is_found = false or (found_by is not null and found_at is not null))
);
create index treasures_room_idx on public.treasures (room_id);

create table public.participants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 24),
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  unique (room_id, user_id)
);
-- decision D1: no found_count column; counts are derived from treasures.found_by.

-- Security-definer helpers avoid RLS recursion between participants and the rest.
create or replace function public.is_room_member(p_room uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.participants where room_id = p_room and user_id = auth.uid());
$$;

create or replace function public.is_room_host(p_room uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.rooms where id = p_room and host_id = auth.uid());
$$;

alter table public.rooms enable row level security;
alter table public.treasures enable row level security;
alter table public.participants enable row level security;

create policy rooms_insert_as_host on public.rooms for insert
  with check (host_id = auth.uid());
create policy rooms_select_member on public.rooms for select
  using (host_id = auth.uid() or public.is_room_member(id));  -- host must see the row it just inserted
create policy rooms_update_host on public.rooms for update
  using (host_id = auth.uid()) with check (host_id = auth.uid());

create policy participants_select_member on public.participants for select
  using (public.is_room_member(room_id));
create policy participants_insert_self on public.participants for insert
  with check (user_id = auth.uid());
create policy participants_update_self on public.participants for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy treasures_select_member on public.treasures for select
  using (public.is_room_member(room_id));
create policy treasures_insert_host on public.treasures for insert
  with check (public.is_room_host(room_id));
create policy treasures_update_host on public.treasures for update
  using (public.is_room_host(room_id)) with check (public.is_room_host(room_id));
create policy treasures_delete_host on public.treasures for delete
  using (public.is_room_host(room_id));

-- Join by code: the code is the secret (spec §6.2). Returns zero rows for an unknown code.
-- Set-returning on purpose: PostgREST serializes a NULL composite as an all-null object, not null.
create or replace function public.join_room(p_code text)
returns setof public.rooms language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  return query select * from public.rooms where code = lower(p_code);
end $$;

-- Atomic first-come claim (spec §6.4). Losers get 'taken'; non-members get 'not_member'.
create or replace function public.mark_found(p_treasure_id uuid, p_manual_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_room uuid;
  v_by uuid;
  v_remaining int;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  if not exists (
    select 1 from public.treasures t
    where t.id = p_treasure_id and public.is_room_member(t.room_id)
  ) then
    return jsonb_build_object('status', 'not_member', 'found_by', null);
  end if;

  update public.treasures
     set is_found = true, found_by = auth.uid(), found_at = now(),
         found_manual = (p_manual_note is not null), found_note = p_manual_note
   where id = p_treasure_id and is_found = false
   returning room_id, found_by into v_room, v_by;

  if not found then
    select found_by into v_by from public.treasures where id = p_treasure_id;
    return jsonb_build_object('status', 'taken', 'found_by', v_by);
  end if;

  select count(*) into v_remaining from public.treasures
   where room_id = v_room and is_found = false;
  if v_remaining = 0 then
    update public.rooms set status = 'finished' where id = v_room;
  end if;

  return jsonb_build_object('status', 'won', 'found_by', v_by);
end $$;

revoke execute on function public.join_room(text) from public, anon;
revoke execute on function public.mark_found(uuid, text) from public, anon;
grant execute on function public.join_room(text) to authenticated;
grant execute on function public.mark_found(uuid, text) to authenticated;

-- Private photo bucket; members read via signed URLs, only the host uploads (spec §6.5).
insert into storage.buckets (id, name, public)
values ('treasure-photos', 'treasure-photos', false)
on conflict (id) do nothing;

create policy photos_read_members on storage.objects for select to authenticated
  using (bucket_id = 'treasure-photos'
         and public.is_room_member(((storage.foldername(name))[1])::uuid));
create policy photos_insert_host on storage.objects for insert to authenticated
  with check (bucket_id = 'treasure-photos'
              and public.is_room_host(((storage.foldername(name))[1])::uuid));

-- Found events reach clients through Postgres Changes (spec §7).
alter publication supabase_realtime add table public.treasures;
