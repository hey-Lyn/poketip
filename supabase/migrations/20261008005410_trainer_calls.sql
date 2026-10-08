-- 1:1 calls use server-minted LiveKit tokens; browser writes use these RPCs only.
begin;

create table public.trainer_calls (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.trainer_conversations(id) on delete cascade,
  caller_id uuid not null references public.profiles(id) on delete cascade,
  callee_id uuid not null references public.profiles(id) on delete cascade,
  mode text not null check (mode in ('audio', 'video')),
  status text not null default 'ringing' check (status in ('ringing', 'accepted', 'declined', 'canceled', 'ended', 'missed')),
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default clock_timestamp() + interval '45 seconds',
  accepted_at timestamptz,
  caller_heartbeat_at timestamptz,
  callee_heartbeat_at timestamptz,
  ended_at timestamptz,
  check (caller_id <> callee_id),
  check (expires_at > created_at),
  check (status <> 'accepted' or (accepted_at is not null and caller_heartbeat_at is not null and callee_heartbeat_at is not null)),
  check (status not in ('declined', 'canceled', 'ended', 'missed') or ended_at is not null)
);
create index trainer_call_conversation on public.trainer_calls(conversation_id, created_at desc);
create index trainer_call_caller on public.trainer_calls(caller_id, created_at desc);
create index trainer_call_callee on public.trainer_calls(callee_id, created_at desc);
create index trainer_call_expiry on public.trainer_calls(expires_at) where status in ('ringing', 'accepted');

alter table public.trainer_calls enable row level security;
revoke all on public.trainer_calls from public, anon, authenticated;
grant select on public.trainer_calls to authenticated;
grant all on public.trainer_calls to service_role;
create policy trainer_call_participants on public.trainer_calls for select to authenticated
  using ((select auth.uid()) in (caller_id, callee_id));

-- The privileged implementation is in an unexposed schema. Public RPC wrappers
-- are INVOKER functions, and every reachable implementation verifies auth.uid().
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create function private.refresh_trainer_calls(p_users uuid[])
returns void language sql security definer set search_path = '' as $$
  update public.trainer_calls t
  set status = case when t.status = 'accepted' then 'ended'
    when t.expires_at <= clock_timestamp() then 'missed' else 'canceled' end,
    ended_at = clock_timestamp()
  where t.status in ('ringing', 'accepted')
    and (t.caller_id = any(p_users) or t.callee_id = any(p_users))
    and (t.expires_at <= clock_timestamp()
      or not exists (select 1 from public.trainer_conversations c where c.id = t.conversation_id and c.status = 'accepted')
      or (select count(*) from public.profiles p where p.id in (t.caller_id, t.callee_id) and p.social_enabled) <> 2);
$$;

create function private.start_trainer_call(p_conversation uuid, p_mode text)
returns public.trainer_calls language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); conversation public.trainer_conversations; peer uuid; result public.trainer_calls;
begin
  if me is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if p_mode is null or p_mode not in ('audio', 'video') then raise exception 'INVALID_CALL_MODE' using errcode = '22023'; end if;
  select * into conversation from public.trainer_conversations where id = p_conversation;
  if not found or me not in (conversation.initiator_id, conversation.recipient_id)
    then raise exception 'CONVERSATION_UNAVAILABLE' using errcode = '42501'; end if;
  peer := case when me = conversation.initiator_id then conversation.recipient_id else conversation.initiator_id end;
  -- Lock both participants in one deterministic order. This also serializes
  -- calls between different conversations involving either participant.
  perform 1 from public.profiles where id in (me, peer) order by id for update;
  select * into conversation from public.trainer_conversations where id = p_conversation for update;
  if not found or conversation.status <> 'accepted' or me not in (conversation.initiator_id, conversation.recipient_id)
    then raise exception 'CONVERSATION_UNAVAILABLE' using errcode = '42501'; end if;
  if (select count(*) from public.profiles where id in (me, peer) and social_enabled) <> 2
    then raise exception 'PROFILE_UNAVAILABLE' using errcode = '42501'; end if;
  perform private.refresh_trainer_calls(array[me, peer]);
  if exists (select 1 from public.trainer_calls where status in ('ringing', 'accepted')
    and (caller_id in (me, peer) or callee_id in (me, peer))) then raise exception 'CALL_BUSY' using errcode = '55000'; end if;
  if (select count(*) from public.trainer_calls where caller_id = me
    and created_at > clock_timestamp() - interval '1 minute') >= 5 then raise exception 'CALL_RATE_LIMIT' using errcode = '54000'; end if;
  insert into public.trainer_calls(conversation_id, caller_id, callee_id, mode)
    values(p_conversation, me, peer, p_mode) returning * into result;
  return result;
