-- Preserve member-owned memory, settled usage and all historical tutor session identifiers.
create or replace function public.ai_reserve(p_user uuid, p_tutor text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare m public.ai_members; s public.ai_sessions; d date; used integer; seconds integer; n timestamptz; midnight timestamptz; kind text;
begin
 select * into m from public.ai_members where user_id=p_user for update;
 if not found or m.status<>'active' then raise exception 'MEMBERSHIP_REQUIRED'; end if;
 n:=clock_timestamp();
 if exists(select 1 from public.ai_sessions where user_id=p_user and state<>'closed') then raise exception 'SESSION_ACTIVE'; end if;
 if p_tutor not in ('lively-male','lively-female','intellectual-male','intellectual-female','calm-male','calm-female') then raise exception 'INVALID_TUTOR'; end if;
 d:=(n at time zone 'Asia/Seoul')::date;
 midnight:=(d+1)::timestamp at time zone 'Asia/Seoul';
 if m.valid_until is not null and m.valid_until>n then
  kind:='paid';
  insert into public.ai_daily_usage(user_id,day) values(p_user,d) on conflict do nothing;
  select used_seconds into used from public.ai_daily_usage where user_id=p_user and day=d for update;
  seconds:=least(240,600-used,floor(extract(epoch from least(m.valid_until,midnight)-n))::integer);
  if seconds<1 then raise exception 'NO_TIME_REMAINING'; end if;
  update public.ai_daily_usage set used_seconds=used_seconds+seconds where user_id=p_user and day=d;
 else
  kind:='trial';
  if m.trial_used_seconds>=180 then raise exception 'TRIAL_EXHAUSTED'; end if;
  seconds:=least(180-m.trial_used_seconds,floor(extract(epoch from midnight-n))::integer);
  if seconds<1 then raise exception 'NO_TIME_REMAINING'; end if;
  update public.ai_members set trial_used_seconds=trial_used_seconds+seconds where user_id=p_user;
 end if;
 insert into public.ai_sessions(user_id,tutor_id,day,reserved_seconds,started_at,deadline,entitlement)
 values(p_user,p_tutor,d,seconds,n,n+make_interval(secs=>seconds),kind) returning * into s;
 update public.ai_members set last_tutor_id=p_tutor where user_id=p_user;
 return to_jsonb(s);
end $$;
revoke all on function public.ai_reserve(uuid,text) from public,anon,authenticated;
grant execute on function public.ai_reserve(uuid,text) to service_role;
