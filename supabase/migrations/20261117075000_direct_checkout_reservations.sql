-- TALKLY: server-only, transactionally reserved direct checkout.
-- No client may read or modify reservation slots through PostgREST.
alter table public.enrollment_requests
  add column if not exists checkout_mode text not null default 'consultation';
alter table public.enrollment_requests
  drop constraint if exists enrollment_requests_checkout_mode_check;
alter table public.enrollment_requests
  add constraint enrollment_requests_checkout_mode_check
  check (checkout_mode in ('consultation', 'direct'));

create table if not exists public.direct_checkout_slots (
  teacher_user_id uuid not null references public.teacher_profiles(user_id),
  scheduled_start timestamptz not null,
  scheduled_end timestamptz not null,
  enrollment_request_id bigint not null references public.enrollment_requests(id) on delete cascade,
  reservation_state text not null default 'held' check (reservation_state in ('held','paid')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (teacher_user_id, scheduled_start),
  check (scheduled_end > scheduled_start)
);
create index if not exists direct_checkout_slots_request_idx
  on public.direct_checkout_slots(enrollment_request_id);
alter table public.direct_checkout_slots enable row level security;
revoke all on public.direct_checkout_slots from public, anon, authenticated;
grant select, insert, update, delete on public.direct_checkout_slots to service_role;

create or replace function public.reserve_direct_checkout(
  p_request_id bigint, p_actor uuid, p_teacher_id uuid
) returns jsonb
language plpgsql security definer set search_path = ''
as $body$
declare
  v_req public.enrollment_requests%rowtype;
  v_teacher public.teacher_profiles%rowtype;
  v_price public.course_pricing%rowtype;
  v_discount numeric;
  v_cat text;
  v_duration integer;
  v_count integer;
  v_regular integer;
  v_discount_amount integer;
  v_final integer;
  v_tomorrow date := (now() at time zone 'Asia/Seoul')::date + 1;
  v_d date;
  v_day text;
  v_weekday integer;
  v_time_text text;
  v_time time;
  v_end_time time;
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_starts timestamptz[] := array[]::timestamptz[];
  v_ends timestamptz[] := array[]::timestamptz[];
  v_i integer;
begin
  select * into v_req from public.enrollment_requests
    where id=p_request_id and applicant_user_id=p_actor for update;
  if not found then
    return jsonb_build_object('ok',false,'error','본인의 수강신청을 확인할 수 없습니다.');
  end if;
  if v_req.status <> 'pending' or v_req.request_type <> 'custom'
     or v_req.checkout_mode <> 'consultation' or v_req.assigned_teacher_user_id is not null then
    return jsonb_build_object('ok',false,'error','이미 처리 중인 신청입니다. 신청 내역을 확인해 주세요.');
  end if;
  if v_req.lesson_duration_minutes <> 25
     or v_req.lessons_per_week not in (2,3,5)
     or coalesce(array_length(v_req.preferred_days,1),0) <> v_req.lessons_per_week
     or (select count(distinct x) from unnest(v_req.preferred_days) x) <> v_req.lessons_per_week
     or v_req.preferred_days && array['Saturday','Sunday']::text[]
     or exists(select 1 from unnest(v_req.preferred_days) x
          where x not in ('Monday','Tuesday','Wednesday','Thursday','Friday')) then
    return jsonb_build_object('ok',false,'error','직접 결제는 평일 25분·주 2·3·5회 수업에만 가능합니다.');
  end if;
  if v_req.start_date is null or v_req.start_date < v_tomorrow then
    return jsonb_build_object('ok',false,'error','바로 결제는 내일 이후를 첫 수업 시작 기준일로 선택해 주세요.');
  end if;
  v_duration := v_req.duration_months;
  if v_duration not in (1,3,6,12) then
    return jsonb_build_object('ok',false,'error','수강기간을 다시 선택해 주세요.');
  end if;
  select * into v_teacher from public.teacher_profiles
   where user_id=p_teacher_id and is_active=true;
  if not found then
    return jsonb_build_object('ok',false,'error','강사가 현재 수업을 진행할 수 없습니다.');
  end if;
  if v_req.teacher_preference_type='specific'
     and v_req.preferred_teacher_user_id is distinct from p_teacher_id then
    return jsonb_build_object('ok',false,'error','선택하신 강사와 배정 강사가 일치하지 않습니다.');
  end if;
  v_cat := case
    when lower(coalesce(v_teacher.nationality,'')) like '%필리핀%'
      or lower(coalesce(v_teacher.nationality,'')) like '%philipp%' then 'philippines'
    when lower(coalesce(v_teacher.nationality,'')) like '%미국%'
      or lower(coalesce(v_teacher.nationality,'')) like '%캐나다%'
      or lower(coalesce(v_teacher.nationality,'')) like '%united states%'
      or lower(coalesce(v_teacher.nationality,'')) like '%american%'
      or lower(coalesce(v_teacher.nationality,'')) like '%canad%'
      or lower(coalesce(v_teacher.nationality,'')) in ('us','usa') then 'special'
    else 'western' end;
  if v_cat is distinct from v_req.pricing_category then
    return jsonb_build_object('ok',false,'error','강사 구분과 신청 수강료가 일치하지 않습니다.');
  end if;
  select * into v_price from public.course_pricing
   where course_id=v_req.course_id and lesson_duration_minutes=25
     and lessons_per_week=v_req.lessons_per_week and pricing_category=v_cat
     and is_active=true limit 1;
  if not found or v_price.price_per_lesson <= 0
     or v_price.monthly_lesson_count <> v_req.lessons_per_week*4 then
    return jsonb_build_object('ok',false,'error','해당 강사·교육과정의 수강료 설정을 확인해 주세요.');
  end if;
  select discount_rate into v_discount from public.enrollment_discount_policies
   where duration_months=v_duration and is_active=true limit 1;
  if not found or v_discount < 0 or v_discount > 100 then
    return jsonb_build_object('ok',false,'error','기간별 할인정책을 확인해 주세요.');
  end if;
  v_count := v_price.monthly_lesson_count * v_duration;
  v_regular := v_price.price_per_lesson * v_count;
  v_discount_amount := round(v_regular * v_discount/100)::integer;
  v_final := v_regular-v_discount_amount;
  if v_final <= 0 then
    return jsonb_build_object('ok',false,'error','결제금액 계산에 실패했습니다.');
  end if;

  -- Serialize direct bookings for the same teacher.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_teacher_id::text, 8017));
  delete from public.direct_checkout_slots where teacher_user_id=p_teacher_id
    and reservation_state='held' and expires_at <= now();

  for v_d in
    select gs::date from pg_catalog.generate_series(
      v_req.start_date::timestamp, (v_req.start_date + interval '3 years')::timestamp,
      interval '1 day') as gs
    where (extract(dow from gs))::integer in
      (select case x when 'Sunday' then 0 when 'Monday' then 1 when 'Tuesday' then 2
                 when 'Wednesday' then 3 when 'Thursday' then 4 when 'Friday' then 5
                 else 6 end from unnest(v_req.preferred_days) x)
    order by gs limit v_count
  loop
    v_weekday := extract(dow from v_d)::integer;
    v_day := (array['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'])[v_weekday+1];
    v_time_text := v_req.preferred_times ->> v_day;
    if v_time_text is null or v_time_text !~ '^([01][0-9]|2[0-3]):(00|30)$' then
      return jsonb_build_object('ok',false,'error','수업시간은 정시 또는 30분만 선택해 주세요.');
    end if;
    v_time := v_time_text::time;
    v_end_time := v_time + interval '25 minutes';
    v_start_at := ((v_d::text || ' ' || v_time_text)::timestamp at time zone 'Asia/Seoul');
    v_end_at := v_start_at + interval '25 minutes';

    if v_start_at <= now() + interval '1 hour' then
      return jsonb_build_object('ok',false,'error','수업 시작시각이 너무 가깝습니다. 시작일을 변경해 주세요.');
    end if;
    if not (
      exists(select 1 from public.teacher_availability a
        where a.teacher_user_id=p_teacher_id and a.day_of_week=v_weekday
          and a.is_available=true and a.start_time<=v_time and a.end_time>=v_end_time
          and (a.effective_from is null or a.effective_from<=v_d)
          and (a.effective_to is null or a.effective_to>=v_d))
      or exists(select 1 from public.teacher_availability_exceptions e
        where e.teacher_user_id=p_teacher_id and e.exception_date=v_d
          and e.is_active=true and e.exception_type='available'
          and e.start_time<=v_time and e.end_time>=v_end_time)
    ) then
      return jsonb_build_object('ok',false,'error',v_d||' 강사의 수업 가능 시간이 아닙니다.');
    end if;
    if exists(select 1 from public.teacher_availability_exceptions e
       where e.teacher_user_id=p_teacher_id and e.exception_date=v_d and e.is_active=true
       and e.exception_type='unavailable'
       and (e.start_time is null or e.end_time is null
            or (e.start_time<v_end_time and e.end_time>v_time))) then
      return jsonb_build_object('ok',false,'error',v_d||' 강사 휴무시간과 겹칩니다.');
    end if;
    if exists(select 1 from public.class_operation_blocks b
       where b.block_date=v_d and b.is_active=true
         and (b.start_time is null or b.end_time is null
              or (b.start_time<v_end_time and b.end_time>v_time))) then
      return jsonb_build_object('ok',false,'error',v_d||' 운영 중단 시간과 겹칩니다.');
    end if;
    if exists(select 1 from public.class_sessions s
       where s.teacher_user_id=p_teacher_id and s.status<>'cancelled'
         and s.scheduled_start<v_end_at and s.scheduled_end>v_start_at) then
      return jsonb_build_object('ok',false,'error',v_d||' 기존 수업 예약과 겹칩니다.');
    end if;
    if exists(select 1 from public.direct_checkout_slots h
       where h.teacher_user_id=p_teacher_id
         and (h.reservation_state='paid' or h.expires_at>now())
         and h.scheduled_start<v_end_at and h.scheduled_end>v_start_at) then
      return jsonb_build_object('ok',false,'error',v_d||' 결제 대기 중인 예약과 겹칩니다.');
    end if;
    -- Respect already approved manual applications before they create sessions.
    if exists(select 1 from public.enrollment_requests r
       where r.id<>p_request_id and r.assigned_teacher_user_id=p_teacher_id
         and r.status='approved' and v_day=any(r.assigned_days)
         and (r.start_date is null or r.start_date<=v_d)
         and (r.duration_months is null or r.start_date is null
              or r.start_date+(r.duration_months*28+7)>=v_d)
         and (r.assigned_times->>v_day) is not null
         and (r.assigned_times->>v_day)::time<v_end_time
         and ((r.assigned_times->>v_day)::time + (coalesce(r.assigned_lesson_duration_minutes,25)||' minutes')::interval)>v_time) then
      return jsonb_build_object('ok',false,'error',v_d||' 다른 확정 신청과 겹칩니다.');
    end if;
    v_starts := array_append(v_starts,v_start_at);
    v_ends := array_append(v_ends,v_end_at);
  end loop;
  if coalesce(array_length(v_starts,1),0) <> v_count then
    return jsonb_build_object('ok',false,'error','전체 수업 가능 시간을 확보하지 못했습니다.');
  end if;

  for v_i in 1..v_count loop
    insert into public.direct_checkout_slots(
      teacher_user_id,scheduled_start,scheduled_end,enrollment_request_id,
      reservation_state,expires_at)
    values(p_teacher_id,v_starts[v_i],v_ends[v_i],p_request_id,'held',now()+interval '20 minutes');
  end loop;
  update public.enrollment_requests set
    checkout_mode='direct', status='approved',
    assigned_teacher_user_id=p_teacher_id, assigned_days=preferred_days,
    assigned_times=preferred_times, assigned_lesson_duration_minutes=25,
    assigned_lessons_per_week=lessons_per_week, assigned_at=now(), assignment_confirmed_at=now(),
    course_pricing_id=v_price.id, pricing_category=v_cat,
    monthly_lesson_count=v_price.monthly_lesson_count,
    regular_price=v_regular, discount_rate=v_discount, discount_amount=v_discount_amount,
    final_price=v_final, total_lessons=v_count, updated_at=now()
  where id=p_request_id;
  return jsonb_build_object('ok',true,'requestId',p_request_id,
     'teacherId',p_teacher_id,'finalPrice',v_final,'totalLessons',v_count);