end;
$$;

create function private.respond_trainer_call(p_call uuid, p_action text)
returns public.trainer_calls language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); current_call public.trainer_calls; conversation public.trainer_conversations;
begin
  if me is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if p_action is null or p_action not in ('accept', 'decline', 'cancel', 'end') then raise exception 'INVALID_CALL_ACTION' using errcode = '22023'; end if;
  select * into current_call from public.trainer_calls where id = p_call;
  if not found or me not in (current_call.caller_id, current_call.callee_id)
    then raise exception 'CALL_UNAVAILABLE' using errcode = '42501'; end if;
  perform 1 from public.profiles where id in (current_call.caller_id, current_call.callee_id) order by id for update;
  select * into conversation from public.trainer_conversations where id = current_call.conversation_id for update;
  perform private.refresh_trainer_calls(array[current_call.caller_id, current_call.callee_id]);
  select * into current_call from public.trainer_calls where id = p_call for update;
  -- Returning terminal calls makes duplicate actions and expiry races harmless.
  if current_call.status not in ('ringing', 'accepted') then return current_call; end if;
  if p_action = 'accept' and current_call.status = 'ringing' and me = current_call.callee_id then
    if conversation.status <> 'accepted'
      or (select count(*) from public.profiles where id in (current_call.caller_id, current_call.callee_id) and social_enabled) <> 2
      then raise exception 'CALL_UNAVAILABLE' using errcode = '42501'; end if;
    update public.trainer_calls set status = 'accepted', accepted_at = clock_timestamp(),
      caller_heartbeat_at = clock_timestamp(), callee_heartbeat_at = clock_timestamp(),
      expires_at = clock_timestamp() + interval '90 seconds' where id = p_call returning * into current_call;
  elsif p_action = 'decline' and current_call.status = 'ringing' and me = current_call.callee_id then
    update public.trainer_calls set status = 'declined', ended_at = clock_timestamp() where id = p_call returning * into current_call;
  elsif p_action = 'cancel' and current_call.status = 'ringing' and me = current_call.caller_id then
    update public.trainer_calls set status = 'canceled', ended_at = clock_timestamp() where id = p_call returning * into current_call;
  elsif p_action = 'end' and current_call.status = 'accepted' then
    update public.trainer_calls set status = 'ended', ended_at = clock_timestamp() where id = p_call returning * into current_call;
  elsif p_action = 'accept' and current_call.status = 'accepted' and me = current_call.callee_id then
    return current_call;
  else raise exception 'INVALID_CALL_ACTION' using errcode = '42501'; end if;
  return current_call;
end;
$$;

create function private.list_trainer_calls()
returns setof public.trainer_calls language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  perform private.refresh_trainer_calls(array[me]);
  return query select t.* from public.trainer_calls t where me in (t.caller_id, t.callee_id)
    order by t.created_at desc, t.id desc limit 50;
end;
$$;

