-- Pin emoji per treasure (admin chooses it), and one animal per player.

alter table public.treasures
  add column pin_emoji text not null default '🍄'
  check (char_length(pin_emoji) between 1 and 8);

-- An animal already taken by another player cannot be chosen again.
-- Checked on insert and when the avatar changes; existing rows are not touched.
create or replace function public.forbid_taken_avatar()
returns trigger language plpgsql as $$
begin
  if exists (
    select 1 from public.players p
    where p.avatar = new.avatar and p.user_id <> new.user_id
  ) then
    raise exception 'avatar taken' using errcode = '23505';
  end if;
  return new;
end $$;

create trigger players_avatar_unique
  before insert or update of avatar on public.players
  for each row execute function public.forbid_taken_avatar();
