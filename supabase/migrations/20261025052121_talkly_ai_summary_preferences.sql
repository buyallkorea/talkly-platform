-- Serialize summary writes with consent changes on the existing member row.
create function public.ai_store_learning_summary(p_user uuid,p_session uuid,p_consent timestamptz,p_summary jsonb)
returns boolean language plpgsql security invoker set search_path='' as $$
declare m public.ai_members; s public.ai_sessions; saved integer;
begin
  select * into m from public.ai_members where user_id=p_user for update;
  if not found then return false; end if;
  select * into s from public.ai_sessions where id=p_session and user_id=p_user;
  if not found then return false; end if;
  if m.status<>'active' or m.learning_summary_consent_at is null
     or p_consent is distinct from m.learning_summary_consent_at
     or s.started_at<m.learning_summary_consent_at or s.state<>'closed' then
    update public.ai_learning_summaries set status='failed',summary=null
      where session_id=p_session and user_id=p_user and status='pending';
    return false;
  end if;
  if p_summary is null or jsonb_typeof(p_summary)<>'object' then
    raise exception 'INVALID_SUMMARY';
  end if;
  update public.ai_learning_summaries set status='ready',summary=p_summary
    where session_id=p_session and user_id=p_user and status='pending';
  get diagnostics saved=row_count;
  return saved=1;
end;
$$;
revoke all on function public.ai_store_learning_summary(uuid,uuid,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.ai_store_learning_summary(uuid,uuid,timestamptz,jsonb) to service_role;
