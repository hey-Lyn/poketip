-- Apply after 0008_trainer_card_colors.sql. Browser writes use authenticated RPCs only.
begin;
create table public.trainer_conversations (
  id uuid primary key default gen_random_uuid(),
  initiator_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'blocked')),
  blocked_by uuid references public.profiles(id),
  initiator_read_at timestamptz not null default '-infinity',
  recipient_read_at timestamptz not null default '-infinity',
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  check (initiator_id <> recipient_id),
  check ((status = 'blocked' and blocked_by is not null and blocked_by in (initiator_id, recipient_id)) or (status <> 'blocked' and blocked_by is null))
);
create unique index trainer_conversation_pair on public.trainer_conversations
  (least(initiator_id, recipient_id), greatest(initiator_id, recipient_id));
create index trainer_conversation_initiator on public.trainer_conversations(initiator_id, updated_at desc);
create index trainer_conversation_recipient on public.trainer_conversations(recipient_id, updated_at desc);
create table public.trainer_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.trainer_conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default clock_timestamp()
);
create index trainer_message_history on public.trainer_messages(conversation_id, created_at desc, id desc);
create index trainer_message_sender on public.trainer_messages(sender_id, created_at desc);
alter table public.trainer_conversations enable row level security;
alter table public.trainer_messages enable row level security;
revoke all on public.trainer_conversations, public.trainer_messages from public, anon, authenticated;
grant select on public.trainer_conversations, public.trainer_messages to authenticated;
create policy conversation_participants on public.trainer_conversations for select to authenticated
  using ((select auth.uid()) in (initiator_id, recipient_id));
create policy message_participants on public.trainer_messages for select to authenticated
  using (exists (select 1 from public.trainer_conversations c where c.id = conversation_id
    and (select auth.uid()) in (c.initiator_id, c.recipient_id)));

create function public.request_trainer_conversation(p_recipient uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); conversation public.trainer_conversations; result uuid;
begin
  if me is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if me = p_recipient then raise exception 'SELF_CONVERSATION'; end if;
  -- Serialize requests by sender to enforce the limit even with concurrent requests.
  perform 1 from public.profiles where id = me for update;
  if not exists (select 1 from public.profiles where id = me and social_enabled)
    or not exists (select 1 from public.profiles where id = p_recipient and social_enabled)
    then raise exception 'PROFILE_UNAVAILABLE'; end if;
  select * into conversation from public.trainer_conversations
    where least(initiator_id, recipient_id) = least(me, p_recipient)
      and greatest(initiator_id, recipient_id) = greatest(me, p_recipient);
  if found then
    if conversation.status in ('declined', 'blocked') then raise exception 'CONVERSATION_UNAVAILABLE'; end if;
    return conversation.id;
  end if;
  if (select count(*) from public.trainer_conversations where initiator_id = me
    and created_at > clock_timestamp() - interval '1 hour') >= 10 then raise exception 'REQUEST_RATE_LIMIT'; end if;
  insert into public.trainer_conversations(initiator_id, recipient_id) values(me, p_recipient)
    on conflict do nothing returning id into result;
  if result is null then select id into result from public.trainer_conversations
    where least(initiator_id, recipient_id) = least(me, p_recipient)
      and greatest(initiator_id, recipient_id) = greatest(me, p_recipient); end if;
  return result;
end;
$$;

create function public.respond_trainer_conversation(p_conversation uuid, p_action text)
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); conversation public.trainer_conversations;
begin
  if me is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  select * into conversation from public.trainer_conversations where id = p_conversation for update;
  if not found or me not in (conversation.initiator_id, conversation.recipient_id)
    then raise exception 'CONVERSATION_UNAVAILABLE' using errcode = '42501'; end if;
  if p_action = 'block' then
    if conversation.status = 'blocked' then return; end if;
    update public.trainer_conversations set status = 'blocked', blocked_by = me, updated_at = clock_timestamp() where id = p_conversation;
  elsif p_action in ('accept', 'decline') and conversation.status = 'pending' and me = conversation.recipient_id then
    update public.trainer_conversations set status = case when p_action = 'accept' then 'accepted' else 'declined' end,
      updated_at = clock_timestamp() where id = p_conversation;
  elsif p_action = 'cancel' and conversation.status = 'pending' and me = conversation.initiator_id then
    update public.trainer_conversations set status = 'declined', updated_at = clock_timestamp() where id = p_conversation;
  else raise exception 'INVALID_CONVERSATION_ACTION' using errcode = '42501'; end if;
end;
$$;

