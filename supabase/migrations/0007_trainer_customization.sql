-- Apply after 0006_social_profiles.sql. Profiles remain opt-in and owner-only.
begin;

create function public.valid_featured_team(team jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare member jsonb;
begin
  if jsonb_typeof(team) <> 'array' then return false; end if;
  if jsonb_array_length(team) > 6 then return false; end if;
  for member in select value from jsonb_array_elements(team) loop
    if jsonb_typeof(member) <> 'object'
      or jsonb_typeof(member->'id') is distinct from 'number'
      or (member->>'id') !~ '^[0-9]{1,6}$'
      or (member->>'id')::integer not between 1 and 100000
      or jsonb_typeof(member->'name') is distinct from 'string'
      or char_length(btrim(member->>'name')) not between 1 and 100
      or member - 'id' - 'name' <> '{}'::jsonb then return false; end if;
  end loop;
  return true;
end;
$$;

alter table public.profiles
  add column trainer_title text not null default '' check (char_length(trainer_title) <= 60),
  add column card_palette text not null default 'fairy' check (card_palette in ('fairy', 'water', 'grass', 'ghost', 'fire')),
  add column cover_style text not null default 'classic' check (cover_style in ('classic', 'forest', 'journey', 'arena')),
  add column cover_url text check (cover_url is null or (cover_url ~ '^https://' and char_length(cover_url) <= 2048)),
  add column favorite_game text not null default '' check (char_length(favorite_game) <= 80),
  add column featured_team jsonb not null default '[]'::jsonb check (public.valid_featured_team(featured_team));

grant insert (trainer_title, card_palette, cover_style, cover_url, favorite_game, featured_team) on public.profiles to authenticated;
grant update (trainer_title, card_palette, cover_style, cover_url, favorite_game, featured_team) on public.profiles to authenticated;

-- Changing the return shape requires recreating these functions. Permissions
-- are restored inside the transaction; no private account fields are returned.
drop function public.get_trainer_profile(text);
drop function public.search_trainers(text, integer, integer);

create function public.get_trainer_profile(p_username text)
returns table (
  id uuid, username text, display_name text, bio text,
  favorite_pokemon_id integer, favorite_pokemon_name text, avatar_url text, created_at timestamptz,
  trainer_title text, card_palette text, cover_style text, cover_url text, favorite_game text, featured_team jsonb
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  return query select p.id, p.username, p.display_name, p.bio,
    p.favorite_pokemon_id, p.favorite_pokemon_name, p.avatar_url, p.created_at,
    p.trainer_title, p.card_palette, p.cover_style, p.cover_url, p.favorite_game, p.featured_team
  from public.profiles p where p.social_enabled and p.username = lower(btrim(p_username));
end;
$$;

create function public.search_trainers(p_query text default '', p_offset integer default 0, p_limit integer default 21)
returns table (
  id uuid, username text, display_name text, bio text,
  favorite_pokemon_id integer, favorite_pokemon_name text, avatar_url text, created_at timestamptz,
  trainer_title text, card_palette text, cover_style text, cover_url text, favorite_game text, featured_team jsonb
)
language plpgsql stable security definer set search_path = '' as $$
declare search_query text := lower(btrim(coalesce(p_query, '')));
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if char_length(search_query) > 100 then raise exception 'SEARCH_TOO_LONG' using errcode = '22023'; end if;
  return query select p.id, p.username, p.display_name, p.bio,
    p.favorite_pokemon_id, p.favorite_pokemon_name, p.avatar_url, p.created_at,
    p.trainer_title, p.card_palette, p.cover_style, p.cover_url, p.favorite_game, p.featured_team
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
