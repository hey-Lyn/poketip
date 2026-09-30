-- Per-user profile: avatar, bio, favorite Pokémon and AI credits.
-- Apply this in your Supabase project (SQL editor) after 0001_ai_usage.sql.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  bio text not null default '',
  favorite_pokemon_id integer,
  favorite_pokemon_name text,
  avatar_url text,
  credits integer not null default 30 check (credits >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Profiles are private: only the owner can read or change their own row.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Create the profile row whenever a new user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for accounts created before this migration.
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;

-- Atomically spend AI credits. Raises when the balance is too low.
create or replace function public.consume_ai_credit(p_user_id uuid, p_amount integer default 1)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  remaining integer;
begin
  update public.profiles
    set credits = credits - p_amount,
        updated_at = now()
    where id = p_user_id
      and credits >= p_amount
    returning credits into remaining;

  if remaining is null then
    raise exception 'INSUFFICIENT_CREDITS' using errcode = 'P0001';
  end if;

  return remaining;
end;
$$;

-- Public-read avatars bucket. Users may only write inside their own folder.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own" on storage.objects
  for update using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own" on storage.objects
  for delete using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
