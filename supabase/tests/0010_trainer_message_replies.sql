-- Run as postgres after 0010. All fixtures are rolled back.
begin;
create function pg_temp.assert_ok(condition boolean, description text)
returns void language plpgsql as $$ begin if condition is distinct from true then raise exception 'FAIL: %', description; end if; end; $$;
create function pg_temp.assert_denied(statement text)
returns void language plpgsql as $$ begin
  begin execute statement; exception when insufficient_privilege then return; end;
  raise exception 'FAIL: expected authorization rejection for %', statement;
end; $$;
insert into auth.users(id, email) values
 ('d0000000-0000-0000-0000-000000000001', 'reply-one@example.invalid'),
 ('d0000000-0000-0000-0000-000000000002', 'reply-two@example.invalid'),
 ('d0000000-0000-0000-0000-000000000003', 'reply-third@example.invalid');
update public.profiles set username = 'reply_' || right(id::text, 1), social_enabled = true
  where id in ('d0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000003');
insert into public.trainer_conversations(id, initiator_id, recipient_id, status) values
 ('d1000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'accepted'),
 ('d1000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'accepted');
insert into public.trainer_messages(id, conversation_id, sender_id, body) values
 ('d2000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'Original message'),
 ('d2000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000003', 'Another conversation');
set local role authenticated;
set local request.jwt.claims = '{"sub":"d0000000-0000-0000-0000-000000000001","role":"authenticated"}';
select set_config('test.reply_id', (public.reply_to_trainer_message('d1000000-0000-0000-0000-000000000001', 'Answer', 'd2000000-0000-0000-0000-000000000001')).id::text, true);
select pg_temp.assert_ok((select reply_to_message_id = 'd2000000-0000-0000-0000-000000000001'
  from public.read_trainer_messages('d1000000-0000-0000-0000-000000000001') where id = current_setting('test.reply_id')::uuid), 'Reply reference round-trips');
select pg_temp.assert_ok((select body = 'Original message' from public.read_trainer_reply_contexts(
  'd1000000-0000-0000-0000-000000000001', array[current_setting('test.reply_id')::uuid])), 'Original context is available outside the loaded page');
select pg_temp.assert_denied('select public.reply_to_trainer_message(''d1000000-0000-0000-0000-000000000001'', ''Wrong conversation'', ''d2000000-0000-0000-0000-000000000002'')');
select pg_temp.assert_denied('update public.trainer_messages set reply_to_message_id = ''d2000000-0000-0000-0000-000000000002''');
select public.respond_trainer_conversation('d1000000-0000-0000-0000-000000000001', 'block');
select pg_temp.assert_denied('select public.reply_to_trainer_message(''d1000000-0000-0000-0000-000000000001'', ''Blocked'', ''d2000000-0000-0000-0000-000000000001'')');
set local request.jwt.claims = '{"sub":"d0000000-0000-0000-0000-000000000003","role":"authenticated"}';
select pg_temp.assert_denied('select * from public.read_trainer_reply_contexts(''d1000000-0000-0000-0000-000000000001'', array[current_setting(''test.reply_id'')::uuid])');
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select pg_temp.assert_denied('select public.reply_to_trainer_message(''d1000000-0000-0000-0000-000000000001'', ''Anonymous'', ''d2000000-0000-0000-0000-000000000001'')');
rollback;