create function private.heartbeat_trainer_call(p_call uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); current_call public.trainer_calls; conversation public.trainer_conversations;
begin
  if me is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  select * into current_call from public.trainer_calls where id = p_call;
  if not found or me not in (current_call.caller_id, current_call.callee_id)
    then raise exception 'CALL_UNAVAILABLE' using errcode = '42501'; end if;
  perform 1 from public.profiles where id in (current_call.caller_id, current_call.callee_id) order by id for update;
  select * into conversation from public.trainer_conversations where id = current_call.conversation_id for update;
  perform private.refresh_trainer_calls(array[me]);
  select * into current_call from public.trainer_calls where id = p_call for update;
  if current_call.status <> 'accepted' then return; end if;
  if conversation.status <> 'accepted'
    or (select count(*) from public.profiles where id in (current_call.caller_id, current_call.callee_id) and social_enabled) <> 2
    then raise exception 'CALL_UNAVAILABLE' using errcode = '42501'; end if;
  -- A surviving tab cannot keep a vanished peer's call alive indefinitely.
  update public.trainer_calls set
    caller_heartbeat_at = case when caller_id = me then clock_timestamp() else caller_heartbeat_at end,
    callee_heartbeat_at = case when callee_id = me then clock_timestamp() else callee_heartbeat_at end,
    expires_at = least(
      case when caller_id = me then clock_timestamp() else caller_heartbeat_at end,
      case when callee_id = me then clock_timestamp() else callee_heartbeat_at end
    ) + interval '90 seconds'
    where id = p_call;
end;
$$;

create function public.start_trainer_call(p_conversation uuid, p_mode text)
returns public.trainer_calls language sql security invoker set search_path = '' as $$
  select private.start_trainer_call(p_conversation, p_mode);
$$;
create function public.respond_trainer_call(p_call uuid, p_action text)
returns public.trainer_calls language sql security invoker set search_path = '' as $$
  select private.respond_trainer_call(p_call, p_action);
$$;
create function public.list_trainer_calls()
returns setof public.trainer_calls language sql security invoker set search_path = '' as $$
  select * from private.list_trainer_calls();
$$;
create function public.heartbeat_trainer_call(p_call uuid)
returns void language sql security invoker set search_path = '' as $$
  select private.heartbeat_trainer_call(p_call);
$$;

-- End calls immediately in database state when consent is withdrawn. The client
-- requests authenticated room cleanup to disconnect the LiveKit participants.
create function private.end_unavailable_trainer_calls()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'trainer_conversations' then
    if new.status <> 'accepted' then
      update public.trainer_calls set status = case when status = 'accepted' then 'ended' else 'canceled' end,
        ended_at = clock_timestamp() where conversation_id = new.id and status in ('ringing', 'accepted');
    end if;
  elsif tg_table_name = 'profiles' then
    if not new.social_enabled then
      update public.trainer_calls set status = case when status = 'accepted' then 'ended' else 'canceled' end,
        ended_at = clock_timestamp() where new.id in (caller_id, callee_id) and status in ('ringing', 'accepted');
    end if;
  end if;
  return new;
end;
$$;
create trigger end_calls_on_conversation_change after update of status on public.trainer_conversations
  for each row when (old.status is distinct from new.status) execute function private.end_unavailable_trainer_calls();
create trigger end_calls_on_profile_change after update of social_enabled on public.profiles
  for each row when (old.social_enabled is distinct from new.social_enabled) execute function private.end_unavailable_trainer_calls();

revoke all on function private.refresh_trainer_calls(uuid[]), private.end_unavailable_trainer_calls(),
  private.start_trainer_call(uuid, text), private.respond_trainer_call(uuid, text),
  private.list_trainer_calls(), private.heartbeat_trainer_call(uuid),
  public.start_trainer_call(uuid, text), public.respond_trainer_call(uuid, text),
  public.list_trainer_calls(), public.heartbeat_trainer_call(uuid) from public, anon, authenticated;
grant execute on function private.start_trainer_call(uuid, text), private.respond_trainer_call(uuid, text),
  private.list_trainer_calls(), private.heartbeat_trainer_call(uuid),
  public.start_trainer_call(uuid, text), public.respond_trainer_call(uuid, text),
  public.list_trainer_calls(), public.heartbeat_trainer_call(uuid) to authenticated;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.trainer_calls;
  end if;
end; $$;
notify pgrst, 'reload schema';
commit;
