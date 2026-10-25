-- Owner-first index for bounded member report reads; preserve global publication index.
create index ai_sessions_owner_monthly_report on public.ai_sessions(user_id,day)
 include(charged_seconds) where state='closed' and charged_seconds>0;
create function public.ai_activity_history(p_user uuid,p_from date,p_to date)
returns table(month date,seconds bigint,days integer,segments integer)
language plpgsql stable security invoker set search_path='' as $$
begin
 if p_user is null or p_from is null or p_to is null or p_to<=p_from
   or p_from<>date_trunc('month',p_from::timestamp)::date
   or p_to<>date_trunc('month',p_to::timestamp)::date
   or p_to>p_from+interval '3 months'
   or p_to>(date_trunc('month',now() at time zone 'Asia/Seoul')+interval '1 month')::date then
   raise exception 'INVALID_HISTORY_PERIOD';
 end if;
 return query
 with months as (
   select d::date as report_month from generate_series(p_from::timestamp,(p_to-interval '1 month')::timestamp,interval '1 month') as g(d)
 ), totals as (
   select date_trunc('month',s.day::timestamp)::date as report_month,
     sum(s.charged_seconds)::bigint as total_seconds,count(distinct s.day)::integer as total_days,count(*)::integer as total_segments
   from public.ai_sessions s where s.user_id=p_user and s.day>=p_from and s.day<p_to
     and s.state='closed' and s.charged_seconds>0
   group by 1
 )
 select months.report_month,coalesce(t.total_seconds,0)::bigint,coalesce(t.total_days,0)::integer,coalesce(t.total_segments,0)::integer
 from months left join totals t on t.report_month=months.report_month order by months.report_month;
end $$;
revoke all on function public.ai_activity_history(uuid,date,date) from public,anon,authenticated;
grant execute on function public.ai_activity_history(uuid,date,date) to service_role;
