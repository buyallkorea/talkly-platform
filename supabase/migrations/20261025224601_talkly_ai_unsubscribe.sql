-- Revocation-only capabilities; raw tokens never stored, no new opt-in or sending.
create table public.ai_outreach_unsubscribe_tokens (
 token_hash text primary key check(token_hash ~ '^[0-9a-f]{64}$'),
 user_id uuid not null references public.ai_members(user_id) on delete cascade,
 channel text not null check(channel in ('kakao','email')),
 created_at timestamptz not null default now()
);
create index ai_outreach_unsubscribe_tokens_user on public.ai_outreach_unsubscribe_tokens(user_id);
alter table public.ai_outreach_unsubscribe_tokens enable row level security;
revoke all on public.ai_outreach_unsubscribe_tokens from public,anon,authenticated;
grant all on public.ai_outreach_unsubscribe_tokens to service_role;
create function public.ai_unsubscribe_outreach(p_hash text) returns boolean
language plpgsql security invoker set search_path='' as $$
declare t public.ai_outreach_unsubscribe_tokens;
begin
 if p_hash is null or p_hash !~ '^[0-9a-f]{64}$' then return false; end if;
 select * into t from public.ai_outreach_unsubscribe_tokens where token_hash=p_hash;
 if not found then return false; end if;
 perform public.ai_set_outreach_consent(t.user_id,t.channel,false,'2026-10-25-outreach-v1');
 return true;
end $$;
revoke all on function public.ai_unsubscribe_outreach(text) from public,anon,authenticated;
grant execute on function public.ai_unsubscribe_outreach(text) to service_role;
