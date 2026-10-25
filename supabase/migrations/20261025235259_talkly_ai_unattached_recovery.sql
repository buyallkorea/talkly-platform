-- Recover only expired reservations that never registered a provider call.
-- Follow the same member -> session lock order as reserve/finish/close.
create index ai_unattached_session_deadline on public.ai_sessions(deadline,id)
 where call_id is null and state in ('connecting','closing');
create function public.ai_recover_unattached_sessions()
returns integer language plpgsql security invoker set search_path='' as $$
declare candidate record; locked_id uuid; recovered integer:=0;
begin
 for candidate in
  select id,user_id from public.ai_sessions
  where call_id is null and state in ('connecting','closing') and deadline<=clock_timestamp()
  order by deadline,id limit 100
 loop
  perform 1 from public.ai_members where user_id=candidate.user_id for update skip locked;
  if not found then continue; end if;
  select id into locked_id from public.ai_sessions
   where id=candidate.id and user_id=candidate.user_id and call_id is null
    and state in ('connecting','closing') and deadline<=clock_timestamp()
   for update skip locked;
  if not found then continue; end if;
  perform public.ai_finish(candidate.user_id,locked_id,true);
  recovered:=recovered+1;
 end loop;
 return recovered;
end $$;
revoke all on function public.ai_recover_unattached_sessions() from public,anon,authenticated;
grant execute on function public.ai_recover_unattached_sessions() to service_role;

-- CRON: SQL-only quota recovery; never hangs up or refunds a registered call.
select cron.schedule('talkly-ai-unattached-recovery','* * * * *',$job$select public.ai_recover_unattached_sessions();$job$);
