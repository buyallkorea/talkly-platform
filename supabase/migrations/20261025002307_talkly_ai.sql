-- Additive only: existing class/auth/payment tables are unchanged.
create table public.ai_members (
 user_id uuid primary key references auth.users(id) on delete cascade,
 status text not null default 'active' check(status in ('active','suspended')),
 consent_version text not null, consented_at timestamptz not null default now(),
 valid_until timestamptz, last_tutor_id text, memory jsonb not null default '[]',
 memory_session_at timestamptz, created_at timestamptz not null default now()
);
create table public.ai_payments (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.ai_members(user_id),
 order_id text not null unique, amount integer not null check(amount=13900),
 status text not null default 'ready' check(status in ('ready','confirming','paid','failed','cancelled')),
 payment_key text unique, approved_at timestamptz, activated_until timestamptz,
 created_at timestamptz not null default now()
);
create table public.ai_daily_usage (
 user_id uuid not null references public.ai_members(user_id), day date not null,
 used_seconds integer not null default 0 check(used_seconds between 0 and 600),
 primary key(user_id,day)
);
create table public.ai_sessions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.ai_members(user_id),
 tutor_id text not null, day date not null, reserved_seconds integer not null check(reserved_seconds between 1 and 240),
 started_at timestamptz not null default now(), deadline timestamptz not null,
 call_id text, state text not null default 'connecting' check(state in ('connecting','active','closed')),
 charged_seconds integer, ended_at timestamptz
);
create unique index ai_one_live_session on public.ai_sessions(user_id) where state <> 'closed';
create index ai_payments_user_created on public.ai_payments(user_id,created_at desc);
create index ai_sessions_user_started on public.ai_sessions(user_id,started_at desc);
create index ai_sessions_deadline on public.ai_sessions(deadline) where state <> 'closed';

-- All writes go through authenticated server routes using service_role.
-- Ordinary members can read their own non-secret tables only. Admin screens
-- use verified profiles.role on the server, never user_metadata.
alter table public.ai_members enable row level security;
alter table public.ai_payments enable row level security;
alter table public.ai_daily_usage enable row level security;
alter table public.ai_sessions enable row level security;
revoke all on public.ai_members,public.ai_payments,public.ai_daily_usage,public.ai_sessions from anon,authenticated;
grant select on public.ai_members,public.ai_daily_usage to authenticated;
grant all on public.ai_members,public.ai_payments,public.ai_daily_usage,public.ai_sessions to service_role;
create policy ai_member_read on public.ai_members for select to authenticated using ((select auth.uid())=user_id);
create policy ai_usage_read on public.ai_daily_usage for select to authenticated using ((select auth.uid())=user_id);

-- Invoker functions, executable only by service_role. Member row locks serialize
-- payments, quota reservations, refunds and concurrent tabs for each user.
create function public.ai_reserve(p_user uuid,p_tutor text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare m public.ai_members; s public.ai_sessions; d date; used integer; seconds integer; n timestamptz:=clock_timestamp(); midnight timestamptz;
begin
 select * into m from public.ai_members where user_id=p_user for update;
 if not found or m.status<>'active' then raise exception 'MEMBERSHIP_REQUIRED'; end if;
 if m.valid_until is null or m.valid_until<=n then raise exception 'PASS_EXPIRED'; end if;
 if exists(select 1 from public.ai_sessions where user_id=p_user and state<>'closed') then raise exception 'SESSION_ACTIVE'; end if;
 if p_tutor not in ('us-male','us-female','uk-male','uk-female','au-male','au-female','ca-male','ca-female','za-male','za-female') then raise exception 'INVALID_TUTOR'; end if;
 d:=(n at time zone 'Asia/Seoul')::date;
 midnight:=(d+1)::timestamp at time zone 'Asia/Seoul';
 insert into public.ai_daily_usage(user_id,day) values(p_user,d) on conflict do nothing;
 select used_seconds into used from public.ai_daily_usage where user_id=p_user and day=d for update;
 seconds:=least(240,600-used,floor(extract(epoch from least(m.valid_until,midnight)-n))::integer);
 if seconds<1 then raise exception 'NO_TIME_REMAINING'; end if;
 update public.ai_daily_usage set used_seconds=used_seconds+seconds where user_id=p_user and day=d;
 insert into public.ai_sessions(user_id,tutor_id,day,reserved_seconds,started_at,deadline)
 values(p_user,p_tutor,d,seconds,n,n+make_interval(secs=>seconds)) returning * into s;
 update public.ai_members set last_tutor_id=p_tutor where user_id=p_user;
 return to_jsonb(s);
end $$;

create function public.ai_finish(p_user uuid,p_session uuid,p_failed boolean default false)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.ai_sessions; charged integer;
begin
 perform 1 from public.ai_members where user_id=p_user for update;
 select * into s from public.ai_sessions where id=p_session and user_id=p_user for update;
 if not found then raise exception 'SESSION_NOT_FOUND'; end if;
 if s.state='closed' then return to_jsonb(s); end if;
 -- The server may refund a failed negotiation only before a call was attached.
 charged:=case when p_failed and s.call_id is null then 0 else least(s.reserved_seconds,greatest(0,ceil(extract(epoch from clock_timestamp()-s.started_at))::integer)) end;
 update public.ai_daily_usage set used_seconds=greatest(0,used_seconds-(s.reserved_seconds-charged)) where user_id=p_user and day=s.day;
 update public.ai_sessions set state='closed',ended_at=clock_timestamp(),charged_seconds=charged where id=s.id returning * into s;
 return to_jsonb(s);
end $$;

create function public.ai_activate(p_user uuid,p_order text,p_key text,p_approved timestamptz)
returns timestamptz language plpgsql security invoker set search_path='' as $$
declare p public.ai_payments; until_at timestamptz;
begin
 perform 1 from public.ai_members where user_id=p_user for update;
 select * into p from public.ai_payments where order_id=p_order and user_id=p_user for update;
 if not found then raise exception 'ORDER_NOT_FOUND'; end if;
 if p.status='paid' then return p.activated_until; end if;
 if p.status='cancelled' or p.payment_key is distinct from p_key then raise exception 'ORDER_MISMATCH'; end if;
 select greatest(coalesce(valid_until,clock_timestamp()),clock_timestamp())+interval '30 days' into until_at from public.ai_members where user_id=p_user;
 update public.ai_members set valid_until=until_at where user_id=p_user;
 update public.ai_payments set status='paid',approved_at=p_approved,activated_until=until_at where id=p.id;
 return until_at;
end $$;
revoke all on function public.ai_reserve(uuid,text),public.ai_finish(uuid,uuid,boolean),public.ai_activate(uuid,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.ai_reserve(uuid,text),public.ai_finish(uuid,uuid,boolean),public.ai_activate(uuid,text,text,timestamptz) to service_role;
