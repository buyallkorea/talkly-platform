alter table public.ai_members add column learning_summary_consent_at timestamptz;
create table public.ai_learning_summaries (
  session_id uuid primary key references public.ai_sessions(id) on delete cascade,
  user_id uuid not null references public.ai_members(user_id) on delete cascade,
  day date not null,
  status text not null default 'pending' check(status in ('pending','ready','failed')),
  summary jsonb,
  created_at timestamptz not null default now(),
  check(summary is null or jsonb_typeof(summary) = 'object')
);
create index ai_learning_summaries_owner_day on public.ai_learning_summaries(user_id,day);
alter table public.ai_learning_summaries enable row level security;
revoke all on public.ai_learning_summaries from public,anon,authenticated;
grant select on public.ai_learning_summaries to authenticated;
grant all on public.ai_learning_summaries to service_role;
create policy ai_learning_summaries_own_read on public.ai_learning_summaries for select to authenticated using ((select auth.uid())=user_id);
create function public.ai_monthly_activity(p_user uuid,p_from date,p_to date) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('seconds',coalesce(sum(charged_seconds),0),'days',count(distinct day),'segments',count(*)) from public.ai_sessions where user_id=p_user and day>=p_from and day<p_to and state='closed' and charged_seconds>0;
$$;
revoke all on function public.ai_monthly_activity(uuid,date,date) from public,anon,authenticated;
grant execute on function public.ai_monthly_activity(uuid,date,date) to service_role;
