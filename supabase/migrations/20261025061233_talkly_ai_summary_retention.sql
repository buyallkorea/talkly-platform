-- Owner selected three calendar months of summary-only retention.
create index ai_learning_summaries_retention on public.ai_learning_summaries(created_at);
alter policy ai_learning_summaries_own_read on public.ai_learning_summaries
  using ((select auth.uid())=user_id and created_at > (((now() at time zone 'Asia/Seoul') - interval '3 months') at time zone 'Asia/Seoul'));
create function public.ai_purge_expired_learning_summaries() returns integer
language plpgsql security invoker set search_path='' as $$
declare removed integer;
begin
  delete from public.ai_learning_summaries
    where created_at <= (((now() at time zone 'Asia/Seoul') - interval '3 months') at time zone 'Asia/Seoul');
  get diagnostics removed=row_count;
  return removed;
end;
$$;
revoke all on function public.ai_purge_expired_learning_summaries() from public,anon,authenticated;
grant execute on function public.ai_purge_expired_learning_summaries() to service_role;
-- 20:00 UTC = 05:00 Asia/Seoul. Existing pg_cron extension is reused.
select cron.schedule('talkly-ai-summary-retention','0 20 * * *','select public.ai_purge_expired_learning_summaries();');
