-- All fixtures and changes are rolled back.
begin;
create function pg_temp.assert_ok(condition boolean, description text)
returns void language plpgsql as $$ begin if condition is distinct from true then raise exception 'FAIL: %', description; end if; end; $$;
create function pg_temp.assert_raises(statement text, expected text)
returns void language plpgsql as $$ begin
  begin execute statement; exception when others then
    if sqlerrm = expected then return; end if;
    raise exception 'FAIL: expected % for %, got %', expected, statement, sqlerrm;
  end;
  raise exception 'FAIL: expected % for %', expected, statement;
end; $$;
insert into auth.users(id,email) values
 ('f1400000-0000-0000-0000-000000000001','delete-one@example.invalid'),
 ('f1400000-0000-0000-0000-000000000002','delete-two@example.invalid');
update public.profiles set username = 'delete_' || right(id::text,1), social_enabled = true
 where id::text like 'f1400000-%';
update public.profiles set role = 'admin' where id = 'f1400000-0000-0000-0000-000000000002';
insert into public.trainer_conversations(id, initiator_id, recipient_id, status) values
 ('f1410000-0000-0000-0000-000000000001','f1400000-0000-0000-0000-000000000001','f1400000-0000-0000-0000-000000000002','accepted');
set local role authenticated;
set local request.jwt.claims = '{"sub":"f1400000-0000-0000-0000-000000000001","role":"authenticated"}';

-- Sender-only soft delete.
select set_config('test.message_id',(public.send_trainer_message('f1410000-0000-0000-0000-000000000001','Delete me')).id::text,true);
set local request.jwt.claims = '{"sub":"f1400000-0000-0000-0000-000000000002","role":"authenticated"}';
select pg_temp.assert_raises('select public.delete_trainer_message(current_setting(''test.message_id'')::uuid)','MESSAGE_UNAVAILABLE');
set local request.jwt.claims = '{"sub":"f1400000-0000-0000-0000-000000000001","role":"authenticated"}';
select public.delete_trainer_message(current_setting('test.message_id')::uuid);
select pg_temp.assert_ok((select deleted_at is not null and body = '' and edited_at is null from public.trainer_messages where id = current_setting('test.message_id')::uuid),'Deleted message is cleared without an edit label');
select pg_temp.assert_raises('update public.trainer_messages set body = ''Revived'' where id = current_setting(''test.message_id'')::uuid','MESSAGE_DELETED');

-- Anti-flood: identical repeats and bursts are rejected.
select public.send_trainer_message('f1410000-0000-0000-0000-000000000001','Same text');
select public.send_trainer_message('f1410000-0000-0000-0000-000000000001','Same text');
select public.send_trainer_message('f1410000-0000-0000-0000-000000000001','Same text');
select pg_temp.assert_raises('select public.send_trainer_message(''f1410000-0000-0000-0000-000000000001'',''Same text'')','MESSAGE_DUPLICATE');
select public.send_trainer_message('f1410000-0000-0000-0000-000000000001','Different one');
select pg_temp.assert_raises('select public.send_trainer_message(''f1410000-0000-0000-0000-000000000001'',''Burst'')','MESSAGE_FLOOD');

-- Public admin flag.
select pg_temp.assert_ok((select is_admin from public.get_trainer_profile('delete_2')),'Admin flag is shared');
select pg_temp.assert_ok((select not is_admin from public.get_trainer_profile('delete_1')),'Regular trainers are not admins');
select pg_temp.assert_ok((select bool_or(is_admin) from public.search_trainers('delete_')),'Directory exposes admin flag');
rollback;
