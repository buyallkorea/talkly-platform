-- A close claim blocks a provider call from attaching after teardown began.
alter table public.ai_sessions drop constraint ai_sessions_state_check;
alter table public.ai_sessions add constraint ai_sessions_state_check
 check(state in ('connecting','active','closing','closed'));
create function public.ai_begin_close(p_user uuid,p_session uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.ai_sessions;
begin
 perform 1 from public.ai_members where user_id=p_user for update;
 if not found then raise exception 'SESSION_NOT_FOUND'; end if;
 select * into s from public.ai_sessions where id=p_session and user_id=p_user for update;
 if not found then raise exception 'SESSION_NOT_FOUND'; end if;
 if s.state not in ('closing','closed') then
   update public.ai_sessions set state='closing' where id=s.id returning * into s;
 end if;
 return to_jsonb(s);
end $$;
revoke all on function public.ai_begin_close(uuid,uuid) from public,anon,authenticated;
grant execute on function public.ai_begin_close(uuid,uuid) to service_role;
