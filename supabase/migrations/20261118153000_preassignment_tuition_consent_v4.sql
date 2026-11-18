-- Retain old immutable payment consents while allowing new v4 pay-first disclosure.
alter table public.tuition_payment_consents
  drop constraint if exists consent_decisions_check;
alter table public.tuition_payment_consents
  add constraint consent_decisions_check
  check (
    (terms_version = '2026-11-18-v2'
      and decisions @> '{"discount":true,"refund":true}'::jsonb)
    or (terms_version in ('2026-11-18-v3','2026-11-18-v4')
      and decisions @> '{"discount":true,"refund":true,"finalConfirmation":true}'::jsonb)
    or (terms_version not in ('2026-11-18-v2','2026-11-18-v3','2026-11-18-v4')
      and decisions @> '{"discount":true,"earlyTermination":true,"refund":true}'::jsonb)
  );
