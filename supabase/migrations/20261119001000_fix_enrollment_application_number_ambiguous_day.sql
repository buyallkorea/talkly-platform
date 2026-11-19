-- Fix new enrollment insert failure:
-- ERROR 42702: column reference "reception_day" is ambiguous.
-- The original trigger declared a local variable named reception_day and used
-- ON CONFLICT (reception_day), which PostgreSQL can resolve as either the
-- variable or the sequence-table column.
-- Keep Korea Standard Time, atomic per-day sequence increments and immutable IDs.

create or replace function public.set_enrollment_application_number()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_reception_day date;
  v_next_sequence integer;
begin
  v_reception_day :=
    (coalesce(new.created_at, now()) at time zone 'Asia/Seoul')::date;

  insert into public.enrollment_request_daily_sequences
    (reception_day, last_sequence)
  values (v_reception_day, 1)
  on conflict on constraint enrollment_request_daily_sequences_pkey
    do update set last_sequence =
      public.enrollment_request_daily_sequences.last_sequence + 1
  returning last_sequence into v_next_sequence;

  -- Never trust caller-provided application_number.
  new.application_number :=
    to_char(v_reception_day, 'YYYYMMDD') ||
    lpad(v_next_sequence::text, greatest(3, length(v_next_sequence::text)), '0');
  return new;
end;
$$;
