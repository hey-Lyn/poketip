-- Adds account roles (user/admin) to profiles.
-- Apply this in your Supabase project (SQL editor) after 0002_profiles.sql.

alter table public.profiles
  add column if not exists role text not null default 'user'
  check (role in ('user', 'admin'));

-- Browser sessions (anon/authenticated) can never grant themselves a role:
-- inserts are forced to 'user' and role changes are rejected. The service_role
-- key and the SQL editor (no JWT role) can still change roles.
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
    elsif new.role is distinct from old.role then
      raise exception 'ROLE_CHANGE_FORBIDDEN' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_profile_role on public.profiles;
create trigger guard_profile_role
  before insert or update on public.profiles
  for each row execute function public.guard_profile_role();

-- To promote the first admin, run this manually in the SQL editor:
--   update public.profiles set role = 'admin'
--   where id = (select id from auth.users where email = 'you@example.com');
