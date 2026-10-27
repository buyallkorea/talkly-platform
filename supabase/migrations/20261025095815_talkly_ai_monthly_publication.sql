create index ai_sessions_monthly_report on public.ai_sessions(day,user_id) include(charged_seconds) where state='closed' and charged_seconds>0;
-- Publication contains usage totals and a report link period, never duplicated learning text.
create table public.ai_monthly_publications (
  user_id uuid not null references public.ai_members(user_id) on delete cascade,
  month date not null check(extract(day from month)=1),
  published_at timestamptz not null default now(),
  connected_seconds bigint not null check(connected_seconds>=0),
  learning_days integer not null check(learning_days between 0 and 31),
  segments integer not null check(segments>=0),
  primary key(user_id,month)
);
create index ai_monthly_publications_expiry on public.ai_monthly_publications(published_at);
alter table public.ai_monthly_publications enable row level security;
revoke all on public.ai_monthly_publications from public,anon,authenticated;
grant select on public.ai_monthly_publications to authenticated;
grant all on public.ai_monthly_publications to service_role;
create policy ai_monthly_publications_own_read on public.ai_monthly_publications for select to authenticated using (
 (select auth.uid())=user_id and published_at > (((now() at time zone 'Asia/Seoul')-interval '3 months') at time zone 'Asia/Seoul')
);
create function public.ai_publish_monthly_reports(p_now timestamptz default now()) returns integer
language plpgsql security invoker set search_path='' as $$
declare period_end date; period_start date; inserted integer;
begin
 if p_now is null then raise exception 'INVALID_PUBLICATION_TIME'; end if;
 period_end:=date_trunc('month',p_now at time zone 'Asia/Seoul')::date;
 period_start:=(period_end-interval '1 month')::date;
 delete from public.ai_monthly_publications where published_at <= (((p_now at time zone 'Asia/Seoul')-interval '3 months') at time zone 'Asia/Seoul');
 insert into public.ai_monthly_publications(user_id,month,published_at,connected_seconds,learning_days,segments)
 select s.user_id,period_start,p_now,sum(s.charged_seconds),count(distinct s.day)::integer,count(*)::integer
 from public.ai_sessions s join public.ai_members m on m.user_id=s.user_id
 where s.day>=period_start and s.day<period_end and s.state='closed' and s.charged_seconds>0
   and m.status='active' and m.learning_summary_consent_at is not null
 group by s.user_id
 on conflict(user_id,month) do nothing;
 get diagnostics inserted=row_count;
 return inserted;
end;
$$;
revoke all on function public.ai_publish_monthly_reports(timestamptz) from public,anon,authenticated;
grant execute on function public.ai_publish_monthly_reports(timestamptz) to service_role;
-- Daily retries at 00:10 Korea; unique key prevents duplicate monthly publication.
select cron.schedule('talkly-ai-monthly-publication','10 15 * * *','select public.ai_publish_monthly_reports();');
