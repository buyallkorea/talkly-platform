-- Erase summary content, retaining only a minimal duplicate-generation marker
-- until the existing three-calendar-month retention cleanup removes the row.
alter table public.ai_learning_summaries add column deleted_at timestamptz;
alter table public.ai_learning_summaries add constraint ai_summary_deleted_content
 check(deleted_at is null or (summary is null and status='failed'));
alter policy ai_learning_summaries_own_read on public.ai_learning_summaries
 using ((select auth.uid())=user_id and deleted_at is null
 and created_at > (((now() at time zone 'Asia/Seoul')-interval '3 months') at time zone 'Asia/Seoul'));
create function public.ai_delete_learning_summary(p_user uuid,p_session uuid)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
 -- Same lock order as the store function: deletion wins over an in-flight save.
 perform 1 from public.ai_members where user_id=p_user for update;
 if not found then return false; end if;
 update public.ai_learning_summaries set summary=null,status='failed',deleted_at=coalesce(deleted_at,now())
 where user_id=p_user and session_id=p_session;
 return found;
end $$;
revoke all on function public.ai_delete_learning_summary(uuid,uuid) from public,anon,authenticated;
grant execute on function public.ai_delete_learning_summary(uuid,uuid) to service_role;
