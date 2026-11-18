-- November 18: retain up to three candidate start times for administrator recommendations.
-- Existing requests keep the empty default. Each candidate is a 24-hour HH:MM start time.
alter table public.enrollment_requests
  add column if not exists preferred_time_candidates jsonb not null default '[]'::jsonb;

alter table public.enrollment_requests
  drop constraint if exists enrollment_preferred_time_candidates_check;
alter table public.enrollment_requests
  add constraint enrollment_preferred_time_candidates_check
  check (
    jsonb_typeof(preferred_time_candidates) = 'array'
    and jsonb_array_length(preferred_time_candidates) <= 3
  );

-- Keep original immutable v1 records and v2 two-decision records valid.
alter table public.tuition_payment_consents
  drop constraint if exists consent_decisions_check;
alter table public.tuition_payment_consents
  add constraint consent_decisions_check
  check (
    (terms_version = '2026-11-18-v2'
      and decisions @> '{"discount":true,"refund":true}'::jsonb)
    or
    (terms_version = '2026-11-18-v3'
      and decisions @> '{"discount":true,"refund":true,"finalConfirmation":true}'::jsonb)
    or
    (terms_version not in ('2026-11-18-v2','2026-11-18-v3')
      and decisions @> '{"discount":true,"earlyTermination":true,"refund":true}'::jsonb)
  );
