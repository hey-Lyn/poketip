-- Apply after 0007_trainer_customization.sql.
begin;

alter table public.profiles
  add column card_frame_color text check (card_frame_color ~ '^#[0-9A-Fa-f]{6}$'),
  add column card_background_start text check (card_background_start ~ '^#[0-9A-Fa-f]{6}$'),
  add column card_background_end text check (card_background_end ~ '^#[0-9A-Fa-f]{6}$');

grant insert (card_frame_color, card_background_start, card_background_end) on public.profiles to authenticated;
grant update (card_frame_color, card_background_start, card_background_end) on public.profiles to authenticated;

drop function public.get_trainer_profile(text);
drop function public.search_trainers(text, integer, integer);

create function public.get_trainer_profile(p_username text)
returns table (
  id uuid, username text, display_name text, bio text,
  favorite_pokemon_id integer, favorite_pokemon_name text, avatar_url text, created_at timestamptz,
  trainer_title text, card_palette text, cover_style text, cover_url text, favorite_game text, featured_team jsonb,
  card_frame_color text, card_background_start text, card_background_end text
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  return query select p.id, p.username, p.display_name, p.bio,
    p.favorite_pokemon_id, p.favorite_pokemon_name, p.avatar_url, p.created_at,
    p.trainer_title, p.card_palette, p.cover_style, p.cover_url, p.favorite_game, p.featured_team,
    p.card_frame_color, p.card_background_start, p.card_background_end
  from public.profiles p where p.social_enabled and p.username = lower(btrim(p_username));
end;
$$;

create function public.search_trainers(p_query text default '', p_offset integer default 0, p_limit integer default 21)
returns table (
  id uuid, username text, display_name text, bio text,
  favorite_pokemon_id integer, favorite_pokemon_name text, avatar_url text, created_at timestamptz,
  trainer_title text, card_palette text, cover_style text, cover_url text, favorite_game text, featured_team jsonb,
  card_frame_color text, card_background_start text, card_background_end text
)
language plpgsql stable security definer set search_path = '' as $$
declare search_query text := lower(btrim(coalesce(p_query, '')));
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if char_length(search_query) > 100 then raise exception 'SEARCH_TOO_LONG' using errcode = '22023'; end if;
  return query select p.id, p.username, p.display_name, p.bio,
    p.favorite_pokemon_id, p.favorite_pokemon_name, p.avatar_url, p.created_at,
    p.trainer_title, p.card_palette, p.cover_style, p.cover_url, p.favorite_game, p.featured_team,
    p.card_frame_color, p.card_background_start, p.card_background_end
  from public.profiles p where p.social_enabled and (search_query = ''
    or strpos(p.username, search_query) > 0 or strpos(lower(p.display_name), search_query) > 0)
  order by p.username limit greatest(1, least(coalesce(p_limit, 21), 51)) offset greatest(0, coalesce(p_offset, 0));
end;
$$;

revoke all on function public.get_trainer_profile(text) from public, anon;
revoke all on function public.search_trainers(text, integer, integer) from public, anon;
grant execute on function public.get_trainer_profile(text) to authenticated;
grant execute on function public.search_trainers(text, integer, integer) to authenticated;
notify pgrst, 'reload schema';
commit;
