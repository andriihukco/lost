-- Move a player's profile to another browser with a one-time code.
-- A browser's identity is its anonymous account, and another browser has another one. The code moves the profile
-- (nickname, animal, finds, find history and location log) from the old identity to the new one.

-- Codes are stored as a hash, never in clear text. Only the functions below touch these tables (RLS on, no policies).
create table public.transfer_codes (
  code_hash bytea primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  used boolean not null default false
);
alter table public.transfer_codes enable row level security;

-- Wrong codes are counted per browser, so a 6-digit code cannot be guessed by trying many.
create table public.transfer_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  tried_at timestamptz not null default now()
);
alter table public.transfer_attempts enable row level security;
create index transfer_attempts_user_time on public.transfer_attempts (user_id, tried_at);

-- A new code for the signed-in player. It replaces any earlier code and lasts 10 minutes.
create or replace function public.create_transfer_code()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  if auth.uid() is null or not exists (select 1 from public.players where user_id = auth.uid()) then
    return jsonb_build_object('status', 'not_player');
  end if;
  delete from public.transfer_codes where user_id = auth.uid();
  -- Six digits from a random uuid (gen_random_uuid is built in, so pgcrypto is not needed).
  v_code := lpad(((('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))::bit(32)::int & 2147483647) % 1000000)::text, 6, '0');
  insert into public.transfer_codes (code_hash, user_id, expires_at)
  values (sha256(convert_to(v_code, 'UTF8')), auth.uid(), now() + interval '10 minutes');
  return jsonb_build_object('status', 'ok', 'code', v_code, 'expires_in_s', 600);
end $$;

revoke execute on function public.create_transfer_code() from public, anon;
grant execute on function public.create_transfer_code() to authenticated;

-- Takes the profile behind a code into the signed-in browser. Only a browser without a profile can take one.
create or replace function public.claim_transfer(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_old uuid;
  v_nickname text;
  v_avatar text;
begin
  if v_me is null then
    return jsonb_build_object('status', 'not_signed_in');
  end if;
  if exists (select 1 from public.players where user_id = v_me) then
    return jsonb_build_object('status', 'already_player');
  end if;
  if (select count(*) from public.transfer_attempts where user_id = v_me and tried_at > now() - interval '10 minutes') >= 5 then
    return jsonb_build_object('status', 'too_many_attempts');
  end if;

  -- Lock the code so two browsers cannot use it at the same time.
  select user_id into v_old
    from public.transfer_codes
   where code_hash = sha256(convert_to(p_code, 'UTF8')) and used = false and expires_at > now()
   for update;
  if v_old is null then
    insert into public.transfer_attempts (user_id) values (v_me);
    return jsonb_build_object('status', 'bad_code');
  end if;
  if v_old = v_me then
    return jsonb_build_object('status', 'same_browser');
  end if;
  if not exists (select 1 from public.players where user_id = v_old) then
    return jsonb_build_object('status', 'no_profile');
  end if;

  update public.transfer_codes set used = true
   where code_hash = sha256(convert_to(p_code, 'UTF8'));
  update public.players set user_id = v_me
   where user_id = v_old
   returning nickname, avatar into v_nickname, v_avatar;
  update public.treasures set found_by = v_me where found_by = v_old;
  update public.found_events set user_id = v_me where user_id = v_old;
  update public.location_log set user_id = v_me where user_id = v_old;

  return jsonb_build_object('status', 'moved', 'nickname', v_nickname, 'avatar', v_avatar);
end $$;

revoke execute on function public.claim_transfer(text) from public, anon;
grant execute on function public.claim_transfer(text) to authenticated;
