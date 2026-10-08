-- Run as postgres after the trainer_calls migration. Fixtures are rolled back.
begin;
create function pg_temp.assert_ok(condition boolean, description text)
returns void language plpgsql as $$ begin if condition is distinct from true then raise exception 'FAIL: %', description; end if; end; $$;
create function pg_temp.assert_error(statement text, expected text)
returns void language plpgsql as $$ begin
  begin execute statement;
  exception when others then
    if strpos(sqlerrm, expected) > 0 then return; end if;
    raise exception 'FAIL: expected %, got %', expected, sqlerrm;
  end;
  raise exception 'FAIL: expected rejection % for %', expected, statement;
end; $$;

insert into auth.users(id, email) values
 ('e0000000-0000-0000-0000-000000000001', 'call-one@example.invalid'),
 ('e0000000-0000-0000-0000-000000000002', 'call-two@example.invalid'),
 ('e0000000-0000-0000-0000-000000000003', 'call-three@example.invalid'),
 ('e0000000-0000-0000-0000-000000000004', 'call-private@example.invalid');
update public.profiles set username = 'call_' || right(id::text, 2), social_enabled = id <> 'e0000000-0000-0000-0000-000000000004'
  where id in ('e0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002',
    'e0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000004');
insert into public.trainer_conversations(id, initiator_id, recipient_id, status) values
 ('e1000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', 'accepted'),
 ('e1000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000002', 'accepted'),
 ('e1000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000004', 'accepted'),
 ('e1000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000003', 'pending');

select pg_temp.assert_ok((select relrowsecurity from pg_class where oid = 'public.trainer_calls'::regclass), 'Calls table enables RLS');
select pg_temp.assert_ok(not has_table_privilege('authenticated', 'public.trainer_calls', 'INSERT,UPDATE,DELETE'), 'Browser users have no direct mutation grants');
select pg_temp.assert_ok(not has_function_privilege('authenticated', 'private.refresh_trainer_calls(uuid[])', 'EXECUTE'), 'Internal refresh cannot be called by browser users');
select pg_temp.assert_ok(not has_function_privilege('anon', 'public.start_trainer_call(uuid,text)', 'EXECUTE'), 'Anonymous calls are disabled');
select pg_temp.assert_ok((select not prosecdef from pg_proc where oid = 'public.start_trainer_call(uuid,text)'::regprocedure), 'Public call RPC is SECURITY INVOKER');

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated"}';
select pg_temp.assert_error('select public.list_trainer_calls()', 'AUTH_REQUIRED');
set local request.jwt.claims = '{"sub":"e0000000-0000-0000-0000-000000000001","role":"authenticated"}';
select pg_temp.assert_error('select public.start_trainer_call(''e1000000-0000-0000-0000-000000000001'', ''screen'')', 'INVALID_CALL_MODE');
select pg_temp.assert_error('select public.start_trainer_call(''e1000000-0000-0000-0000-000000000003'', ''audio'')', 'PROFILE_UNAVAILABLE');
select pg_temp.assert_error('select public.start_trainer_call(''e1000000-0000-0000-0000-000000000004'', ''audio'')', 'CONVERSATION_UNAVAILABLE');
select pg_temp.assert_ok((public.start_trainer_call('e1000000-0000-0000-0000-000000000001', 'video')).status = 'ringing', 'A participant can ring an accepted conversation');
select pg_temp.assert_ok((select expires_at between created_at + interval '44 seconds' and created_at + interval '46 seconds'
  from public.trainer_calls where status = 'ringing'), 'Ringing expires after 45 seconds');
select pg_temp.assert_error('select public.start_trainer_call(''e1000000-0000-0000-0000-000000000001'', ''audio'')', 'CALL_BUSY');
select pg_temp.assert_error('select public.respond_trainer_call((select id from public.trainer_calls where status = ''ringing''), ''accept'')', 'INVALID_CALL_ACTION');
select pg_temp.assert_error('update public.trainer_calls set status = ''accepted''', 'permission denied');

set local request.jwt.claims = '{"sub":"e0000000-0000-0000-0000-000000000003","role":"authenticated"}';
select pg_temp.assert_ok((select count(*) = 0 from public.trainer_calls), 'Unrelated trainers cannot SELECT another call');
select pg_temp.assert_ok((select count(*) = 0 from public.list_trainer_calls()), 'Unrelated trainers cannot list another call');
select pg_temp.assert_error('select public.start_trainer_call(''e1000000-0000-0000-0000-000000000002'', ''audio'')', 'CALL_BUSY');
select pg_temp.assert_error('select public.start_trainer_call(''e1000000-0000-0000-0000-000000000001'', ''audio'')', 'CONVERSATION_UNAVAILABLE');

set local request.jwt.claims = '{"sub":"e0000000-0000-0000-0000-000000000002","role":"authenticated"}';
select pg_temp.assert_ok((public.respond_trainer_call((select id from public.trainer_calls where status = 'ringing'), 'accept')).status = 'accepted', 'Only the callee can accept');
select pg_temp.assert_ok((select accepted_at is not null and caller_heartbeat_at is not null and callee_heartbeat_at is not null
  and expires_at between accepted_at + interval '89 seconds' and accepted_at + interval '91 seconds'
  from public.trainer_calls where status = 'accepted'), 'Acceptance initializes both heartbeats and a 90 second lease');
