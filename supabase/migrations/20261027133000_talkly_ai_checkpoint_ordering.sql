-- Draft only: apply together with API versioning, never alone.
-- Atomic per-session order, with newer lesson timestamps taking precedence.
alter table public.ai_sessions
  add column if not exists checkpoint_version bigint not null default 0;

create or replace function public.ai_checkpoint_ordered(
  p_user uuid, p_session uuid, p_version bigint, p_turns jsonb
) returns boolean
language plpgsql security invoker set search_path = ''
as $$
declare s public.ai_sessions;
begin
  if p_version is null or p_version < 1 or p_version > 2147483647
    or jsonb_typeof(p_turns) <> 'array' or jsonb_array_length(p_turns) > 20
  then raise exception 'INVALID_CHECKPOINT'; end if;
  -- Lock order member -> session matches existing session accounting functions.
  perform 1 from public.ai_members where user_id=p_user for update;
  if not found then raise exception 'MEMBER_NOT_FOUND'; end if;
  select * into s from public.ai_sessions
   where id=p_session and user_id=p_user for update;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;
  if p_version <= s.checkpoint_version then return false; end if;
  -- A previous (older) session must never overwrite a newer session's memory.
  update public.ai_sessions set checkpoint_version=p_version where id=s.id;
  update public.ai_members
     set memory=p_turns, memory_session_at=s.started_at
   where user_id=p_user
     and (memory_session_at is null or memory_session_at <= s.started_at);
  return true;
end;
$$;
revoke all on function public.ai_checkpoint_ordered(uuid,uuid,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.ai_checkpoint_ordered(uuid,uuid,bigint,jsonb) to service_role;
