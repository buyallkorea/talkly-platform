-- Provider sideband response usage only. No transcript/audio/provider call IDs.
create table public.ai_voice_usage (
 session_id uuid not null references public.ai_sessions(id) on delete cascade,
 response_id text not null check(response_id ~ '^resp_[A-Za-z0-9_-]{1,180}$'),
 model text not null check(length(model) between 1 and 100),
 status text not null check(status in ('completed','cancelled','failed','incomplete')),
 input_tokens integer not null check(input_tokens between 0 and 1000000000),
 output_tokens integer not null check(output_tokens between 0 and 1000000000),
 cached_input_tokens integer check(cached_input_tokens between 0 and input_tokens),
 input_audio_tokens integer check(input_audio_tokens between 0 and input_tokens),
 input_text_tokens integer check(input_text_tokens between 0 and input_tokens),
 input_image_tokens integer check(input_image_tokens between 0 and input_tokens),
 output_audio_tokens integer check(output_audio_tokens between 0 and output_tokens),
 output_text_tokens integer check(output_text_tokens between 0 and output_tokens),
 cached_audio_tokens integer check(cached_audio_tokens between 0 and cached_input_tokens),
 cached_text_tokens integer check(cached_text_tokens between 0 and cached_input_tokens),
 cached_image_tokens integer check(cached_image_tokens between 0 and cached_input_tokens),
 created_at timestamptz not null default now(), primary key(session_id,response_id),
 check(cached_audio_tokens is null or cached_input_tokens is not null),
 check(cached_text_tokens is null or cached_input_tokens is not null),
 check(cached_image_tokens is null or cached_input_tokens is not null),
 check(coalesce(input_audio_tokens,0)::bigint+coalesce(input_text_tokens,0)+coalesce(input_image_tokens,0)<=input_tokens),
 check(coalesce(output_audio_tokens,0)::bigint+coalesce(output_text_tokens,0)<=output_tokens),
 check(coalesce(cached_audio_tokens,0)::bigint+coalesce(cached_text_tokens,0)+coalesce(cached_image_tokens,0)<=coalesce(cached_input_tokens,0)),
 check(cached_audio_tokens is null or input_audio_tokens is null or cached_audio_tokens<=input_audio_tokens),
 check(cached_text_tokens is null or input_text_tokens is null or cached_text_tokens<=input_text_tokens),
 check(cached_image_tokens is null or input_image_tokens is null or cached_image_tokens<=input_image_tokens)
);
create index ai_voice_usage_created on public.ai_voice_usage(created_at desc);
create table public.ai_voice_observations (
 session_id uuid primary key references public.ai_sessions(id) on delete cascade,
 state text not null check(state in ('started','stopped','failed')),
 reason text check(reason in ('deadline','socket_closed','connect_timeout','error','invalid_deadline')),
 observed_responses integer not null default 0 check(observed_responses between 0 and 500),
 recording_errors integer not null default 0 check(recording_errors between 0 and 1000),
 dropped_events boolean not null default false,
 started_at timestamptz not null default now(), finished_at timestamptz
);
create index ai_voice_observations_started on public.ai_voice_observations(started_at desc);
alter table public.ai_voice_usage enable row level security;
alter table public.ai_voice_observations enable row level security;
revoke all on public.ai_voice_usage,public.ai_voice_observations from public,anon,authenticated;
grant all on public.ai_voice_usage,public.ai_voice_observations to service_role;
