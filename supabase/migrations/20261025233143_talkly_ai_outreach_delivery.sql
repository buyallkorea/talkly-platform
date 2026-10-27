-- Bounded retries are allowed only while preparation has not sent to a provider.
alter table public.ai_outreach_outbox add column preparation_attempts integer not null default 0 check(preparation_attempts between 0 and 3);
alter table public.ai_outreach_outbox add column retry_after timestamptz;
create index ai_outreach_outbox_sending on public.ai_outreach_outbox(claimed_at) where state='sending';
create or replace function public.ai_claim_outreach(p_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v public.ai_outreach_outbox; v_user uuid; v_hour integer;
begin
 select user_id into v_user from public.ai_outreach_outbox where id=p_id;
 if not found then return null; end if;
 perform 1 from public.ai_members where user_id=v_user for update;
 select * into v from public.ai_outreach_outbox where id=p_id for update;
 if not found or v.state<>'pending' then return null; end if;
 if not public.ai_outreach_eligible(v.user_id,v.kind,v.activity_anchor,v.channel,v.consent_revision) then
  update public.ai_outreach_outbox set state='skipped',updated_at=now() where id=p_id;return null;
 end if;
 if v.preparation_attempts>=3 then update public.ai_outreach_outbox set state='failed',updated_at=now() where id=p_id;return null;end if;
 if v.retry_after>now() then return null;end if;
 v_hour:=extract(hour from now() at time zone 'Asia/Seoul');
 if v_hour<9 or v_hour>=18 then return null; end if;
 update public.ai_outreach_outbox set state='sending',claim_token=gen_random_uuid(),claimed_at=now(),updated_at=now(),preparation_attempts=preparation_attempts+1,retry_after=null
 where id=p_id returning * into v;
 return to_jsonb(v);
end $$;
create function public.ai_release_outreach(p_id uuid,p_token uuid)
returns text language plpgsql security invoker set search_path='' as $$
declare result text;
begin
 update public.ai_outreach_outbox set state=case when preparation_attempts>=3 then 'failed' else 'pending' end,
  claim_token=null,claimed_at=null,retry_after=now()+interval '5 minutes',updated_at=now()
 where id=p_id and state='sending' and claim_token=p_token returning state into result;
 return result;
end $$;
revoke all on function public.ai_claim_outreach(uuid),public.ai_release_outreach(uuid,uuid) from public,anon,authenticated;
grant execute on function public.ai_claim_outreach(uuid),public.ai_release_outreach(uuid,uuid) to service_role;
-- Revocation/contact/window changes after claim must be recorded as not sent.
create or replace function public.ai_finish_outreach(p_id uuid,p_token uuid,p_state text,p_provider text default null)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
 if p_state is null or p_state not in ('accepted','failed','unknown','skipped') or length(p_provider)>200 or (p_state='skipped' and p_provider is not null) then raise exception 'invalid delivery result'; end if;
 update public.ai_outreach_outbox set state=p_state,provider_id=p_provider,updated_at=now()
 where id=p_id and state='sending' and claim_token=p_token;
 return found;
end $$;
revoke all on function public.ai_finish_outreach(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.ai_finish_outreach(uuid,uuid,text,text) to service_role;

-- CRON: technical expiry only; no enqueue, network request, or customer sending.
select cron.schedule('talkly-ai-outreach-expire','*/5 * * * *',$job$select public.ai_expire_outreach_claims();$job$);
