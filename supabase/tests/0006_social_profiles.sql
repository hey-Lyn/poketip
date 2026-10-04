-- Run as postgres against a local/disposable database after migrations 0001–0006.
-- All fixtures and assertions are rolled back. No pgTAP extension is needed.
begin;
create temporary table social_test_context (id integer);

create function pg_temp.assert_ok(condition boolean, description text)
returns void language plpgsql as $$
begin
  if condition is distinct from true then raise exception 'FAIL: %', description; end if;
end;
$$;

create function pg_temp.assert_fails(statement text, expected_state text)
returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if sqlstate = expected_state then return; end if;
    raise;
  end;
  raise exception 'FAIL: expected % for %', expected_state, statement;
end;
$$;

insert into auth.users (id, email) values
  ('f0000000-0000-0000-0000-000000000001', 'social-ash@example.invalid'),
  ('f0000000-0000-0000-0000-000000000002', 'social-bob@example.invalid'),
  ('f0000000-0000-0000-0000-000000000003', 'social-private@example.invalid');

select pg_temp.assert_ok(
  (select count(*) = 3 from public.profiles where id::text like 'f0000000-%' and not social_enabled and username is null),
  'New profiles are private and no email-derived username is generated'
);

update public.profiles set username = 'ash_ketchum', display_name = 'Ash', social_enabled = true
  where id = 'f0000000-0000-0000-0000-000000000001';
update public.profiles set username = 'bob', display_name = '100% Trainer', social_enabled = true
  where id = 'f0000000-0000-0000-0000-000000000002';

set local role authenticated;
set local request.jwt.claims = '{"sub":"f0000000-0000-0000-0000-000000000003","role":"authenticated"}';

select pg_temp.assert_ok(
  (select count(*) = 1 from public.profiles),
  'Raw profiles still have owner-only SELECT RLS'
);
select pg_temp.assert_ok(
  (select count(*) = 2 from public.search_trainers()),
  'Signed-in trainers can discover opted-in profiles'
);
select pg_temp.assert_ok(
  (select count(*) = 0 from public.get_trainer_profile('private')),
  'Missing usernames return no profile'
);
select pg_temp.assert_ok(
  (select username = 'ash_ketchum' from public.get_trainer_profile(' ASH_KETCHUM ')),
  'Direct lookup normalizes case and whitespace'
);
select pg_temp.assert_ok(
  (select not (to_jsonb(p) ?| array['email', 'credits', 'role', 'social_enabled', 'updated_at'])
    from public.get_trainer_profile('ash_ketchum') p),
  'Direct lookup exposes only social fields'
);
select pg_temp.assert_ok(
  (select bool_and(not (to_jsonb(p) ?| array['email', 'credits', 'role', 'social_enabled', 'updated_at']))
    from public.search_trainers() p),
  'Directory exposes only social fields'
);
select pg_temp.assert_ok(
  (select count(*) = 1 from public.search_trainers('ASH')),
  'Search is case-insensitive'
);
select pg_temp.assert_ok(
  (select count(*) = 1 from public.search_trainers('%')),
  'Percent is searched literally, not as a wildcard'
);
select pg_temp.assert_ok(
  (select count(*) = 1 from public.search_trainers('_')),
  'Underscore is searched literally, not as a wildcard'
);
select pg_temp.assert_ok(
  (select username = 'bob' from public.search_trainers('', 1, 1)),
  'Paging uses a stable username order'
);

select pg_temp.assert_fails(
  'update public.profiles set username = ''ash_ketchum'' where id = ''f0000000-0000-0000-0000-000000000003''', '23505'
);
select pg_temp.assert_fails(
  'update public.profiles set social_enabled = true where id = ''f0000000-0000-0000-0000-000000000003''', '23514'
);
select pg_temp.assert_fails(
  'update public.profiles set username = ''ASH'' where id = ''f0000000-0000-0000-0000-000000000003''', '23514'
);
select pg_temp.assert_fails(
  'update public.profiles set username = ''_ash'' where id = ''f0000000-0000-0000-0000-000000000003''', '23514'
);
select pg_temp.assert_fails('update public.profiles set credits = 999', '42501');
select pg_temp.assert_fails('update public.profiles set role = ''admin''', '42501');

-- Direct writes to someone else's profile cannot publish or rename it.
update public.profiles set username = 'stolen' where id = 'f0000000-0000-0000-0000-000000000001';
select pg_temp.assert_ok(
  (select count(*) = 1 from public.get_trainer_profile('ash_ketchum')),
  'Owner-only UPDATE RLS is preserved'
);

update public.profiles set username = 'private_trainer' where id = auth.uid();
select pg_temp.assert_ok(
  (select count(*) = 0 from public.get_trainer_profile('private_trainer')),
  'Knowing a private username does not reveal the profile'
);
update public.profiles set social_enabled = true where id = auth.uid();
select pg_temp.assert_ok(
  (select count(*) = 1 from public.get_trainer_profile('private_trainer')),
  'Owner can opt in with a valid username'
);
update public.profiles set social_enabled = false where id = auth.uid();
select pg_temp.assert_ok(
  (select count(*) = 0 from public.search_trainers('private_trainer')),
  'Disabling sharing removes the profile from searches'
);
select pg_temp.assert_ok(
  (select username = 'private_trainer' from public.profiles where id = auth.uid()),
  'Disabling sharing keeps the username reserved'
);

-- Execute permission alone is insufficient without a signed-in identity.
set local request.jwt.claims = '{"role":"authenticated"}';
select pg_temp.assert_fails('select * from public.search_trainers()', '42501');
select pg_temp.assert_fails('select * from public.get_trainer_profile(''ash_ketchum'')', '42501');

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select pg_temp.assert_fails('select * from public.search_trainers()', '42501');
select pg_temp.assert_fails('select * from public.get_trainer_profile(''ash_ketchum'')', '42501');

rollback;
