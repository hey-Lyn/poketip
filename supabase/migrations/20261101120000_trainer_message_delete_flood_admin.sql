-- Apply after 20261008233058_trainer_unblock.sql.
-- Adds sender-only soft deletion, anti-flood checks on every message insert,
-- and a public admin flag on shared trainer profiles.
begin;

-- Soft deletion keeps realtime UPDATE events and reply references working.
alter table public.trainer_messages add column deleted_at timestamptz;

do $$
declare constraint_name text;
begin
  for constraint_name in
    select c.conname from pg_constraint c
    where c.conrelid = 'public.trainer_messages'::regclass and c.contype = 'c'
      and pg_get_constraintdef(c.oid) like '%body%'
  loop
    execute format('alter table public.trainer_messages drop constraint %I', constraint_name);
  end loop;
end;
$$;

alter table public.trainer_messages add constraint trainer_messages_body_check check (
  (deleted_at is null and char_length(btrim(body)) between 1 and 2000)
  or (deleted_at is not null and body = '')
);

create or replace function public.set_trainer_message_edited_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.deleted_at is not null then
    raise exception 'MESSAGE_DELETED' using errcode = '42501';
  end if;
  if new.deleted_at is null and new.body is distinct from old.body then
    new.edited_at := clock_timestamp();
  end if;
  return new;
end;
$$;
revoke all on function public.set_trainer_message_edited_at() from public, anon, authenticated;

create function public.delete_trainer_message(p_message uuid)
returns public.trainer_messages language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); target public.trainer_messages; result public.trainer_messages;
begin
  if me is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  select m.* into target from public.trainer_messages m
    join public.trainer_conversations c on c.id = m.conversation_id
    where m.id = p_message and m.sender_id = me and me in (c.initiator_id, c.recipient_id)
    for update of m;
  if not found then raise exception 'MESSAGE_UNAVAILABLE' using errcode = '42501'; end if;
  if target.deleted_at is not null then return target; end if;
  update public.trainer_messages set deleted_at = clock_timestamp(), body = ''
    where id = p_message returning * into result;
  return result;
end;
$$;

-- Runs for send and reply RPCs; sends are already serialized per sender by a profile lock.
create function public.guard_trainer_message_flood()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.trainer_messages
    where sender_id = new.sender_id and created_at > clock_timestamp() - interval '5 seconds') >= 5
    then raise exception 'MESSAGE_FLOOD'; end if;
  if (select count(*) from public.trainer_messages
    where sender_id = new.sender_id and conversation_id = new.conversation_id and deleted_at is null
      and body = btrim(new.body) and created_at > clock_timestamp() - interval '1 minute') >= 3
    then raise exception 'MESSAGE_DUPLICATE'; end if;
  return new;
end;
$$;
revoke all on function public.guard_trainer_message_flood() from public, anon, authenticated;
create trigger trainer_message_flood_guard
  before insert on public.trainer_messages
  for each row execute function public.guard_trainer_message_flood();

revoke all on function public.delete_trainer_message(uuid) from public, anon;
grant execute on function public.delete_trainer_message(uuid) to authenticated;

-- Admin status is intentionally public on shared profiles; roles stay non-editable.
drop function public.get_trainer_profile(text);
drop function public.search_trainers(text, integer, integer);

create function public.get_trainer_profile(p_username text)
returns table (
  id uuid, username text, display_name text, bio text,
  favorite_pokemon_id integer, favorite_pokemon_name text, avatar_url text, created_at timestamptz,
  trainer_title text, card_palette text, cover_style text, cover_url text, favorite_game text, featured_team jsonb,
  card_frame_color text, card_background_start text, card_background_end text, is_admin boolean
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  return query select p.id, p.username, p.display_name, p.bio,
    p.favorite_pokemon_id, p.favorite_pokemon_name, p.avatar_url, p.created_at,
    p.trainer_title, p.card_palette, p.cover_style, p.cover_url, p.favorite_game, p.featured_team,
    p.card_frame_color, p.card_background_start, p.card_background_end, p.role = 'admin'
  from public.profiles p where p.social_enabled and p.username = lower(btrim(p_username));
end;
$$;

create function public.search_trainers(p_query text default '', p_offset integer default 0, p_limit integer default 21)
returns table (
  id uuid, username text, display_name text, bio text,
  favorite_pokemon_id integer, favorite_pokemon_name text, avatar_url text, created_at timestamptz,
  trainer_title text, card_palette text, cover_style text, cover_url text, favorite_game text, featured_team jsonb,
  card_frame_color text, card_background_start text, card_background_end text, is_admin boolean
)
language plpgsql stable security definer set search_path = '' as $$
declare search_query text := lower(btrim(coalesce(p_query, '')));
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if char_length(search_query) > 100 then raise exception 'SEARCH_TOO_LONG' using errcode = '22023'; end if;
  return query select p.id, p.username, p.display_name, p.bio,
    p.favorite_pokemon_id, p.favorite_pokemon_name, p.avatar_url, p.created_at,
    p.trainer_title, p.card_palette, p.cover_style, p.cover_url, p.favorite_game, p.featured_team,
    p.card_frame_color, p.card_background_start, p.card_background_end, p.role = 'admin'
  from public.profiles p where p.social_enabled and (search_query = ''
    or strpos(p.username, search_query) > 0 or strpos(lower(p.display_name), search_query) > 0)
  order by p.username limit greatest(1, least(coalesce(p_limit, 21), 51)) offset greatest(0, coalesce(p_offset, 0));
end;
$$;

revoke all on function public.get_trainer_profile(text) from public, anon;
revoke all on function public.search_trainers(text, integer, integer) from public, anon;
grant execute on function public.get_trainer_profile(text) to authenticated;
grant execute on function public.search_trainers(text, integer, integer) to authenticated;
notify pgrst, 'reload schema';
commit;
