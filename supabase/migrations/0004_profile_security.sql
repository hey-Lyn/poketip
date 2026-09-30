-- Hardens profile writes and the AI usage RPCs so browser sessions can never
-- grant themselves credits. Apply in the Supabase SQL editor after 0003_roles.sql.

-- Starting balance for new profiles.
alter table public.profiles alter column credits set default 30;

-- Table-level INSERT/UPDATE is revoked because a table-level grant overrides
-- column-level revokes. Browser sessions get back only the columns they own.
revoke insert, update on public.profiles from anon, authenticated;

grant insert (
  id, display_name, bio, favorite_pokemon_id, favorite_pokemon_name,
  avatar_url, updated_at
) on public.profiles to authenticated;

grant update (
  display_name, bio, favorite_pokemon_id, favorite_pokemon_name,
  avatar_url, updated_at
) on public.profiles to authenticated;

-- Extends the role guard so browser sessions also cannot change credits.
-- handle_new_user and consume_ai_credit run as security definer (role is not
-- anon/authenticated), so they are not affected.
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.role := 'user';
      new.credits := 30;
    elsif new.role is distinct from old.role then
      raise exception 'ROLE_CHANGE_FORBIDDEN' using errcode = 'P0001';
    elsif new.credits is distinct from old.credits then
      raise exception 'CREDIT_CHANGE_FORBIDDEN' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

-- The AI usage RPCs are server-only. execute defaults to PUBLIC in postgres,
-- which let any signed-in user call consume_ai_credit with a negative amount.
revoke execute on function public.consume_ai_credit(uuid, integer)
  from public, anon, authenticated;
revoke execute on function public.increment_ai_usage(uuid, date)
  from public, anon, authenticated;

grant execute on function public.consume_ai_credit(uuid, integer) to service_role;
grant execute on function public.increment_ai_usage(uuid, date) to service_role;
