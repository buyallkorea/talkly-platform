import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { createClient } from "@/lib/supabase-server";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function validScore(value: unknown) {
  const score = Number(value);
  return Number.isInteger(score) && score >= 1 && score <= 5;
}

function cleanText(value: unknown) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text || null;
}

export async function POST(request: Request, { params }: RouteContext) {
  const { sessionId } = await params;
  const numericSessionId = Number(sessionId);

  if (!Number.isInteger(numericSessionId) || numericSessionId <= 0) {
    return jsonError("잘못된 수업 ID입니다.", 400);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return jsonError("로그인이 필요합니다.", 401);

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "teacher") {
    return jsonError("강사만 최종 종합평가를 작성할 수 있습니다.", 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonError("평가 데이터를 확인할 수 없습니다.", 400);
  }

  const scoreFields = [
    body.participationScore,
    body.comprehensionScore,
    body.speakingScore,
    body.pronunciationScore,
  ];

  if (!scoreFields.every(validScore)) {
    return jsonError("4개 종합평가 점수는 모두 1~5점이어야 합니다.", 400);
  }

  const admin = createAdminClient();

  const { data: session, error: sessionError } = await admin
    .from("class_sessions")
    .select("id, enrollment_id, lesson_number, status")
    .eq("id", numericSessionId)
    .maybeSingle();

  if (sessionError || !session) {
    return jsonError("수업 정보를 찾을 수 없습니다.", 404);
  }

  const { data: enrollment, error: enrollmentError } = await admin
    .from("enrollments")
    .select("id, teacher_user_id, total_lessons")
    .eq("id", session.enrollment_id)
    .maybeSingle();

  if (enrollmentError || !enrollment) {
    return jsonError("수강 정보를 찾을 수 없습니다.", 404);
  }

  if (enrollment.teacher_user_id !== user.id) {
    return jsonError("담당 강사만 학생 종합평가를 작성할 수 있습니다.", 403);
  }

  const { data: lastSession, error: lastSessionError } = await admin
    .from("class_sessions")
    .select("lesson_number")
    .eq("enrollment_id", enrollment.id)
    .order("lesson_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastSessionError) {
    return jsonError(`마지막 수업 확인 실패: ${lastSessionError.message}`, 400);
  }

  const finalLessonNumber =
    typeof enrollment.total_lessons === "number" && enrollment.total_lessons > 0
      ? enrollment.total_lessons
      : lastSession?.lesson_number ?? null;

  if (finalLessonNumber === null || session.lesson_number !== finalLessonNumber) {
    return jsonError("강사 종합평가는 마지막 수업에서만 작성할 수 있습니다.", 409);
  }

  if (session.status !== "completed") {
    return jsonError("마지막 수업이 완료된 후 종합평가를 작성할 수 있습니다.", 409);
  }

  const payload = {
    class_session_id: numericSessionId,
    teacher_user_id: user.id,
    participation_score: Number(body.participationScore),
    comprehension_score: Number(body.comprehensionScore),
    speaking_score: Number(body.speakingScore),
    pronunciation_score: Number(body.pronunciationScore),
    strengths: cleanText(body.strengths),
    improvements: cleanText(body.improvements),
    homework: cleanText(body.homework),
    teacher_comment: cleanText(body.teacherComment),
    updated_at: new Date().toISOString(),
  };

  const { data: existingEvaluation, error: existingError } = await admin
    .from("evaluations")
    .select("id")
    .eq("class_session_id", numericSessionId)
    .maybeSingle();

  if (existingError) {
    return jsonError(`기존 종합평가 확인 실패: ${existingError.message}`, 400);
  }

  if (existingEvaluation) {
    const { error } = await admin
      .from("evaluations")
      .update(payload)
      .eq("id", existingEvaluation.id);

    if (error) {
      return jsonError(`최종 종합평가 수정 실패: ${error.message}`, 400);
    }
  } else {
    const { error } = await admin.from("evaluations").insert(payload);

    if (error) {
      return jsonError(`최종 종합평가 저장 실패: ${error.message}`, 400);
    }
  }

  return NextResponse.json({
    ok: true,
    sessionId: numericSessionId,
    finalLessonNumber,
  });
}