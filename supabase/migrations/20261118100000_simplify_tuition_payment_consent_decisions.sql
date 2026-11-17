-- Allow two required consent decisions for terms version 2026-11-18-v2.
-- Existing immutable three-item records are preserved unchanged.
alter table public.tuition_payment_consents
  drop constraint if exists consent_decisions_check;

alter table public.tuition_payment_consents
  add constraint consent_decisions_check
  check (
    (terms_version = '2026-11-18-v2'
      and decisions @> '{"discount":true,"refund":true}'::jsonb)
    or
    (terms_version <> '2026-11-18-v2'
      and decisions @> '{"discount":true,"earlyTermination":true,"refund":true}'::jsonb)
  );
