import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

type RouteContext = { params: Promise<{ id: string }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Student/parent direct checkout: only the service-role database function may
 * allocate slots and approve a previously validated custom application.
 */
export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const requestId = Number(id);
  if (!Number.isSafeInteger(requestId) || requestId <= 0) {
    return NextResponse.json({ error: "수강신청 번호가 올바르지 않습니다." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!profile || !["parent", "student"].includes(profile.role)) {
    return NextResponse.json({ error: "수강신청자만 이용할 수 있습니다." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const teacherUserId = typeof body?.teacherUserId === "string" ? body.teacherUserId.trim() : "";
  if (!UUID.test(teacherUserId)) {
    return NextResponse.json({ error: "수업 가능한 강사를 다시 선택해 주세요." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: enrollment, error: lookupError } = await admin.from("enrollment_requests")
    .select("id,applicant_user_id,child_id,request_type,status")
    .eq("id", requestId).eq("applicant_user_id", user.id).maybeSingle();
  if (lookupError) {
    console.error("[DIRECT CHECKOUT] application lookup failed", lookupError);
    return NextResponse.json({ error: "신청 정보를 확인하지 못했습니다." }, { status: 500 });
  }
  if (!enrollment || enrollment.request_type !== "custom" ||
    (profile.role === "parent" && enrollment.child_id === null) ||
    (profile.role === "student" && enrollment.child_id !== null)) {
    return NextResponse.json({ error: "신청 내역 또는 신청자 유형이 올바르지 않습니다." }, { status: 403 });
  }
  if (enrollment.status !== "pending") {
    return NextResponse.json({ error: "이미 처리 중인 신청입니다. 신청 현황을 확인해 주세요." }, { status: 409 });
  }

  const { data, error } = await admin.rpc("reserve_direct_checkout", {
    p_request_id: requestId,
    p_actor: user.id,
    p_teacher_id: teacherUserId,
  });
  if (error) {
    console.error("[DIRECT CHECKOUT] booking failed", error);
    return NextResponse.json({ error: "수업 시간을 확보하지 못했습니다. 다른 시간 또는 관리자 상담을 이용해 주세요." }, { status: 409 });
  }
  const result = data as { ok?: boolean; error?: string; finalPrice?: number; totalLessons?: number } | null;
  if (!result?.ok) {
    return NextResponse.json({ error: result?.error || "강사 일정을 확보하지 못했습니다." }, { status: 409 });
  }
  const href = profile.role === "parent"
    ? `/parent/children/${enrollment.child_id}/enrollment-requests/${requestId}`
    : `/student/enrollment-requests/${requestId}`;
  return NextResponse.json({ success: true, href, finalPrice: result.finalPrice, totalLessons: result.totalLessons });
}
