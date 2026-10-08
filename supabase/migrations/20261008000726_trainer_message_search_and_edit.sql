begin;

alter table public.trainer_messages add column edited_at timestamptz;

grant update (body) on public.trainer_messages to authenticated;
create policy message_sender_update on public.trainer_messages for update to authenticated
  using (sender_id = (select auth.uid()) and exists (
    select 1 from public.trainer_conversations c
    where c.id = trainer_messages.conversation_id
      and (select auth.uid()) in (c.initiator_id, c.recipient_id)
  ))
  with check (sender_id = (select auth.uid()) and exists (
    select 1 from public.trainer_conversations c
    where c.id = trainer_messages.conversation_id
      and (select auth.uid()) in (c.initiator_id, c.recipient_id)
  ));

create function public.set_trainer_message_edited_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.body is distinct from old.body then
    new.edited_at := clock_timestamp();
  end if;
  return new;
end;
$$;
revoke all on function public.set_trainer_message_edited_at() from public, anon, authenticated;
create trigger trainer_message_edited_at
  before update of body on public.trainer_messages
  for each row execute function public.set_trainer_message_edited_at();

create function public.search_trainer_messages(p_conversation uuid, p_query text, p_before uuid default null)
returns setof public.trainer_messages language plpgsql stable security invoker set search_path = '' as $$
declare me uuid := auth.uid(); query_text text := btrim(coalesce(p_query, ''));
begin
  if me is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if char_length(query_text) not between 2 and 100 then raise exception 'INVALID_SEARCH'; end if;
  if not exists (select 1 from public.trainer_conversations c
    where c.id = p_conversation and me in (c.initiator_id, c.recipient_id))
    then raise exception 'CONVERSATION_UNAVAILABLE' using errcode = '42501'; end if;

  return query select m.* from public.trainer_messages m
    where m.conversation_id = p_conversation
      and strpos(lower(m.body), lower(query_text)) > 0
      and (p_before is null or (m.created_at, m.id) < (
        select cursor_message.created_at, cursor_message.id
        from public.trainer_messages cursor_message
        where cursor_message.id = p_before and cursor_message.conversation_id = p_conversation
          and strpos(lower(cursor_message.body), lower(query_text)) > 0
      ))
    order by m.created_at desc, m.id desc
    limit 50;
end;
$$;

create function public.read_trainer_message_context(p_conversation uuid, p_message uuid)
returns setof public.trainer_messages language sql stable security invoker set search_path = '' as $$
  with target as (
    select m.created_at, m.id from public.trainer_messages m
    where m.conversation_id = p_conversation and m.id = p_message
  ),
  target_message as (
    select m.* from public.trainer_messages m join target t on t.id = m.id
  ),
  older as (
    select m.* from public.trainer_messages m cross join target t
    where m.conversation_id = p_conversation and (m.created_at, m.id) < (t.created_at, t.id)
    order by m.created_at desc, m.id desc limit 10
  ),
  newer as (
    select m.* from public.trainer_messages m cross join target t
    where m.conversation_id = p_conversation and (m.created_at, m.id) > (t.created_at, t.id)
    order by m.created_at, m.id limit 10
  )
  select * from (
    select * from older
    union all select * from target_message
    union all select * from newer
  ) context_messages
  order by created_at, id;
$$;

revoke all on function public.search_trainer_messages(uuid, text, uuid),
  public.read_trainer_message_context(uuid, uuid) from public, anon;
grant execute on function public.search_trainer_messages(uuid, text, uuid),
  public.read_trainer_message_context(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
