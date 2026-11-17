-- Prevent admin manual assignment from bypassing active direct-checkout reservations.
-- Uses the same per-teacher advisory lock as reserve_direct_checkout.
create or replace function public.guard_manual_assignment_direct_holds()
returns trigger language plpgsql security definer set search_path = ''
as $body$
declare
  v_day text;
  v_start time;
  v_end time;
  v_min_date date;
  v_max_date date;
begin
  if new.checkout_mode='direct' or new.status<>'approved'
    or new.assigned_teacher_user_id is null or new.assignment_confirmed_at is null
    or new.assigned_days is null or new.assigned_times is null then
    return new;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.assigned_teacher_user_id::text,8017)
  );
  v_min_date := greatest(coalesce(new.start_date,(now() at time zone 'Asia/Seoul')::date),
    (now() at time zone 'Asia/Seoul')::date);
  v_max_date := v_min_date + least(greatest(coalesce(new.duration_months,12),1),12)*28 + 7;
  foreach v_day in array new.assigned_days loop
    if (new.assigned_times->>v_day) is null then continue; end if;
    v_start := (new.assigned_times->>v_day)::time;
    v_end := v_start + (coalesce(new.assigned_lesson_duration_minutes,25)||' minutes')::interval;
    if exists(select 1 from public.direct_checkout_slots s
      where s.teacher_user_id=new.assigned_teacher_user_id
        and (s.reservation_state='paid' or s.expires_at>now())
        and (s.scheduled_start at time zone 'Asia/Seoul')::date between v_min_date and v_max_date
        and trim(to_char(s.scheduled_start at time zone 'Asia/Seoul','Day'))=v_day
        and (s.scheduled_start at time zone 'Asia/Seoul')::time<v_end
        and (s.scheduled_end at time zone 'Asia/Seoul')::time>v_start
    ) then
      raise exception '이미 즉시결제로 확보된 강사 수업시간입니다. 다른 시간 또는 강사를 선택해 주세요.'
        using errcode='23505';
    end if;
  end loop;
  return new;
end;
$body$;
drop trigger if exists guard_manual_assignment_direct_holds on public.enrollment_requests;
create trigger guard_manual_assignment_direct_holds
 before update of assigned_teacher_user_id,assigned_days,assigned_times,assignment_confirmed_at
 on public.enrollment_requests
 for each row execute function public.guard_manual_assignment_direct_holds();
revoke all on function public.guard_manual_assignment_direct_holds() from public,anon,authenticated;
