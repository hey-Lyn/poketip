-- Run as postgres after migrations 0001–0009. Fixtures and messages are rolled back.
begin;
create function pg_temp.assert_ok(condition boolean, description text)
returns void language plpgsql as $$ begin if condition is distinct from true then raise exception 'FAIL: %', description; end if; end; $$;
create function pg_temp.assert_fails(statement text, expected_state text)
returns void language plpgsql as $$ begin
  begin execute statement; exception when others then if sqlstate = expected_state then return; end if; raise; end;
  raise exception 'FAIL: expected % for %', expected_state, statement;
end; $$;
insert into auth.users(id, email) values
 ('f0000000-0000-0000-0000-000000000001', 'chat-one@example.invalid'),
 ('f0000000-0000-0000-0000-000000000002', 'chat-two@example.invalid'),
 ('f0000000-0000-0000-0000-000000000003', 'chat-third@example.invalid'),
 ('f0000000-0000-0000-0000-000000000004', 'chat-private@example.invalid');
update public.profiles set username = case id
 when 'f0000000-0000-0000-0000-000000000001' then 'chat_one'
 when 'f0000000-0000-0000-0000-000000000002' then 'chat_two'
 else 'chat_third' end, social_enabled = true
 where id in ('f0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000003');
set local role authenticated;
set local request.jwt.claims = '{"sub":"f0000000-0000-0000-0000-000000000001","role":"authenticated"}';
select pg_temp.assert_fails('select public.request_trainer_conversation(auth.uid())', 'P0001');
select pg_temp.assert_fails('select public.request_trainer_conversation(''f0000000-0000-0000-0000-000000000004'')', 'P0001');
select set_config('test.chat_id', public.request_trainer_conversation('f0000000-0000-0000-0000-000000000002')::text, true);
select pg_temp.assert_ok(public.request_trainer_conversation('f0000000-0000-0000-0000-000000000002') = current_setting('test.chat_id')::uuid, 'Request is idempotent');
select pg_temp.assert_fails('select public.send_trainer_message(current_setting(''test.chat_id'')::uuid, ''too early'')', '42501');
select pg_temp.assert_fails('select public.respond_trainer_conversation(current_setting(''test.chat_id'')::uuid, ''accept'')', '42501');
select pg_temp.assert_fails('update public.trainer_conversations set status = ''accepted''', '42501');
select pg_temp.assert_fails('insert into public.trainer_messages(conversation_id,sender_id,body) values(current_setting(''test.chat_id'')::uuid,auth.uid(),''bypass'')', '42501');
set local request.jwt.claims = '{"sub":"f0000000-0000-0000-0000-000000000002","role":"authenticated"}';
select pg_temp.assert_ok(public.request_trainer_conversation('f0000000-0000-0000-0000-000000000001') = current_setting('test.chat_id')::uuid, 'Opposite request does not bypass consent');
select pg_temp.assert_ok((select status = 'pending' from public.list_trainer_conversations()), 'Still pending');
select public.respond_trainer_conversation(current_setting('test.chat_id')::uuid, 'accept');
set local request.jwt.claims = '{"sub":"f0000000-0000-0000-0000-000000000001","role":"authenticated"}';
select public.send_trainer_message(current_setting('test.chat_id')::uuid, '  hello  ');
select pg_temp.assert_ok((select body = 'hello' from public.read_trainer_messages(current_setting('test.chat_id')::uuid)), 'Message round-trips and trims');
select pg_temp.assert_fails('select public.send_trainer_message(current_setting(''test.chat_id'')::uuid, '' '')', 'P0001');
select pg_temp.assert_fails('select public.send_trainer_message(current_setting(''test.chat_id'')::uuid, repeat(''x'',2001))', 'P0001');
set local request.jwt.claims = '{"sub":"f0000000-0000-0000-0000-000000000003","role":"authenticated"}';
select pg_temp.assert_ok((select count(*) = 0 from public.trainer_messages), 'Strangers cannot SELECT messages');
select pg_temp.assert_ok((select count(*) = 0 from public.trainer_conversations), 'Strangers cannot SELECT conversations');
select pg_temp.assert_fails('select * from public.read_trainer_messages(current_setting(''test.chat_id'')::uuid)', '42501');
select pg_temp.assert_fails('select public.send_trainer_message(current_setting(''test.chat_id'')::uuid, ''intruder'')', '42501');
select pg_temp.assert_fails('select public.respond_trainer_conversation(current_setting(''test.chat_id'')::uuid, ''block'')', '42501');
set local request.jwt.claims = '{"sub":"f0000000-0000-0000-0000-000000000002","role":"authenticated"}';
select pg_temp.assert_ok((select unread_count = 1 from public.list_trainer_conversations()), 'Recipient sees an unread message');
select public.mark_trainer_conversation_read(current_setting('test.chat_id')::uuid, (select id from public.read_trainer_messages(current_setting('test.chat_id')::uuid) limit 1));
select pg_temp.assert_ok((select unread_count = 0 from public.list_trainer_conversations()), 'Read receipt clears unread count');
update public.profiles set social_enabled = false where id = auth.uid();
set local request.jwt.claims = '{"sub":"f0000000-0000-0000-0000-000000000001","role":"authenticated"}';
select pg_temp.assert_fails('select public.send_trainer_message(current_setting(''test.chat_id'')::uuid, ''private recipient'')', 'P0001');
set local request.jwt.claims = '{"sub":"f0000000-0000-0000-0000-000000000002","role":"authenticated"}';
update public.profiles set social_enabled = true where id = auth.uid();
select public.respond_trainer_conversation(current_setting('test.chat_id')::uuid, 'block');
set local request.jwt.claims = '{"sub":"f0000000-0000-0000-0000-000000000001","role":"authenticated"}';
select pg_temp.assert_fails('select public.send_trainer_message(current_setting(''test.chat_id'')::uuid, ''blocked'')', '42501');
select pg_temp.assert_ok((select count(*) = 1 from public.read_trainer_messages(current_setting('test.chat_id')::uuid)), 'Blocking preserves history');
select pg_temp.assert_fails('select public.request_trainer_conversation(''f0000000-0000-0000-0000-000000000002'')', 'P0001');
select set_config('test.decline_id', public.request_trainer_conversation('f0000000-0000-0000-0000-000000000003')::text, true);
set local request.jwt.claims = '{"sub":"f0000000-0000-0000-0000-000000000003","role":"authenticated"}';
select public.respond_trainer_conversation(current_setting('test.decline_id')::uuid, 'decline');
set local request.jwt.claims = '{"sub":"f0000000-0000-0000-0000-000000000001","role":"authenticated"}';
select pg_temp.assert_fails('select public.send_trainer_message(current_setting(''test.decline_id'')::uuid, ''declined'')', '42501');
select pg_temp.assert_fails('select public.request_trainer_conversation(''f0000000-0000-0000-0000-000000000003'')', 'P0001');
set local request.jwt.claims = '{"sub":"f0000000-0000-0000-0000-000000000002","role":"authenticated"}';
select set_config('test.cancel_id', public.request_trainer_conversation('f0000000-0000-0000-0000-000000000003')::text, true);
select public.respond_trainer_conversation(current_setting('test.cancel_id')::uuid, 'cancel');
set local request.jwt.claims = '{"sub":"f0000000-0000-0000-0000-000000000003","role":"authenticated"}';
select pg_temp.assert_fails('select public.respond_trainer_conversation(current_setting(''test.cancel_id'')::uuid, ''accept'')', '42501');
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select pg_temp.assert_fails('select * from public.list_trainer_conversations()', '42501');
select pg_temp.assert_fails('select * from public.trainer_messages', '42501');
rollback;
