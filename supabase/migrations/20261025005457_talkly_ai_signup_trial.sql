-- One lifetime signup trial, separate from paid daily minutes. Existing sessions
-- retain their original paid accounting, including during a rolling deployment.
alter table public.ai_members add column trial_used_seconds integer not null default 0 check(trial_used_seconds between 0 and 180);
alter table public.ai_sessions add column entitlement text not null default 'paid' check(entitlement in ('paid','trial'));

create or replace function public.ai_reserve(p_user uuid,p_tutor text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare m public.ai_members; s public.ai_sessions; d date; used integer; seconds integer; n timestamptz; midnight timestamptz; kind text;
begin
 select * into m from public.ai_members where user_id=p_user for update;
 if not found or m.status<>'active' then raise exception 'MEMBERSHIP_REQUIRED'; end if;
 n:=clock_timestamp();
 if exists(select 1 from public.ai_sessions where user_id=p_user and state<>'closed') then raise exception 'SESSION_ACTIVE'; end if;
 if p_tutor not in ('us-male','us-female','uk-male','uk-female','au-male','au-female','ca-male','ca-female','za-male','za-female') then raise exception 'INVALID_TUTOR'; end if;
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

create or replace function public.ai_finish(p_user uuid,p_session uuid,p_failed boolean default false)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.ai_sessions; charged integer;
begin
 perform 1 from public.ai_members where user_id=p_user for update;
 select * into s from public.ai_sessions where id=p_session and user_id=p_user for update;
 if not found then raise exception 'SESSION_NOT_FOUND'; end if;
 if s.state='closed' then return to_jsonb(s); end if;
 charged:=case when p_failed and s.call_id is null then 0 else least(s.reserved_seconds,greatest(0,ceil(extract(epoch from clock_timestamp()-s.started_at))::integer)) end;
 if s.entitlement='trial' then
  update public.ai_members set trial_used_seconds=greatest(0,trial_used_seconds-(s.reserved_seconds-charged)) where user_id=p_user;
 else
  update public.ai_daily_usage set used_seconds=greatest(0,used_seconds-(s.reserved_seconds-charged)) where user_id=p_user and day=s.day;
 end if;
 update public.ai_sessions set state='closed',ended_at=clock_timestamp(),charged_seconds=charged where id=s.id returning * into s;
 return to_jsonb(s);
end $$;
revoke all on function public.ai_reserve(uuid,text),public.ai_finish(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.ai_reserve(uuid,text),public.ai_finish(uuid,uuid,boolean) to service_role;
