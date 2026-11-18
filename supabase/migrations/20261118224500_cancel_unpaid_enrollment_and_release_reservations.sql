-- Permit an applicant to withdraw a still-unpaid request even if its teacher
-- was provisionally assigned. Release stale checkout holds and invalidate
-- prepared orders atomically, retaining every historical receipt and consent.
-- The RPC is callable only by service_role AFTER server-side authentication.

create or replace function public.cancel_unpaid_enrollment_request(
  p_request_id bigint,
  p_actor uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_request public.enrollment_requests%rowtype;
  v_reason text := btrim(coalesce(p_reason,''));
  v_paid_states integer;
  v_live_enrollments integer;
  v_paid_reservations integer;
  v_cancelled_orders integer;
  v_released_slots integer;
  v_now timestamptz := now();
begin
  if p_request_id is null or p_request_id <= 0 or p_actor is null then
    raise exception '신청번호 또는 신청자 정보가 올바르지 않습니다.';
  end if;
  if char_length(v_reason) < 3 or char_length(v_reason) > 1000 then
    raise exception '취소 사유는 3~1,000자 이내로 입력해 주세요.';
  end if;

  -- Lock the application first: multiple cancels serialize here.
  select * into v_request
  from public.enrollment_requests
  where id = p_request_id and applicant_user_id = p_actor
  for update;

  if not found or v_request.request_type <> 'custom' then
    raise exception '본인의 맞춤 수강신청을 찾을 수 없습니다.';
  end if;
  if v_request.status not in ('pending','approved') then
    raise exception '이미 종료된 수강신청입니다.';
  end if;

  -- Payment approval races serialize on the payment records.
  perform id from public.enrollment_payments
  where enrollment_request_id = p_request_id
  order by id for update;

  select count(*) into v_paid_states
  from public.enrollment_payments
  where enrollment_request_id=p_request_id
    and status in ('requested','confirming','paid');
  if v_paid_states > 0 then
    raise exception '결제 승인 중이거나 결제 완료된 신청은 이 화면에서 취소할 수 없습니다. 고객센터에 문의해 주세요.';
  end if;

  select count(*) into v_live_enrollments
  from public.enrollments
  where source_enrollment_request_id=p_request_id;
  if v_live_enrollments > 0 then
    raise exception '실제 수업이 생성된 신청입니다. 별도 수강 취소 절차를 이용해 주세요.';
  end if;

  select count(*) into v_paid_reservations
  from public.direct_checkout_slots
  where enrollment_request_id=p_request_id and reservation_state='paid';
  if v_paid_reservations > 0 then
    raise exception '결제 확정된 수업 예약이 있어 이 화면에서 취소할 수 없습니다.';
  end if;

  -- An old Toss success callback can no longer approve the prepared order:
  -- payment confirmation requires status='ready' and rejects 'cancelled'.
  update public.enrollment_payments
  set status='cancelled', cancelled_at=v_now, updated_at=v_now,
      failure_message='신청자 요청으로 결제 전 수강신청 취소'
  where enrollment_request_id=p_request_id and status='ready';
  get diagnostics v_cancelled_orders = row_count;

  delete from public.direct_checkout_slots
  where enrollment_request_id=p_request_id and reservation_state='held';
  get diagnostics v_released_slots = row_count;

  update public.enrollment_requests
  set status='cancelled', updated_at=v_now,
      admin_note=concat_ws(E'\n',nullif(admin_note,''),
        '['||to_char(v_now at time zone 'Asia/Seoul','YYYY-MM-DD HH24:MI:SS')||
        ' KST] 결제 전 신청 취소: '||v_reason||
        case when v_request.assigned_teacher_user_id is not null
          then ' (해제된 배정 강사 ID: '||v_request.assigned_teacher_user_id::text||')'
          else '' end),
      assigned_teacher_user_id=null,
      assignment_confirmed_at=null,
      assigned_at=null,
      assigned_days=null,
      assigned_times=null,
      assigned_lesson_duration_minutes=null,
      assigned_lessons_per_week=null
  where id=p_request_id;

  return jsonb_build_object(
    'success',true,
    'status','cancelled',
    'applicationNumber',v_request.application_number,
    'cancelledOrders',v_cancelled_orders,
    'releasedSlots',v_released_slots
  );
end;
$$;

revoke all on function public.cancel_unpaid_enrollment_request(bigint,uuid,text)
from public, anon, authenticated;
grant execute on function public.cancel_unpaid_enrollment_request(bigint,uuid,text)
to service_role;
