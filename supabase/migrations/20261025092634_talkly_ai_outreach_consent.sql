-- Optional advertising preferences. No existing signup consent is imported.
create table public.ai_outreach_preferences (
  user_id uuid not null references public.ai_members(user_id) on delete cascade,
  channel text not null check (channel in ('kakao','email')),
  enabled boolean not null default false,
  revision bigint not null default 1 check (revision > 0),
  notice_version text not null,
  updated_at timestamptz not null default now(),
  primary key(user_id,channel)
);
create table public.ai_outreach_consent_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.ai_members(user_id) on delete cascade,
  channel text not null check (channel in ('kakao','email')),
  enabled boolean not null,
  revision bigint not null,
  notice_version text not null,
  created_at timestamptz not null default now(),
  unique(user_id,channel,revision)
);
alter table public.ai_outreach_preferences enable row level security;
alter table public.ai_outreach_consent_events enable row level security;
revoke all on public.ai_outreach_preferences,public.ai_outreach_consent_events from public,anon,authenticated;
grant select on public.ai_outreach_preferences to authenticated;
create policy ai_outreach_preferences_owner on public.ai_outreach_preferences
  for select to authenticated using ((select auth.uid())=user_id);
grant all on public.ai_outreach_preferences,public.ai_outreach_consent_events to service_role;
grant usage,select on sequence public.ai_outreach_consent_events_id_seq to service_role;

-- Caller supplies authenticated owner, never a browser-supplied target ID.
-- Member lock serializes first opt-in and changes across both channels.
create function public.ai_set_outreach_consent(p_user uuid,p_channel text,p_enabled boolean,p_notice text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v public.ai_outreach_preferences; v_status text;
begin
  if p_channel is null or p_channel not in ('kakao','email') or p_enabled is null
    or p_notice is null or length(p_notice) not between 1 and 100 then
    raise exception 'invalid preference';
  end if;
  select status into v_status from public.ai_members where user_id=p_user for update;
  if not found then raise exception 'member missing'; end if;
  -- Withdrawal remains possible after suspension; new opt-in does not.
  if p_enabled and v_status <> 'active' then raise exception 'member inactive'; end if;
  select * into v from public.ai_outreach_preferences where user_id=p_user and channel=p_channel;
  if found and v.enabled=p_enabled and v.notice_version=p_notice then
    return to_jsonb(v);
  end if;
  insert into public.ai_outreach_preferences(user_id,channel,enabled,notice_version)
    values(p_user,p_channel,p_enabled,p_notice)
    on conflict(user_id,channel) do update set enabled=excluded.enabled,
      notice_version=excluded.notice_version,revision=ai_outreach_preferences.revision+1,updated_at=now()
    returning * into v;
  insert into public.ai_outreach_consent_events(user_id,channel,enabled,revision,notice_version)
    values(v.user_id,v.channel,v.enabled,v.revision,v.notice_version);
  return to_jsonb(v);
end $$;
revoke all on function public.ai_set_outreach_consent(uuid,text,boolean,text) from public,anon,authenticated;
grant execute on function public.ai_set_outreach_consent(uuid,text,boolean,text) to service_role;
