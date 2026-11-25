import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { activatePaidEnrollment } from "@/lib/enrollment/activate-paid-enrollment";

type RouteContext = { params: Promise<{ id: string }> };

// Admin-only, explicit retry for an already paid and assigned enrollment request.
// No payment is created or charged by this route.
export async function POST(_request: Request, context: RouteContext) {
  const requestId = Number((await context.params).id);
  if (!Number.isInteger(requestId) || requestId <= 0) {
    return NextResponse.json({ error: "수강신청 ID가 올바르지 않습니다." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const { data: profile, error: profileError } = await supabase
    .from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profileError || profile?.role !== "admin") {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: enrollmentRequest, error: requestError } = await admin
    .from("enrollment_requests")
    .select("id,assigned_teacher_user_id,assignment_confirmed_at")
    .eq("id", requestId).maybeSingle();
  if (requestError || !enrollmentRequest) {
    return NextResponse.json({ error: "수강신청을 찾을 수 없습니다." }, { status: 404 });
  }
  if (!enrollmentRequest.assigned_teacher_user_id || !enrollmentRequest.assignment_confirmed_at) {
    return NextResponse.json({ error: "먼저 강사와 수업 일정을 확정해 주세요." }, { status: 409 });
  }
  const { data: payments, error: paymentError } = await admin
    .from("enrollment_payments").select("id,status,created_at")
    .eq("enrollment_request_id", requestId).eq("status", "paid")
    .order("created_at", { ascending: false }).limit(1);
  if (paymentError) {
    return NextResponse.json({ error: "결제 상태를 확인할 수 없습니다." }, { status: 500 });
  }
  const paymentId = payments?.[0]?.id;
  if (!paymentId) {
    return NextResponse.json({ error: "결제가 완료된 주문이 없습니다." }, { status: 409 });
  }

  try {
    const result = await activatePaidEnrollment(paymentId);
    return NextResponse.json({ success: true, enrollment: result });
  } catch (error) {
    console.error("[ADMIN ENROLLMENT ACTIVATION RETRY] failed", { requestId, error });
    return NextResponse.json({
      success: false,
      error: "수강 활성화가 완료되지 않았습니다. 수강정보 및 수업 일정 상태를 확인해 주세요."
    }, { status: 409 });
  }
}
