-- All fixtures and changes are rolled back.
begin;
create function pg_temp.assert_ok(condition boolean, description text)
returns void language plpgsql as $$ begin if condition is distinct from true then raise exception 'FAIL: %', description; end if; end; $$;
create function pg_temp.assert_denied(statement text)
returns void language plpgsql as $$ begin
  begin execute statement; exception when insufficient_privilege then return; end;
  raise exception 'FAIL: expected permission denial for %', statement;
end; $$;
insert into auth.users(id,email) values
 ('f1300000-0000-0000-0000-000000000001','unblock-one@example.invalid'),
 ('f1300000-0000-0000-0000-000000000002','unblock-two@example.invalid'),
 ('f1300000-0000-0000-0000-000000000003','unblock-outsider@example.invalid');
update public.profiles set username = 'unblock_' || right(id::text,1), social_enabled = true
 where id::text like 'f1300000-%';
set local role authenticated;
set local request.jwt.claims = '{"sub":"f1300000-0000-0000-0000-000000000001","role":"authenticated"}';
select set_config('test.chat_id',public.request_trainer_conversation('f1300000-0000-0000-0000-000000000002')::text,true);
select public.respond_trainer_conversation(current_setting('test.chat_id')::uuid,'block');
select public.respond_trainer_conversation(current_setting('test.chat_id')::uuid,'unblock');
select pg_temp.assert_ok((select status = 'pending' and blocked_by is null from public.trainer_conversations where id = current_setting('test.chat_id')::uuid),'Unblocking pending does not bypass consent');
select pg_temp.assert_denied('select public.send_trainer_message(current_setting(''test.chat_id'')::uuid,''too soon'')');
set local request.jwt.claims = '{"sub":"f1300000-0000-0000-0000-000000000002","role":"authenticated"}';
select public.respond_trainer_conversation(current_setting('test.chat_id')::uuid,'accept');
select public.send_trainer_message(current_setting('test.chat_id')::uuid,'History survives');
select public.respond_trainer_conversation(current_setting('test.chat_id')::uuid,'block');
set local request.jwt.claims = '{"sub":"f1300000-0000-0000-0000-000000000001","role":"authenticated"}';
select pg_temp.assert_denied('select public.respond_trainer_conversation(current_setting(''test.chat_id'')::uuid,''unblock'')');
-- Repeating block cannot take ownership of someone else's block.
select public.respond_trainer_conversation(current_setting('test.chat_id')::uuid,'block');
select pg_temp.assert_ok((select blocked_by = 'f1300000-0000-0000-0000-000000000002' from public.trainer_conversations where id = current_setting('test.chat_id')::uuid),'Block ownership unchanged');
set local request.jwt.claims = '{"sub":"f1300000-0000-0000-0000-000000000003","role":"authenticated"}';
select pg_temp.assert_denied('select public.respond_trainer_conversation(current_setting(''test.chat_id'')::uuid,''unblock'')');
set local request.jwt.claims = '{"sub":"f1300000-0000-0000-0000-000000000002","role":"authenticated"}';
select public.respond_trainer_conversation(current_setting('test.chat_id')::uuid,'unblock');
select pg_temp.assert_ok((select status = 'accepted' and blocked_by is null and status_before_block is null from public.trainer_conversations where id = current_setting('test.chat_id')::uuid),'Accepted conversation restored');
select pg_temp.assert_ok((select count(*) = 1 from public.read_trainer_messages(current_setting('test.chat_id')::uuid)),'History preserved');
select public.send_trainer_message(current_setting('test.chat_id')::uuid,'Messaging works again');
select pg_temp.assert_denied('select public.respond_trainer_conversation(current_setting(''test.chat_id'')::uuid,''unblock'')');
-- Declined requests also keep their prior consent state.
select set_config('test.declined_id',public.request_trainer_conversation('f1300000-0000-0000-0000-000000000003')::text,true);
set local request.jwt.claims = '{"sub":"f1300000-0000-0000-0000-000000000003","role":"authenticated"}';
select public.respond_trainer_conversation(current_setting('test.declined_id')::uuid,'decline');
select public.respond_trainer_conversation(current_setting('test.declined_id')::uuid,'block');
select public.respond_trainer_conversation(current_setting('test.declined_id')::uuid,'unblock');
select pg_temp.assert_ok((select status = 'declined' from public.trainer_conversations where id = current_setting('test.declined_id')::uuid),'Declined state preserved');
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select pg_temp.assert_denied('select public.respond_trainer_conversation(current_setting(''test.chat_id'')::uuid,''unblock'')');
rollback;
