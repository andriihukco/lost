-- Sign out of a profile: the player's row is removed, so its animal is free for another player.
-- The player's finds stay on the map (found_by keeps the old identity). A browser without a profile gets a new one.
create or replace function public.release_profile()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return jsonb_build_object('status', 'not_signed_in');
  end if;
  delete from public.players where user_id = auth.uid();
  return jsonb_build_object('status', 'released');
end $$;

revoke execute on function public.release_profile() from public, anon;
grant execute on function public.release_profile() to authenticated;
