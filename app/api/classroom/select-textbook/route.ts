
import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase-admin";
import { createClient } from "@/lib/supabase-server";

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status }
  );
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return jsonError("로그인이 필요합니다.", 401);
    }

    let body: {
      sessionId?: unknown;
      textbookId?: unknown;
    };

    try {
      body = await request.json();
    } catch {
      return jsonError("요청 데이터가 올바르지 않습니다.", 400);
    }

    const sessionId = body?.sessionId;
    const textbookId = body?.textbookId;

    if (
      typeof sessionId !== "number" ||
      !Number.isSafeInteger(sessionId) ||
      sessionId <= 0 ||
      typeof textbookId !== "number" ||
      !Number.isSafeInteger(textbookId) ||
      textbookId <= 0
    ) {
      return jsonError(
        "수업 ID 또는 교재 ID가 올바르지 않습니다.",
        400
      );
    }

    const admin = createAdminClient();

    // 1. 사용자 권한 확인
    const { data: profile, error: profileError } =
      await admin
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    if (
      !profile ||
      !["teacher", "admin"].includes(profile.role)
    ) {
      return jsonError(
        "교재를 선택할 권한이 없습니다.",
        403
      );
    }

    // 2. 수업 정보 확인
    const { data: session, error: sessionError } =
      await admin
        .from("class_sessions")
        .select(
          "id, enrollment_id, teacher_user_id, is_external_teacher"
        )
        .eq("id", sessionId)
        .maybeSingle();

    if (sessionError) {
      throw sessionError;
    }

    if (!session) {
      return jsonError(
        "수업 정보를 찾을 수 없습니다.",
        404
      );
    }

    // 3. 수강등록 및 기본 담당 강사 확인
    const { data: enrollment, error: enrollmentError } =
      await admin
        .from("enrollments")
        .select("id, teacher_user_id")
        .eq("id", session.enrollment_id)
        .maybeSingle();

    if (enrollmentError) {
      throw enrollmentError;
    }

    if (!enrollment) {
      return jsonError(
        "수강등록 정보를 찾을 수 없습니다.",
        404
      );
    }

    // 4. 해당 수업 담당 강사 또는 관리자만 허용
    if (profile.role !== "admin") {
      const assignedTeacherId =
        session.teacher_user_id ??
        enrollment.teacher_user_id;

      if (
        session.is_external_teacher === true ||
        assignedTeacherId !== user.id
      ) {
        return jsonError(
          "해당 수업의 담당 강사만 교재를 선택할 수 있습니다.",
          403
        );
      }
    }

    // 5. 학생에게 배정된 활성 교재인지 확인
    const { data: assignment, error: assignmentError } =
      await admin
        .from("enrollment_textbooks")
        .select("id")
        .eq("enrollment_id", session.enrollment_id)
        .eq("textbook_id", textbookId)
        .in("status", ["assigned", "in_use"])
        .limit(1)
        .maybeSingle();

    if (assignmentError) {
      throw assignmentError;
    }

    if (!assignment) {
      return jsonError(
        "학생에게 배정되지 않았거나 해제된 교재입니다.",
        403
      );
    }

    // 6. 사용 가능한 교재인지 확인
    const { data: textbook, error: textbookError } =
      await admin
        .from("textbooks")
        .select("id")
        .eq("id", textbookId)
        .eq("is_active", true)
        .eq("status", "ready")
        .maybeSingle();

    if (textbookError) {
      throw textbookError;
    }

    if (!textbook) {
      return jsonError(
        "현재 사용할 수 없는 교재입니다.",
        400
      );
    }

    // 7. 수업별 선택 교재 저장
    const { data: updatedSession, error: updateError } =
      await admin
        .from("class_sessions")
        .update({
          selected_textbook_id: textbookId,
        })
        .eq("id", sessionId)
        .select("id, selected_textbook_id")
        .single();

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      sessionId: updatedSession.id,
      textbookId: updatedSession.selected_textbook_id,
    });
  } catch (error) {
    console.error(
      "[TALKLY] Select textbook error:",
      error
    );

    return jsonError(
      "교재 선택을 저장하는 중 오류가 발생했습니다.",
      500
    );
  }
}
