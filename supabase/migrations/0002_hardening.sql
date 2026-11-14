-- Review fixes (2026-11-14): F3 last-treasure race, F4 participant writes, F5 photo storage.

-- F3: lock the room row before counting unfound treasures, so two last-treasure claims
-- on different rows cannot both see the other as still unfound (READ COMMITTED).
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

  perform 1 from public.rooms where id = v_room for update;

  select count(*) into v_remaining from public.treasures
   where room_id = v_room and is_found = false;
  if v_remaining = 0 then
    update public.rooms set status = 'finished' where id = v_room;
  end if;

  return jsonb_build_object('status', 'won', 'found_by', v_by);
end $$;

-- F4: joining is one RPC that checks the code and inserts the participant row.
-- The direct insert policy goes: a room UUID alone no longer grants membership.
drop policy if exists participants_insert_self on public.participants;

create or replace function public.join_room_as(p_code text, p_nickname text, p_color text)
returns setof public.rooms language plpgsql security definer set search_path = public as $$
declare v_room public.rooms;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into v_room from public.rooms where code = lower(p_code);
  if not found then return; end if;
  insert into public.participants (room_id, user_id, nickname, color)
  values (v_room.id, auth.uid(), p_nickname, p_color)
  on conflict (room_id, user_id)
    do update set nickname = excluded.nickname, color = excluded.color;
  return next v_room;
end $$;

revoke execute on function public.join_room_as(text, text, text) from public, anon;
grant execute on function public.join_room_as(text, text, text) to authenticated;

-- A participant may rename or recolour, but never move to another room or user.
create or replace function public.forbid_participant_identity_change()
returns trigger language plpgsql as $$
begin
  if new.room_id is distinct from old.room_id or new.user_id is distinct from old.user_id then
    raise exception 'participant room and user are fixed';
  end if;
  return new;
end $$;

create trigger participants_identity_fixed
  before update on public.participants
  for each row execute function public.forbid_participant_identity_change();

-- F5: photos are compressed to <=1200 px WebP/JPEG (a few hundred KB); cap the bucket at 5 MB
-- and only those two types. The host may delete (used when a treasure save rolls back).
update storage.buckets
   set file_size_limit = 5242880,
       allowed_mime_types = array['image/webp', 'image/jpeg']
 where id = 'treasure-photos';

create policy photos_delete_host on storage.objects for delete to authenticated
  using (bucket_id = 'treasure-photos'
         and public.is_room_host(((storage.foldername(name))[1])::uuid));
