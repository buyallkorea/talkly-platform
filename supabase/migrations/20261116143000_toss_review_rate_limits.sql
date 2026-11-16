-- Rate-limit anonymous Toss sandbox review requests without storing raw IP addresses.
create table if not exists public.toss_review_rate_limits (
  fingerprint text not null check (fingerprint ~ '^[a-f0-9]{64}$'),
  hour_bucket timestamptz not null,
  request_count integer not null default 1 check (request_count >= 1),
  primary key (fingerprint, hour_bucket)
);
alter table public.toss_review_rate_limits enable row level security;
revoke all on public.toss_review_rate_limits from public, anon, authenticated;
grant select, insert, update on public.toss_review_rate_limits to service_role;

create or replace function public.consume_toss_review_rate_limit(p_fingerprint text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare v_count integer;
begin
  if p_fingerprint is null or p_fingerprint !~ '^[a-f0-9]{64}$' then
    return false;
  end if;
  insert into public.toss_review_rate_limits as limiter (fingerprint, hour_bucket, request_count)
  values (p_fingerprint, date_trunc('hour', statement_timestamp()), 1)
  on conflict (fingerprint, hour_bucket) do update
  set request_count = limiter.request_count + 1
  returning request_count into v_count;
  return v_count <= 12;
end;
$$;
revoke all on function public.consume_toss_review_rate_limit(text) from public, anon, authenticated;
grant execute on function public.consume_toss_review_rate_limit(text) to service_role;
