-- Location trail, found history, and undo for a mistaken "found".

-- Every logged position of a player (throttled in the client: 10 m or 30 s).
create table public.location_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  accuracy real,
  recorded_at timestamptz not null default now()
);
create index location_log_user_time on public.location_log (user_id, recorded_at);

-- Found / unfound history, one row per action.
create table public.found_events (
  id bigint generated always as identity primary key,
  treasure_id uuid not null references public.treasures(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('found', 'unfound')),
  manual boolean not null default false,
  note text,
  created_at timestamptz not null default now()
);
create index found_events_treasure on public.found_events (treasure_id, created_at);

alter table public.location_log enable row level security;
alter table public.found_events enable row level security;

create policy location_insert_self on public.location_log for insert to authenticated
  with check (user_id = auth.uid());
create policy location_select_self_or_admin on public.location_log for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy found_events_select_all on public.found_events for select to authenticated
  using (true);
-- found_events rows are written only by the RPCs below (security definer).

-- mark_found now also records the event.
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

  insert into public.found_events (treasure_id, user_id, action, manual, note)
  values (p_treasure_id, auth.uid(), 'found', p_manual_note is not null, p_manual_note);

  return jsonb_build_object('status', 'won', 'found_by', v_by);
end $$;

-- Undo a mistaken "found": only the finder (or an admin) may send the treasure back to the map.
create or replace function public.unmark_found(p_treasure_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_row public.treasures;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into v_row from public.treasures where id = p_treasure_id for update;
  if not found then return jsonb_build_object('status', 'not_found'); end if;
  if not v_row.is_found then return jsonb_build_object('status', 'not_found_state'); end if;
  if v_row.found_by is distinct from auth.uid() and not public.is_admin() then
    return jsonb_build_object('status', 'not_yours');
  end if;

  update public.treasures
     set is_found = false, found_by = null, found_at = null, found_manual = false, found_note = null
   where id = p_treasure_id;

  insert into public.found_events (treasure_id, user_id, action)
  values (p_treasure_id, auth.uid(), 'unfound');

  return jsonb_build_object('status', 'unfound');
end $$;

revoke execute on function public.unmark_found(uuid) from public, anon;
grant execute on function public.unmark_found(uuid) to authenticated;
