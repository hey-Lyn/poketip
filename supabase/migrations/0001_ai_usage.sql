-- Tracks per-user daily AI request counts for the Pokétip rate limit.
-- Apply this in your Supabase project (SQL editor) before enabling the AI.

create table if not exists public.ai_usage (
  user_id uuid not null,
  usage_date date not null,
  request_count integer not null default 0,
  primary key (user_id, usage_date)
);

create or replace function public.increment_ai_usage(p_user_id uuid, p_date date)
returns integer
language sql
set search_path = public
as $$
  insert into public.ai_usage (user_id, usage_date, request_count)
  values (p_user_id, p_date, 1)
  on conflict (user_id, usage_date)
  do update set request_count = public.ai_usage.request_count + 1
  returning request_count;
$$;

-- Only the server touches this table, using the service_role key, which
-- bypasses RLS. Enabling RLS with no policies blocks the anon/authenticated
-- keys from reading or writing it.
alter table public.ai_usage enable row level security;
