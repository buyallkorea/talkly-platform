-- Timestamp fence prevents in-flight checkpoints restoring cleared conversation text.
create function public.ai_clear_memory(p_user uuid) returns timestamptz
language plpgsql security invoker set search_path='' as $$
declare cleared timestamptz;
begin
 perform 1 from public.ai_members where user_id=p_user for update;
 if not found then raise exception 'member unavailable'; end if;
 cleared:=clock_timestamp();
 update public.ai_members set memory='[]'::jsonb,memory_session_at=greatest(cleared,memory_session_at) where user_id=p_user;
 return cleared;
end $$;
revoke all on function public.ai_clear_memory(uuid) from public,anon,authenticated;
grant execute on function public.ai_clear_memory(uuid) to service_role;
