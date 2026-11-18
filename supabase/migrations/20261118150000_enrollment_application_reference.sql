-- Permanent human-readable application numbers: YYYYMMDD001, YYYYMMDD002, ...
-- The calendar date is Asia/Seoul. Internal bigint IDs and foreign keys do not change.
-- Backfill is ordered by original created_at and ID; old cancelled requests are preserved.

create table if not exists public.enrollment_request_daily_sequences (
  reception_day date primary key,
  last_sequence integer not null check (last_sequence > 0)
);
alter table public.enrollment_request_daily_sequences enable row level security;
revoke all on table public.enrollment_request_daily_sequences from public, anon, authenticated;

alter table public.enrollment_requests
  add column if not exists application_number text;

with ordered_requests as (
  select
    id,
    to_char(created_at at time zone 'Asia/Seoul', 'YYYYMMDD') as day_prefix,
    row_number() over (
      partition by (created_at at time zone 'Asia/Seoul')::date
      order by created_at, id
    ) as daily_sequence
  from public.enrollment_requests
)
update public.enrollment_requests r
set application_number =
  o.day_prefix ||
  lpad(o.daily_sequence::text, greatest(3, length(o.daily_sequence::text)), '0')
from ordered_requests o
where r.id = o.id and r.application_number is null;

insert into public.enrollment_request_daily_sequences (reception_day, last_sequence)
select
  (created_at at time zone 'Asia/Seoul')::date,
  count(*)::integer
from public.enrollment_requests
group by (created_at at time zone 'Asia/Seoul')::date
on conflict (reception_day)
do update set last_sequence =
  greatest(
    public.enrollment_request_daily_sequences.last_sequence,
    excluded.last_sequence
  );

create unique index if not exists enrollment_requests_application_number_unique
  on public.enrollment_requests (application_number);
alter table public.enrollment_requests
  alter column application_number set not null;

create or replace function public.set_enrollment_application_number()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  reception_day date;
  next_sequence integer;
begin
  reception_day := (
    coalesce(new.created_at, now()) at time zone 'Asia/Seoul'
  )::date;
  insert into public.enrollment_request_daily_sequences (reception_day, last_sequence)
  values (reception_day, 1)
  on conflict (reception_day)
    do update set last_sequence =
      public.enrollment_request_daily_sequences.last_sequence + 1
  returning last_sequence into next_sequence;

  -- Never trust a client-supplied display number.
  new.application_number :=
    to_char(reception_day, 'YYYYMMDD') ||
    lpad(next_sequence::text, greatest(3, length(next_sequence::text)), '0');
  return new;
end;
$$;

create or replace function public.prevent_enrollment_application_number_change()
returns trigger
language plpgsql
as $$
begin
  if new.application_number is distinct from old.application_number then
    raise exception '수강신청 접수번호는 변경할 수 없습니다.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_enrollment_application_number
  on public.enrollment_requests;
create trigger trg_set_enrollment_application_number
  before insert on public.enrollment_requests
  for each row execute function public.set_enrollment_application_number();

drop trigger if exists trg_prevent_enrollment_application_number_change
  on public.enrollment_requests;
create trigger trg_prevent_enrollment_application_number_change
  before update of application_number on public.enrollment_requests
  for each row execute function public.prevent_enrollment_application_number_change();
