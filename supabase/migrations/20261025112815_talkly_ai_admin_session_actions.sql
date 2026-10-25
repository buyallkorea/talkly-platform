-- Technical audit only: no transcript, contact details, provider call IDs or free text.
create table public.ai_session_admin_actions (
 id uuid primary key default gen_random_uuid(),
 actor_id uuid references auth.users(id) on delete set null,
 user_id uuid references public.ai_members(user_id) on delete set null,
 session_id uuid references public.ai_sessions(id) on delete set null,
 reason text not null check(reason in ('connection_issue','member_request')),
 state text not null default 'started' check(state in ('started','completed','failed')),
 created_at timestamptz not null default now(),
 finished_at timestamptz
);
create index ai_session_admin_actions_created on public.ai_session_admin_actions(created_at desc);
create index ai_session_admin_actions_actor on public.ai_session_admin_actions(actor_id);
create index ai_session_admin_actions_user on public.ai_session_admin_actions(user_id);
create index ai_session_admin_actions_session on public.ai_session_admin_actions(session_id);
alter table public.ai_session_admin_actions enable row level security;
revoke all on public.ai_session_admin_actions from public,anon,authenticated;
grant all on public.ai_session_admin_actions to service_role;
