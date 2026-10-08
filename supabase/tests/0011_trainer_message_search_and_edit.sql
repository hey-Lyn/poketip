-- Run as postgres after 0011_trainer_message_search_and_edit.sql. All fixtures are rolled back.
begin;
create function pg_temp.assert_ok(condition boolean, description text)
returns void language plpgsql as $$ begin if condition is distinct from true then raise exception 'FAIL: %', description; end if; end; $$;
create function pg_temp.assert_denied(statement text)
returns void language plpgsql as $$ begin
  begin execute statement; exception when insufficient_privilege then return; end;
  raise exception 'FAIL: expected authorization rejection for %', statement;
end; $$;

insert into auth.users(id, email) values
 ('d0000000-0000-0000-0000-000000000011', 'search-one@example.invalid'),
 ('d0000000-0000-0000-0000-000000000012', 'search-two@example.invalid'),
 ('d0000000-0000-0000-0000-000000000013', 'search-third@example.invalid');
update public.profiles set username = 'search_' || right(id::text, 2), social_enabled = true
  where id in ('d0000000-0000-0000-0000-000000000011', 'd0000000-0000-0000-0000-000000000012', 'd0000000-0000-0000-0000-000000000013');
insert into public.trainer_conversations(id, initiator_id, recipient_id, status) values
 ('d1000000-0000-0000-0000-000000000011', 'd0000000-0000-0000-0000-000000000011', 'd0000000-0000-0000-0000-000000000012', 'accepted');
insert into public.trainer_messages(id, conversation_id, sender_id, body, created_at) values
 ('d2000000-0000-0000-0000-000000000011', 'd1000000-0000-0000-0000-000000000011', 'd0000000-0000-0000-0000-000000000012', 'Older hello', '2026-10-01 12:00:00+00'),
 ('d2000000-0000-0000-0000-000000000012', 'd1000000-0000-0000-0000-000000000011', 'd0000000-0000-0000-0000-000000000011', 'Hello from me', '2026-10-02 12:00:00+00'),
 ('d2000000-0000-0000-0000-000000000013', 'd1000000-0000-0000-0000-000000000011', 'd0000000-0000-0000-0000-000000000012', 'Newest', '2026-10-03 12:00:00+00');

set local role authenticated;
set local request.jwt.claims = '{"sub":"d0000000-0000-0000-0000-000000000011","role":"authenticated"}';
select pg_temp.assert_ok((select count(*) = 2 from public.search_trainer_messages(
  'd1000000-0000-0000-0000-000000000011', 'hello')), 'Message search finds case-insensitive matches in the selected conversation');
select pg_temp.assert_ok((select count(*) = 3 from public.read_trainer_message_context(
  'd1000000-0000-0000-0000-000000000011', 'd2000000-0000-0000-0000-000000000012')), 'Search jumps include nearby messages in chronological order');
update public.trainer_messages set body = 'Edited hello' where id = 'd2000000-0000-0000-0000-000000000012';
select pg_temp.assert_ok((select body = 'Edited hello' and edited_at is not null from public.trainer_messages
  where id = 'd2000000-0000-0000-0000-000000000012'), 'Authors can edit their own message and the edit timestamp is set');
update public.trainer_messages set body = 'Unauthorized edit' where id = 'd2000000-0000-0000-0000-000000000011';
select pg_temp.assert_ok((select body = 'Older hello' from public.trainer_messages
  where id = 'd2000000-0000-0000-0000-000000000011'), 'Participants cannot edit another trainer message');
select pg_temp.assert_denied('update public.trainer_messages set reply_to_message_id = null');

set local request.jwt.claims = '{"sub":"d0000000-0000-0000-0000-000000000013","role":"authenticated"}';
select pg_temp.assert_denied('select * from public.search_trainer_messages(''d1000000-0000-0000-0000-000000000011'', ''hello'')');
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select pg_temp.assert_denied('select * from public.search_trainer_messages(''d1000000-0000-0000-0000-000000000011'', ''hello'')');
rollback;
