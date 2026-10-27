-- Server-observed technical metadata, never transcript/audio/credentials or estimated bills.
create table public.ai_api_events (
 id uuid primary key default gen_random_uuid(),
 session_id uuid references public.ai_sessions(id) on delete set null,
 kind text not null check(kind in ('voice_connect','learning_summary')),
 model text not null check(length(model) between 1 and 100),
 outcome text not null check(outcome in ('succeeded','failed')),
 failure_kind text check(failure_kind in ('access','rate_limit','provider','request_rejected','timeout','other')),
 http_status integer check(http_status between 100 and 599),
 duration_ms integer not null check(duration_ms between 0 and 600000),
 input_tokens integer check(input_tokens>=0),
 output_tokens integer check(output_tokens>=0),
 cached_input_tokens integer check(cached_input_tokens is null or (input_tokens is not null and cached_input_tokens>=0 and cached_input_tokens<=input_tokens)),
 created_at timestamptz not null default now(),
 unique(session_id,kind),
 check((outcome='succeeded' and failure_kind is null) or (outcome='failed' and failure_kind is not null)),
 check(kind<>'voice_connect' or (input_tokens is null and output_tokens is null and cached_input_tokens is null))
);
create index ai_api_events_created on public.ai_api_events(created_at desc);
alter table public.ai_api_events enable row level security;
revoke all on public.ai_api_events from public,anon,authenticated;
grant all on public.ai_api_events to service_role;
