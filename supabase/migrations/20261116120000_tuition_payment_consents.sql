create table if not exists public.tuition_payment_consents (
  id bigint generated always as identity primary key,
  payment_id bigint not null unique references public.enrollment_payments(id) on delete restrict,
  enrollment_request_id bigint not null references public.enrollment_requests(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  order_id text not null unique,
  terms_version text not null,
  terms_snapshot jsonb not null,
  decisions jsonb not null,
  pricing_snapshot jsonb not null,
  terms_sha256 text not null,
  consented_at timestamptz not null default now(),
  constraint consent_terms_hash_check check (terms_sha256 ~ '^[a-f0-9]{64}$'),
  constraint consent_decisions_check check (decisions @> '{"discount":true,"earlyTermination":true,"refund":true}'::jsonb)
);
create index if not exists tuition_payment_consents_user_time_idx on public.tuition_payment_consents(actor_user_id,consented_at desc);
create index if not exists tuition_payment_consents_request_idx on public.tuition_payment_consents(enrollment_request_id,consented_at desc);
alter table public.tuition_payment_consents enable row level security;
revoke all on public.tuition_payment_consents from public, anon, authenticated;
grant select, insert on public.tuition_payment_consents to service_role;
