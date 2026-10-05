-- Apply after 0009_trainer_messages.sql. Replies reference a message in the same conversation.
begin;
alter table public.trainer_messages add column reply_to_message_id uuid
  references public.trainer_messages(id) on delete set null;

create function public.reply_to_trainer_message(p_conversation uuid, p_body text, p_reply_to uuid)
returns public.trainer_messages language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); result public.trainer_messages;
begin
  if me is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if not exists (select 1 from public.trainer_conversations where id = p_conversation
    and me in (initiator_id, recipient_id) and status = 'accepted')
    then raise exception 'CONVERSATION_UNAVAILABLE' using errcode = '42501'; end if;
  if p_reply_to is null or not exists (select 1 from public.trainer_messages
    where id = p_reply_to and conversation_id = p_conversation)
    then raise exception 'REPLY_UNAVAILABLE' using errcode = '42501'; end if;
  -- Reuse acceptance, profile visibility, locking and rate-limit checks from the send RPC.
  result := public.send_trainer_message(p_conversation, p_body);
  update public.trainer_messages set reply_to_message_id = p_reply_to where id = result.id returning * into result;
  return result;
end;
$$;

create function public.read_trainer_reply_contexts(p_conversation uuid, p_messages uuid[])
returns table (id uuid, sender_id uuid, body text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if not exists (select 1 from public.trainer_conversations c where c.id = p_conversation
    and auth.uid() in (c.initiator_id, c.recipient_id))
    then raise exception 'CONVERSATION_UNAVAILABLE' using errcode = '42501'; end if;
  if cardinality(p_messages) > 50 then raise exception 'INVALID_CURSOR'; end if;
  return query select distinct original.id, original.sender_id, original.body
    from public.trainer_messages response join public.trainer_messages original on original.id = response.reply_to_message_id
    where response.conversation_id = p_conversation and original.conversation_id = p_conversation
      and response.id = any(p_messages);
end;
$$;

revoke all on function public.reply_to_trainer_message(uuid, text, uuid),
  public.read_trainer_reply_contexts(uuid, uuid[]) from public, anon;
grant execute on function public.reply_to_trainer_message(uuid, text, uuid),
  public.read_trainer_reply_contexts(uuid, uuid[]) to authenticated;
notify pgrst, 'reload schema';
commit;