select public.heartbeat_trainer_call((select id from public.trainer_calls where status = 'accepted'));
select pg_temp.assert_ok((select expires_at - least(caller_heartbeat_at, callee_heartbeat_at) = interval '90 seconds'
  from public.trainer_calls where status = 'accepted'), 'One participant heartbeat cannot extend the absent peer lease');

-- Store the first UUID for adversarial RPC checks without granting fixture-table access.
select set_config('call_test.first_id', (select id::text from public.trainer_calls where status = 'accepted'), true);
set local request.jwt.claims = '{"sub":"e0000000-0000-0000-0000-000000000003","role":"authenticated"}';
select pg_temp.assert_error('select public.respond_trainer_call(current_setting(''call_test.first_id'')::uuid, ''end'')', 'CALL_UNAVAILABLE');
select pg_temp.assert_error('select public.heartbeat_trainer_call(current_setting(''call_test.first_id'')::uuid)', 'CALL_UNAVAILABLE');

set local request.jwt.claims = '{"sub":"e0000000-0000-0000-0000-000000000001","role":"authenticated"}';
select public.respond_trainer_conversation('e1000000-0000-0000-0000-000000000001', 'block');
select pg_temp.assert_ok((select status = 'ended' and ended_at is not null from public.trainer_calls where id = current_setting('call_test.first_id')::uuid), 'Blocking immediately ends an accepted call');
select pg_temp.assert_ok((public.respond_trainer_call(current_setting('call_test.first_id')::uuid, 'end')).status = 'ended', 'Duplicate hang-ups are idempotent');
select pg_temp.assert_error('select public.start_trainer_call(''e1000000-0000-0000-0000-000000000001'', ''audio'')', 'CONVERSATION_UNAVAILABLE');

reset role;
update public.trainer_conversations set status = 'accepted', blocked_by = null where id = 'e1000000-0000-0000-0000-000000000001';
set local role authenticated;
set local request.jwt.claims = '{"sub":"e0000000-0000-0000-0000-000000000001","role":"authenticated"}';
select public.start_trainer_call('e1000000-0000-0000-0000-000000000001', 'audio');
set local request.jwt.claims = '{"sub":"e0000000-0000-0000-0000-000000000002","role":"authenticated"}';
select pg_temp.assert_ok((public.respond_trainer_call((select id from public.trainer_calls where status = 'ringing'), 'decline')).status = 'declined', 'Callee can decline');
set local request.jwt.claims = '{"sub":"e0000000-0000-0000-0000-000000000001","role":"authenticated"}';
select public.start_trainer_call('e1000000-0000-0000-0000-000000000001', 'audio');
select pg_temp.assert_ok((public.respond_trainer_call((select id from public.trainer_calls where status = 'ringing'), 'cancel')).status = 'canceled', 'Caller can cancel');
select public.start_trainer_call('e1000000-0000-0000-0000-000000000001', 'audio');
reset role;
update public.profiles set social_enabled = false where id = 'e0000000-0000-0000-0000-000000000002';
select pg_temp.assert_ok((select count(*) = 0 from public.trainer_calls where status in ('ringing', 'accepted')), 'Disabling a social profile ends its active calls');
update public.profiles set social_enabled = true where id = 'e0000000-0000-0000-0000-000000000002';

-- Expiry fixtures simulate a vanished client without wall-clock waits.
insert into public.trainer_calls(id, conversation_id, caller_id, callee_id, mode, status, created_at, expires_at) values
 ('e3000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', 'audio', 'ringing', clock_timestamp() - interval '2 minutes', clock_timestamp() - interval '1 minute');
set local role authenticated;
set local request.jwt.claims = '{"sub":"e0000000-0000-0000-0000-000000000002","role":"authenticated"}';
select pg_temp.assert_ok((public.respond_trainer_call('e3000000-0000-0000-0000-000000000001', 'accept')).status = 'missed', 'Expired ringing calls cannot be accepted');
reset role;
insert into public.trainer_calls(id, conversation_id, caller_id, callee_id, mode, status, created_at, expires_at, accepted_at, caller_heartbeat_at, callee_heartbeat_at) values
 ('e3000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', 'video', 'accepted', clock_timestamp() - interval '3 minutes', clock_timestamp() - interval '1 minute', clock_timestamp() - interval '3 minutes', clock_timestamp() - interval '150 seconds', clock_timestamp() - interval '150 seconds');
set local role authenticated;
select public.list_trainer_calls();
select pg_temp.assert_ok((select status = 'ended' from public.trainer_calls where id = 'e3000000-0000-0000-0000-000000000002'), 'Listing closes accepted calls with expired heartbeats');
select public.heartbeat_trainer_call('e3000000-0000-0000-0000-000000000002');
select pg_temp.assert_ok((select status = 'ended' from public.trainer_calls where id = 'e3000000-0000-0000-0000-000000000002'), 'Heartbeat cannot resurrect an ended call');

set local request.jwt.claims = '{"sub":"e0000000-0000-0000-0000-000000000001","role":"authenticated"}';
select public.start_trainer_call('e1000000-0000-0000-0000-000000000001', 'audio');
select public.respond_trainer_call((select id from public.trainer_calls where status = 'ringing'), 'cancel');
select pg_temp.assert_error('select public.start_trainer_call(''e1000000-0000-0000-0000-000000000001'', ''video'')', 'CALL_RATE_LIMIT');
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select pg_temp.assert_error('select public.list_trainer_calls()', 'permission denied');
select pg_temp.assert_error('select * from public.trainer_calls', 'permission denied');
rollback;
