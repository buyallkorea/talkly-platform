-- Bounded per-member timestamps; no IP/device/contact data or permanent attempt history.
create table public.ai_connection_rate_limits (
 user_id uuid primary key references public.ai_members(user_id) on delete cascade,
 attempts timestamptz[] not null default '{}',
 last_renewal_session_id uuid references public.ai_sessions(id) on delete set null,
 updated_at timestamptz not null default now(),
 check(cardinality(attempts)<=30)
);
create index ai_connection_rate_limits_renewal on public.ai_connection_rate_limits(last_renewal_session_id);
alter table public.ai_connection_rate_limits enable row level security;
revoke all on public.ai_connection_rate_limits from public,anon,authenticated;
grant all on public.ai_connection_rate_limits to service_role;
create function public.ai_claim_connection_attempt(p_user uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare timestamps timestamptz[]; n timestamptz; recent integer; oldest_recent timestamptz; wait_seconds integer; renewed uuid; previous public.ai_sessions;
begin
 -- Serialize across instances/tabs using the same member-first lock as quota operations.
 perform 1 from public.ai_members where user_id=p_user and status='active' for update;
 if not found then raise exception 'MEMBERSHIP_REQUIRED'; end if;
 n:=clock_timestamp();
 select attempts,last_renewal_session_id into timestamps,renewed from public.ai_connection_rate_limits where user_id=p_user;
 select coalesce(array_agg(t order by t),'{}'::timestamptz[]) into timestamps
 from unnest(coalesce(timestamps,'{}'::timestamptz[])) as a(t) where t>n-interval '1 hour';
 -- One exemption for a server-verified completed paid lease near its deadline.
 -- Never trust a browser-supplied `renewal` flag to bypass throttling.
 select * into previous from public.ai_sessions where user_id=p_user and state='closed' order by started_at desc limit 1;
 if found and previous.id is distinct from renewed and previous.entitlement='paid'
   and previous.call_id is not null and previous.reserved_seconds>=60
   and previous.charged_seconds>=previous.reserved_seconds-2
   and previous.deadline between n-interval '30 seconds' and n+interval '2 seconds'
   and previous.ended_at>=n-interval '30 seconds' then
   insert into public.ai_connection_rate_limits(user_id,attempts,last_renewal_session_id,updated_at)
   values(p_user,timestamps,previous.id,n)
   on conflict(user_id) do update set attempts=excluded.attempts,last_renewal_session_id=excluded.last_renewal_session_id,updated_at=excluded.updated_at;
   return jsonb_build_object('allowed',true,'retry_after_seconds',0,'automatic_renewal',true);
 end if;
 select count(*)::integer,min(t) into recent,oldest_recent from unnest(timestamps) as a(t) where t>n-interval '60 seconds';
 if recent>=6 or cardinality(timestamps)>=30 then
   wait_seconds:=greatest(1,
     case when recent>=6 then ceil(extract(epoch from oldest_recent+interval '60 seconds'-n))::integer else 0 end,
     case when cardinality(timestamps)>=30 then ceil(extract(epoch from timestamps[1]+interval '1 hour'-n))::integer else 0 end);
   return jsonb_build_object('allowed',false,'retry_after_seconds',least(3600,wait_seconds));
 end if;
 insert into public.ai_connection_rate_limits(user_id,attempts,updated_at)
 values(p_user,array_append(timestamps,n),n)
 on conflict(user_id) do update set attempts=excluded.attempts,updated_at=excluded.updated_at;
 return jsonb_build_object('allowed',true,'retry_after_seconds',0);
end $$;
revoke all on function public.ai_claim_connection_attempt(uuid) from public,anon,authenticated;
grant execute on function public.ai_claim_connection_attempt(uuid) to service_role;
