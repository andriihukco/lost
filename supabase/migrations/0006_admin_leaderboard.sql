-- Admin player management, a leaderboard, and a "first to the place" event.

-- 1. "I found the place" is recorded server-side, so the leaderboard can count the first to the place.
alter table public.found_events drop constraint if exists found_events_action_check;
alter table public.found_events
  add constraint found_events_action_check check (action in ('place', 'found', 'unfound'));

-- A player marks the spot. One place event per player per treasure, and only while the treasure is on the map.
create or replace function public.mark_place(p_treasure_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from public.players where user_id = auth.uid()) then
    return jsonb_build_object('status', 'not_player');
  end if;
  if not exists (select 1 from public.treasures where id = p_treasure_id and is_found = false) then
    return jsonb_build_object('status', 'not_found');
  end if;
  if not exists (
    select 1 from public.found_events
    where treasure_id = p_treasure_id and user_id = auth.uid() and action = 'place'
  ) then
    insert into public.found_events (treasure_id, user_id, action)
    values (p_treasure_id, auth.uid(), 'place');
  end if;
  return jsonb_build_object('status', 'placed');
end $$;

-- 2. Leaderboard: every player's first-to-the-place count, first-to-the-treasure count and current finds.
-- Runs as the owner so it can count across players, but returns only counts and the public nickname and animal.
create or replace function public.leaderboard()
returns table (
  user_id uuid, nickname text, avatar text,
  first_places int, first_finds int, finds int
)
language sql stable security definer set search_path = public as $$
  with first_place as (
    select distinct on (treasure_id) treasure_id, user_id
    from public.found_events where action = 'place'
    order by treasure_id, created_at, id
  ),
  first_find as (
    select distinct on (treasure_id) treasure_id, user_id
    from public.found_events where action = 'found'
    order by treasure_id, created_at, id
  )
  select p.user_id, p.nickname, p.avatar,
    (select count(*)::int from first_place fp where fp.user_id = p.user_id),
    (select count(*)::int from first_find ff where ff.user_id = p.user_id),
    (select count(*)::int from public.treasures t where t.found_by = p.user_id and t.is_found)
  from public.players p;
$$;

-- 3. Admin: every player with their last logged position (nothing for players who never logged one).
create or replace function public.admin_players()
returns table (
  user_id uuid, nickname text, avatar text, created_at timestamptz,
  lat double precision, lng double precision, accuracy real, seen_at timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not an admin' using errcode = '42501'; end if;
  return query
  select p.user_id, p.nickname, p.avatar, p.created_at,
         l.lat, l.lng, l.accuracy, l.recorded_at
  from public.players p
  left join lateral (
    select x.lat, x.lng, x.accuracy, x.recorded_at
    from public.location_log x
    where x.user_id = p.user_id
    order by x.recorded_at desc
    limit 1
  ) l on true
  order by p.created_at;
end $$;

-- 4. Admin: remove a player. Their next visit asks for an animal again (the app signs them out).
create or replace function public.admin_remove_player(p_user_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not an admin' using errcode = '42501'; end if;
  delete from public.players where user_id = p_user_id;
  return found;
end $$;

revoke execute on function public.mark_place(uuid) from public, anon;
grant execute on function public.mark_place(uuid) to authenticated;
revoke execute on function public.leaderboard() from public, anon;
grant execute on function public.leaderboard() to authenticated;
revoke execute on function public.admin_players() from public, anon;
grant execute on function public.admin_players() to authenticated;
revoke execute on function public.admin_remove_player(uuid) from public, anon;
grant execute on function public.admin_remove_player(uuid) to authenticated;
