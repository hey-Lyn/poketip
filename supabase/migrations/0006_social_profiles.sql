-- Opt-in trainer profiles. Apply after 0005_ip_usage.sql, before deploying
-- the trainer directory. Existing profiles remain private until enabled.
begin;

alter table public.profiles
  add column username text,
  add column social_enabled boolean not null default false,
  add constraint profiles_username_format check (
    username is null or username ~ '^[a-z0-9][a-z0-9_]{2,23}$'
  ),
  add constraint profiles_social_requires_username check (
    not social_enabled or username is not null
  );

create unique index profiles_username_unique on public.profiles (username)
  where username is not null;

grant insert (username, social_enabled) on public.profiles to authenticated;
grant update (username, social_enabled) on public.profiles to authenticated;

-- Keep owner-only RLS and the protected credit/role grants unchanged. These
-- narrowly scoped functions intentionally bypass owner-only SELECT policies,
-- returning only social fields from opted-in profiles to signed-in callers.
create function public.get_trainer_profile(p_username text)
returns table (
  id uuid, username text, display_name text, bio text,
  favorite_pokemon_id integer, favorite_pokemon_name text,
  avatar_url text, created_at timestamptz
)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  return query
    select p.id, p.username, p.display_name, p.bio,
      p.favorite_pokemon_id, p.favorite_pokemon_name, p.avatar_url, p.created_at
    from public.profiles p
    where p.social_enabled
      and p.username = lower(btrim(p_username));
end;
$$;

create function public.search_trainers(
  p_query text default '', p_offset integer default 0, p_limit integer default 21
)
returns table (
  id uuid, username text, display_name text, bio text,
  favorite_pokemon_id integer, favorite_pokemon_name text,
  avatar_url text, created_at timestamptz
)
language plpgsql stable security definer
set search_path = ''
as $$
declare
  search_query text := lower(btrim(coalesce(p_query, '')));
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if char_length(search_query) > 100 then
    raise exception 'SEARCH_TOO_LONG' using errcode = '22023';
  end if;

  return query
    select p.id, p.username, p.display_name, p.bio,
      p.favorite_pokemon_id, p.favorite_pokemon_name, p.avatar_url, p.created_at
    from public.profiles p
    where p.social_enabled
      and (search_query = ''
        or strpos(p.username, search_query) > 0
        or strpos(lower(p.display_name), search_query) > 0)
    order by p.username
    limit greatest(1, least(coalesce(p_limit, 21), 51))
    offset greatest(0, coalesce(p_offset, 0));
end;
$$;

revoke all on function public.get_trainer_profile(text) from public, anon;
revoke all on function public.search_trainers(text, integer, integer) from public, anon;
grant execute on function public.get_trainer_profile(text) to authenticated;
grant execute on function public.search_trainers(text, integer, integer) to authenticated;

commit;
