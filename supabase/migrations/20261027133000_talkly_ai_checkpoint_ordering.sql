-- Draft only: apply together with API versioning, never alone.
-- Atomic per-session order, with newer lesson timestamps taking precedence.
alter table public.ai_sessions
  add column if not exists checkpoint_version bigint not null default 0;
alter table public.ai_sessions add column if not exists checkpoint_digest text;
alter table public.ai_sessions add column if not exists checkpoint_writer uuid;

create or replace function public.ai_checkpoint_ordered(
  p_user uuid, p_session uuid, p_version bigint, p_turns jsonb, p_writer uuid
) returns boolean
language plpgsql security invoker set search_path = ''
as $$
declare s public.ai_sessions; incoming_digest text;
begin
  if p_turns is null or p_writer is null or p_version is null or p_version < 1 or p_version > 2147483647
    or jsonb_typeof(p_turns) is distinct from 'array'
  then raise exception 'INVALID_CHECKPOINT'; end if;
  if jsonb_array_length(p_turns) = 0 or jsonb_array_length(p_turns) > 20
  then raise exception 'INVALID_CHECKPOINT'; end if;
  -- Lock order member -> session matches existing session accounting functions.
  perform 1 from public.ai_members where user_id=p_user for update;
  if not found then raise exception 'MEMBER_NOT_FOUND'; end if;
  select * into s from public.ai_sessions
   where id=p_session and user_id=p_user for update;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;
  -- A different, newer lesson owns the current memory; reject a delayed old lesson.
  if exists (select 1 from public.ai_members where user_id=p_user
             and memory_session_at > s.started_at) then
    raise exception 'OLDER_SESSION_CHECKPOINT';
  end if;
  if s.checkpoint_writer is null or s.checkpoint_writer <> p_writer then
    raise exception 'CHECKPOINT_WRITER_CONFLICT';
  end if;
  incoming_digest := md5(p_turns::text);
  if p_version = s.checkpoint_version and s.checkpoint_digest = incoming_digest then return true; end if;
  if p_version <= s.checkpoint_version then raise exception 'STALE_CHECKPOINT'; end if;
  -- A previous (older) session must never overwrite a newer session's memory.
  update public.ai_sessions set checkpoint_version=p_version, checkpoint_digest=incoming_digest
    where id=s.id;
  update public.ai_members
     set memory=p_turns, memory_session_at=s.started_at
   where user_id=p_user
     and (memory_session_at is null or memory_session_at <= s.started_at);
  if not found then raise exception 'MEMBER_MEMORY_NOT_UPDATED'; end if;
  return true;
end;
$$;
revoke all on function public.ai_checkpoint_ordered(uuid,uuid,bigint,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.ai_checkpoint_ordered(uuid,uuid,bigint,jsonb,uuid) to service_role;
