import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Applicants can withdraw pending or provisionally assigned unpaid requests.
 * A single database transaction invalidates ready orders, releases held
 * teacher slots, and preserves the historical application/consent records.
 */
export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const requestId = Number(id);
  if (!Number.isSafeInteger(requestId) || requestId <= 0) {
    return NextResponse.json({ error: "신청번호가 올바르지 않습니다." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { data: profile } = await supabase.from("profiles")
    .select("role").eq("id", user.id).maybeSingle();
  if (!profile || !["student", "parent"].includes(profile.role)) {
    return NextResponse.json({ error: "신청자 계정만 취소할 수 있습니다." }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: enrollment, error: lookupError } = await admin
    .from("enrollment_requests")
    .select("id, applicant_user_id, child_id, request_type, status")
    .eq("id", requestId)
    .eq("applicant_user_id", user.id)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json({ error: "신청 정보를 확인하지 못했습니다." }, { status: 500 });
  }
  if (!enrollment || enrollment.request_type !== "custom" ||
      (profile.role === "parent" && enrollment.child_id === null) ||
      (profile.role === "student" && enrollment.child_id !== null)) {
    return NextResponse.json({ error: "본인의 맞춤 수강신청이 아닙니다." }, { status: 404 });
  }
  if (!["pending", "approved"].includes(enrollment.status)) {
    return NextResponse.json({ error: "이미 종료된 신청입니다. 신청 내역을 새로고침해 주세요." }, { status: 409 });
  }

  // One transaction also invalidates ready Toss orders and removes held slots.
  // It refuses cancellation when payment is requested/confirming/paid or
  // when an actual enrollment or paid reservation exists.
  const { data, error } = await admin.rpc("cancel_unpaid_enrollment_request", {
    p_request_id: requestId,
    p_actor: user.id,
    p_reason: "신청자 요청: 결제 전 맞춤 수강신청 취소 및 재신청",
  });
  if (error) {
    console.error("[ENROLLMENT CANCEL] transaction refused", {
      requestId, code: error.code, message: error.message,
    });
    return NextResponse.json({
      error: error.code === "P0001"
        ? error.message
        : "결제·수업 상태를 확인하거나 취소하는 중 오류가 발생했습니다. 신청 상태는 변경하지 않았습니다.",
    }, { status: error.code === "P0001" ? 409 : 500 });
  }
  return NextResponse.json(data);
}
