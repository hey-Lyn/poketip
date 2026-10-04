-- Run as postgres after migrations 0001–0007. All fixtures are rolled back.
begin;
create function pg_temp.assert_ok(condition boolean, description text)
returns void language plpgsql as $$
begin if condition is distinct from true then raise exception 'FAIL: %', description; end if; end;
$$;
create function pg_temp.assert_fails(statement text, expected_state text)
returns void language plpgsql as $$
begin
  begin execute statement;
  exception when others then if sqlstate = expected_state then return; end if; raise; end;
  raise exception 'FAIL: expected %', expected_state;
end;
$$;
insert into auth.users (id, email) values
  ('e0000000-0000-0000-0000-000000000001', 'custom-one@example.invalid'),
  ('e0000000-0000-0000-0000-000000000002', 'custom-two@example.invalid');
set local role authenticated;
set local request.jwt.claims = '{"sub":"e0000000-0000-0000-0000-000000000001","role":"authenticated"}';
update public.profiles set username = 'custom_one', social_enabled = true,
  trainer_title = 'Water specialist', card_palette = 'water', cover_style = 'forest',
  favorite_game = 'Pokémon Emerald', featured_team = '[{"id":25,"name":"pikachu"}]'::jsonb
where id = auth.uid();
select pg_temp.assert_ok((select trainer_title = 'Water specialist' and favorite_game = 'Pokémon Emerald'
  and featured_team = '[{"id":25,"name":"pikachu"}]'::jsonb from public.get_trainer_profile('custom_one')), 'Customized public profile round-trips');
select pg_temp.assert_ok((select card_palette = 'water' and cover_style = 'forest'
  from public.search_trainers('custom_one')), 'Directory returns customization');
select pg_temp.assert_ok((select not (to_jsonb(p) ?| array['credits', 'role', 'email'])
  from public.get_trainer_profile('custom_one') p), 'Private fields stay private');
select pg_temp.assert_fails('update public.profiles set trainer_title = repeat(''x'', 61)', '23514');
select pg_temp.assert_fails('update public.profiles set card_palette = ''invalid''', '23514');
select pg_temp.assert_fails('update public.profiles set cover_url = ''javascript:alert(1)''', '23514');
select pg_temp.assert_fails('update public.profiles set favorite_game = repeat(''x'', 81)', '23514');
select pg_temp.assert_fails('update public.profiles set featured_team = ''{}''::jsonb', '23514');
select pg_temp.assert_fails('update public.profiles set featured_team = ''[{"id":0,"name":"bad"}]''::jsonb', '23514');
select pg_temp.assert_fails('update public.profiles set featured_team = ''[{"id":25,"name":"pikachu","moves":[]}]''::jsonb', '23514');
select pg_temp.assert_fails('update public.profiles set featured_team = (select jsonb_agg(jsonb_build_object(''id'', 25, ''name'', ''pikachu'')) from generate_series(1,7))', '23514');
set local request.jwt.claims = '{"sub":"e0000000-0000-0000-0000-000000000002","role":"authenticated"}';
update public.profiles set trainer_title = 'Stolen' where username = 'custom_one';
select pg_temp.assert_ok((select trainer_title = 'Water specialist' from public.get_trainer_profile('custom_one')), 'Other users cannot change customization');
select pg_temp.assert_ok((select count(*) = 1 from public.profiles), 'Raw profiles remain owner-only');
set local request.jwt.claims = '{"sub":"e0000000-0000-0000-0000-000000000001","role":"authenticated"}';
update public.profiles set social_enabled = false where id = auth.uid();
select pg_temp.assert_ok((select count(*) = 0 from public.get_trainer_profile('custom_one')), 'Private customization is not exposed');
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select pg_temp.assert_fails('select * from public.get_trainer_profile(''custom_one'')', '42501');
rollback;
