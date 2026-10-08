begin;
alter table public.trainer_conversations add column status_before_block text
  check (status_before_block in ('pending', 'accepted', 'declined'));
-- Existing blocks did not record their former status. Messages prove acceptance;
-- otherwise require the original recipient's consent again.
update public.trainer_conversations c set status_before_block =
  case when exists (select 1 from public.trainer_messages m where m.conversation_id = c.id)
    then 'accepted' else 'pending' end
  where c.status = 'blocked';

create or replace function public.respond_trainer_conversation(p_conversation uuid, p_action text)
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); conversation public.trainer_conversations;
begin
  if me is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  select * into conversation from public.trainer_conversations where id = p_conversation for update;
  if not found or me not in (conversation.initiator_id, conversation.recipient_id)
    then raise exception 'CONVERSATION_UNAVAILABLE' using errcode = '42501'; end if;
  if p_action = 'block' then
    if conversation.status = 'blocked' then return; end if;
    update public.trainer_conversations set status_before_block = status,
      status = 'blocked', blocked_by = me, updated_at = clock_timestamp() where id = p_conversation;
  elsif p_action = 'unblock' and conversation.status = 'blocked' and conversation.blocked_by = me then
    update public.trainer_conversations set status = coalesce(status_before_block, 'pending'),
      blocked_by = null, status_before_block = null, updated_at = clock_timestamp() where id = p_conversation;
  elsif p_action in ('accept', 'decline') and conversation.status = 'pending' and me = conversation.recipient_id then
    update public.trainer_conversations set status = case when p_action = 'accept' then 'accepted' else 'declined' end,
      updated_at = clock_timestamp() where id = p_conversation;
  elsif p_action = 'cancel' and conversation.status = 'pending' and me = conversation.initiator_id then
    update public.trainer_conversations set status = 'declined', updated_at = clock_timestamp() where id = p_conversation;
  else raise exception 'INVALID_CONVERSATION_ACTION' using errcode = '42501'; end if;
end;
$$;
revoke all on function public.respond_trainer_conversation(uuid, text) from public, anon;
grant execute on function public.respond_trainer_conversation(uuid, text) to authenticated;
notify pgrst, 'reload schema';
commit;
