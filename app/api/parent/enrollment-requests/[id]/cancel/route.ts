import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * The applicant may withdraw an unassigned/unpaid pending request.
 * A paid or allocated enrollment must use the existing refund/change workflow.
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
  const { data: existing, error: lookupError } = await admin.from("enrollment_requests")
    .select("id,status,request_type,applicant_user_id,assigned_teacher_user_id,assignment_confirmed_at,admin_note")
    .eq("id", requestId)
    .eq("applicant_user_id", user.id)
    .maybeSingle();

  if (lookupError) return NextResponse.json({ error: "신청 내용을 확인할 수 없습니다." }, { status: 500 });
  if (!existing || existing.request_type !== "custom") {
    return NextResponse.json({ error: "본인 신청을 찾을 수 없습니다." }, { status: 404 });
  }
  if (existing.status !== "pending" || existing.assigned_teacher_user_id || existing.assignment_confirmed_at) {
    return NextResponse.json({ error: "이미 배정되거나 처리된 신청은 이 화면에서 취소할 수 없습니다." }, { status: 409 });
  }

  const [payments, enrollments] = await Promise.all([
    admin.from("enrollment_payments").select("id").eq("enrollment_request_id", requestId).limit(1),
    admin.from("enrollments").select("id").eq("source_enrollment_request_id", requestId).limit(1),
  ]);
  if (payments.error || enrollments.error) {
    return NextResponse.json({ error: "결제 및 수강 상태 확인에 실패했습니다. 취소하지 않았습니다." }, { status: 500 });
  }
  if ((payments.data?.length ?? 0) > 0 || (enrollments.data?.length ?? 0) > 0) {
    return NextResponse.json({ error: "결제 또는 수강 배정 정보가 있어 고객센터를 통해 처리해야 합니다." }, { status: 409 });
  }

  const now = new Date().toISOString();
  const note = [existing.admin_note, `[${now}] 신청자 직접 취소 (미배정·미결제)`]
    .filter(Boolean).join("\n");
  const { data: updated, error: updateError } = await admin.from("enrollment_requests")
    .update({ status: "cancelled", admin_note: note, updated_at: now })
    .eq("id", requestId)
    .eq("applicant_user_id", user.id)
    .eq("status", "pending")
    .is("assigned_teacher_user_id", null)
    .is("assignment_confirmed_at", null)
    .select("id").maybeSingle();

  if (updateError) {
    return NextResponse.json({ error: "취소 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
  if (!updated) {
    return NextResponse.json({ error: "신청 상태가 변경되었습니다. 새로고침 후 확인해 주세요." }, { status: 409 });
  }
  return NextResponse.json({ success: true, status: "cancelled" });
}
