-- Delivery remains unconnected. No cron, provider call or recipient address is stored.
create table public.ai_outreach_outbox (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.ai_members(user_id) on delete cascade,
 kind text not null check(kind in ('trial_followup','pass_expired')),
 channel text not null check(channel in ('kakao','email')),
 activity_anchor timestamptz not null,
 event_anchor timestamptz not null,
 consent_revision bigint not null,
 state text not null default 'pending' check(state in ('pending','sending','accepted','failed','unknown','skipped')),
 claim_token uuid, claimed_at timestamptz,
 provider_id text check(length(provider_id)<=200),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(user_id,kind,event_anchor)
);
create index ai_outreach_outbox_pending on public.ai_outreach_outbox(created_at) where state='pending';
alter table public.ai_outreach_outbox enable row level security;
revoke all on public.ai_outreach_outbox from public,anon,authenticated;
grant all on public.ai_outreach_outbox to service_role;

create function public.ai_outreach_eligible(p_user uuid,p_kind text,p_anchor timestamptz,p_channel text,p_revision bigint)
returns boolean language sql stable security invoker set search_path='' as $$
 select exists (
 select 1 from public.ai_members m join public.profiles profile on profile.id=m.user_id
 join public.ai_outreach_preferences pref on pref.user_id=m.user_id and pref.channel=p_channel
 where m.user_id=p_user and m.status='active' and m.consent_version='2026-10-25-v2-adult19'
 and profile.role in ('student','parent') and pref.enabled and pref.revision=p_revision
 and pref.notice_version='2026-10-25-outreach-v1'
 and not exists(select 1 from public.ai_sessions s where s.user_id=m.user_id and s.state<>'closed')
 and not exists(select 1 from public.ai_payments p where p.user_id=m.user_id and p.status='confirming')
 and p_anchor<=now()-interval '24 hours'
 and ((p_kind='pass_expired' and m.valid_until=p_anchor
       and exists(select 1 from public.ai_payments p where p.user_id=m.user_id and p.status='paid'))
   or (p_kind='trial_followup' and m.valid_until is null and m.trial_used_seconds>0
       and not exists(select 1 from public.ai_payments p where p.user_id=m.user_id and p.status='paid')
       and p_anchor=(select max(s.ended_at) from public.ai_sessions s where s.user_id=m.user_id and s.state='closed' and s.charged_seconds>0)))
 );
$$;
create function public.ai_enqueue_outreach(p_user uuid,p_kind text,p_anchor timestamptz,p_channel text,p_revision bigint)
returns uuid language plpgsql security invoker set search_path='' as $$
declare v_id uuid; v_event timestamptz;
begin
 perform 1 from public.ai_members where user_id=p_user for update;
 if not public.ai_outreach_eligible(p_user,p_kind,p_anchor,p_channel,p_revision) then return null; end if;
 v_event:=case when p_kind='trial_followup' then '1970-01-01 00:00:00+00'::timestamptz else p_anchor end;
 insert into public.ai_outreach_outbox(user_id,kind,channel,activity_anchor,event_anchor,consent_revision)
 values(p_user,p_kind,p_channel,p_anchor,v_event,p_revision)
 on conflict(user_id,kind,event_anchor) do nothing returning id into v_id;
 -- Duplicates, including failed/unknown events, never create a second send.
 return v_id;
end $$;
create function public.ai_claim_outreach(p_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v public.ai_outreach_outbox; v_user uuid; v_hour integer;
begin
 select user_id into v_user from public.ai_outreach_outbox where id=p_id;
 if not found then return null; end if;
 perform 1 from public.ai_members where user_id=v_user for update;
 select * into v from public.ai_outreach_outbox where id=p_id for update;
 if not found or v.state<>'pending' then return null; end if;
 if not public.ai_outreach_eligible(v.user_id,v.kind,v.activity_anchor,v.channel,v.consent_revision) then
   update public.ai_outreach_outbox set state='skipped',updated_at=now() where id=p_id;
   return null;
 end if;
 v_hour:=extract(hour from now() at time zone 'Asia/Seoul');
 if v_hour<9 or v_hour>=18 then return null; end if;
 update public.ai_outreach_outbox set state='sending',claim_token=gen_random_uuid(),claimed_at=now(),updated_at=now()
 where id=p_id returning * into v;
 return to_jsonb(v);
end $$;
create function public.ai_finish_outreach(p_id uuid,p_token uuid,p_state text,p_provider text default null)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
 if p_state is null or p_state not in ('accepted','failed','unknown') or length(p_provider)>200 then raise exception 'invalid delivery result'; end if;
 update public.ai_outreach_outbox set state=p_state,provider_id=p_provider,updated_at=now()
 where id=p_id and state='sending' and claim_token=p_token;
 return found;
end $$;
-- A crashed or timed-out provider call may already have delivered. Never requeue it.
create function public.ai_expire_outreach_claims()
returns integer language plpgsql security invoker set search_path='' as $$
declare affected integer;
begin
 update public.ai_outreach_outbox set state='unknown',updated_at=now()
 where state='sending' and claimed_at<now()-interval '5 minutes';
 get diagnostics affected=row_count;return affected;
end $$;
revoke all on function public.ai_outreach_eligible(uuid,text,timestamptz,text,bigint),public.ai_enqueue_outreach(uuid,text,timestamptz,text,bigint),public.ai_claim_outreach(uuid),public.ai_finish_outreach(uuid,uuid,text,text),public.ai_expire_outreach_claims() from public,anon,authenticated;
grant execute on function public.ai_outreach_eligible(uuid,text,timestamptz,text,bigint),public.ai_enqueue_outreach(uuid,text,timestamptz,text,bigint),public.ai_claim_outreach(uuid),public.ai_finish_outreach(uuid,uuid,text,text),public.ai_expire_outreach_claims() to service_role;