create function public.send_trainer_message(p_conversation uuid, p_body text)
returns public.trainer_messages language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); conversation public.trainer_conversations; result public.trainer_messages;
begin
  if me is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if p_body is null or char_length(btrim(p_body)) not between 1 and 2000 then raise exception 'INVALID_MESSAGE'; end if;
  perform 1 from public.profiles where id = me for update;
  select * into conversation from public.trainer_conversations where id = p_conversation for update;
  if not found or me not in (conversation.initiator_id, conversation.recipient_id) or conversation.status <> 'accepted'
    then raise exception 'CONVERSATION_UNAVAILABLE' using errcode = '42501'; end if;
  if (select count(*) from public.profiles where id in (conversation.initiator_id, conversation.recipient_id) and social_enabled) <> 2
    then raise exception 'PROFILE_UNAVAILABLE'; end if;
  if (select count(*) from public.trainer_messages where sender_id = me
    and created_at > clock_timestamp() - interval '1 minute') >= 30 then raise exception 'MESSAGE_RATE_LIMIT'; end if;
  insert into public.trainer_messages(conversation_id, sender_id, body) values(p_conversation, me, btrim(p_body)) returning * into result;
  update public.trainer_conversations set updated_at = result.created_at where id = p_conversation;
  return result;
end;
$$;

create function public.list_trainer_conversations()
returns table (id uuid, initiator_id uuid, recipient_id uuid, status text, blocked_by uuid,
  updated_at timestamptz, peer_id uuid, peer_username text, peer_name text, peer_avatar text,
  last_body text, unread_count bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  return query select c.id, c.initiator_id, c.recipient_id, c.status, c.blocked_by, c.updated_at,
    p.id, p.username, p.display_name, p.avatar_url,
    (select m.body from public.trainer_messages m where m.conversation_id = c.id order by m.created_at desc, m.id desc limit 1),
    (select count(*) from public.trainer_messages m where m.conversation_id = c.id and m.sender_id <> auth.uid()
      and m.created_at > case when c.initiator_id = auth.uid() then c.initiator_read_at else c.recipient_read_at end)
  from public.trainer_conversations c join public.profiles p on p.id = case when c.initiator_id = auth.uid() then c.recipient_id else c.initiator_id end
  where auth.uid() in (c.initiator_id, c.recipient_id) order by c.updated_at desc, c.id;
end;
$$;

create function public.read_trainer_messages(p_conversation uuid, p_before uuid default null)
returns setof public.trainer_messages language plpgsql stable security definer set search_path = '' as $$
declare cursor_message public.trainer_messages;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if not exists (select 1 from public.trainer_conversations where id = p_conversation and auth.uid() in (initiator_id, recipient_id))
    then raise exception 'CONVERSATION_UNAVAILABLE' using errcode = '42501'; end if;
  if p_before is not null then
    select * into cursor_message from public.trainer_messages where id = p_before and conversation_id = p_conversation;
    if not found then raise exception 'INVALID_CURSOR'; end if;
  end if;
  return query select m.* from public.trainer_messages m where m.conversation_id = p_conversation
    and (p_before is null or (m.created_at, m.id) < (cursor_message.created_at, cursor_message.id))
    order by m.created_at desc, m.id desc limit 50;
end;
$$;

create function public.mark_trainer_conversation_read(p_conversation uuid, p_message uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare seen_at timestamptz;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  select created_at into seen_at from public.trainer_messages where id = p_message and conversation_id = p_conversation;
  if seen_at is null then return; end if;
  update public.trainer_conversations set
    initiator_read_at = case when initiator_id = auth.uid() then greatest(initiator_read_at, seen_at) else initiator_read_at end,
    recipient_read_at = case when recipient_id = auth.uid() then greatest(recipient_read_at, seen_at) else recipient_read_at end
  where id = p_conversation and auth.uid() in (initiator_id, recipient_id)
    and case when initiator_id = auth.uid() then initiator_read_at else recipient_read_at end < seen_at;
end;
$$;

revoke all on function public.request_trainer_conversation(uuid), public.respond_trainer_conversation(uuid, text),
  public.send_trainer_message(uuid, text), public.list_trainer_conversations(), public.read_trainer_messages(uuid, uuid),
  public.mark_trainer_conversation_read(uuid, uuid) from public, anon;
grant execute on function public.request_trainer_conversation(uuid), public.respond_trainer_conversation(uuid, text),
  public.send_trainer_message(uuid, text), public.list_trainer_conversations(), public.read_trainer_messages(uuid, uuid),
  public.mark_trainer_conversation_read(uuid, uuid) to authenticated;
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.trainer_conversations, public.trainer_messages;
  end if;
end; $$;
notify pgrst, 'reload schema';
commit;