end;
$body$;

create or replace function public.check_direct_checkout_hold(
  p_request_id bigint, p_actor uuid, p_extend_minutes integer default 0
) returns boolean
language plpgsql security definer set search_path = ''
as $body$
declare
  v_req public.enrollment_requests%rowtype;
  v_slots integer;
begin
  select * into v_req from public.enrollment_requests
   where id=p_request_id and applicant_user_id=p_actor for update;
  if not found then return false; end if;
  if v_req.checkout_mode <> 'direct' then return true; end if;
  if v_req.status <> 'approved' or v_req.assigned_teacher_user_id is null
     or v_req.monthly_lesson_count is null or v_req.duration_months is null then
    return false;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_req.assigned_teacher_user_id::text,8017));
  select count(*) into v_slots from public.direct_checkout_slots
   where enrollment_request_id=p_request_id and teacher_user_id=v_req.assigned_teacher_user_id
     and (reservation_state='paid' or expires_at>now());
  if v_slots <> v_req.monthly_lesson_count*v_req.duration_months then return false; end if;
  if p_extend_minutes>0 then
    update public.direct_checkout_slots set expires_at=now()+(least(p_extend_minutes,60)*interval '1 minute')
     where enrollment_request_id=p_request_id and reservation_state='held';
  end if;
  return true;
end;
$body$;

create or replace function public.mark_direct_checkout_paid(p_request_id bigint)
returns boolean language plpgsql security definer set search_path = ''
as $body$
begin
  if not exists(select 1 from public.enrollment_requests
    where id=p_request_id and checkout_mode='direct') then return false; end if;
  if not exists(select 1 from public.enrollment_payments
    where enrollment_request_id=p_request_id and status='paid') then return false; end if;
  update public.direct_checkout_slots set reservation_state='paid',
    expires_at='infinity'::timestamptz
    where enrollment_request_id=p_request_id;
  return found;
end;
$body$;

revoke all on function public.reserve_direct_checkout(bigint,uuid,uuid) from public, anon, authenticated;
revoke all on function public.check_direct_checkout_hold(bigint,uuid,integer) from public, anon, authenticated;
revoke all on function public.mark_direct_checkout_paid(bigint) from public, anon, authenticated;
grant execute on function public.reserve_direct_checkout(bigint,uuid,uuid) to service_role;
grant execute on function public.check_direct_checkout_hold(bigint,uuid,integer) to service_role;
grant execute on function public.mark_direct_checkout_paid(bigint) to service_role;
