-- Preserve historical consent evidence while supporting the simplified two-item checkout.
-- v2: discount + refund; v3/v4: discount + refund + finalConfirmation.
-- v5: refund + finalConfirmation, with immutable per-order terms_snapshot.
alter table public.tuition_payment_consents
  drop constraint if exists consent_decisions_check;

alter table public.tuition_payment_consents
  add constraint consent_decisions_check
  check (
    (terms_version = '2026-11-19-v5'
      and decisions @> '{"refund":true,"finalConfirmation":true}'::jsonb)
    or (terms_version = '2026-11-18-v2'
      and decisions @> '{"discount":true,"refund":true}'::jsonb)
    or (terms_version in ('2026-11-18-v3','2026-11-18-v4')
      and decisions @> '{"discount":true,"refund":true,"finalConfirmation":true}'::jsonb)
    or (terms_version not in ('2026-11-19-v5','2026-11-18-v2','2026-11-18-v3','2026-11-18-v4')
      and decisions @> '{"discount":true,"earlyTermination":true,"refund":true}'::jsonb)
  );
