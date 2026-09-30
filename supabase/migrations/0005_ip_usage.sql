-- Tracks per-IP daily AI request counts, so many accounts created from the same
-- network cannot bypass the per-user limit. Apply after 0004_profile_security.sql.

create table if not exists public.ai_ip_usage (
  ip text not null,
  usage_date date not null,
  request_count integer not null default 0,
  primary key (ip, usage_date)
);

create or replace function public.increment_ip_usage(p_ip text, p_date date)
returns integer
language sql
set search_path = public
as $$
  insert into public.ai_ip_usage (ip, usage_date, request_count)
  values (p_ip, p_date, 1)
  on conflict (ip, usage_date)
  do update set request_count = public.ai_ip_usage.request_count + 1
  returning request_count;
$$;

-- Only the server touches this table, using the service_role key, which
-- bypasses RLS. Enabling RLS with no policies blocks the anon/authenticated
-- keys from reading or writing it.
alter table public.ai_ip_usage enable row level security;

revoke execute on function public.increment_ip_usage(text, date)
  from public, anon, authenticated;
grant execute on function public.increment_ip_usage(text, date) to service_role;
