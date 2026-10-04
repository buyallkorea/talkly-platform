import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { createClient } from "@/lib/supabase-server";
import {
  getTeacherEvaluationRequirementForSession,
  type ExistingTeacherEvaluation,
  type TeacherEvaluationSession,
} from "@/lib/teacher-evaluations";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function validScore(value: unknown) {
  const score = Number(value);

  return (
    Number.isInteger(score) &&
    score >= 1 &&
    score <= 5
  );
}

function cleanText(value: unknown) {
  if (typeof value !== "string") return null;

  const text = value.trim();

  return text || null;
}

export async function POST(
  request: Request,
  { params }: RouteContext
) {
  const { sessionId } = await params;
  const numericSessionId = Number(sessionId);

  if (
    !Number.isInteger(numericSessionId) ||
    numericSessionId <= 0
  ) {
    return jsonError("잘못된 수업 ID입니다.", 400);
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonError("로그인이 필요합니다.", 401);
  }

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return jsonError(profileError.message, 500);
  }

  if (!profile || profile.role !== "teacher") {
    return jsonError(
      "강사만 학생 종합평가를 작성할 수 있습니다.",
      403
    );
  }

  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch {
    return jsonError(
      "평가 데이터를 확인할 수 없습니다.",
      400
    );
  }

  const scoreFields = [
    body.participationScore,
    body.comprehensionScore,
    body.speakingScore,
    body.pronunciationScore,
  ];

  if (!scoreFields.every(validScore)) {
    return jsonError(
      "4개 종합평가 점수는 모두 1~5점이어야 합니다.",
      400
    );
  }

  const admin = createAdminClient();

  const {
    data: session,
    error: sessionError,
  } = await admin
    .from("class_sessions")
    .select(
      "id, enrollment_id, lesson_number, scheduled_start, status"
    )
    .eq("id", numericSessionId)
    .maybeSingle();

  if (sessionError || !session) {
    return jsonError(
      "수업 정보를 찾을 수 없습니다.",
      404
    );
  }

  const {
    data: enrollment,
    error: enrollmentError,
  } = await admin
    .from("enrollments")
    .select(
      "id, teacher_user_id, start_date, total_lessons"
    )
    .eq("id", session.enrollment_id)
    .maybeSingle();

  if (enrollmentError || !enrollment) {
    return jsonError(
      "수강 정보를 찾을 수 없습니다.",
      404
    );
  }

  /*
   * 월간평가와 최종평가는 실제 해당 수업을 진행한
   * 대체강사가 아니라 수강의 정규 담당 강사가 작성한다.
   */
  if (enrollment.teacher_user_id !== user.id) {
    return jsonError(
      "수강 담당 강사만 학생 종합평가를 작성할 수 있습니다.",
      403
    );
  }

  if (session.status !== "completed") {
    return jsonError(
      "수업이 완료된 후 평가를 작성할 수 있습니다.",
      409
    );
  }

  const {
    data: sessionData,
    error: sessionsError,
  } = await admin
    .from("class_sessions")
    .select(
      "id, enrollment_id, lesson_number, scheduled_start, status"
    )
    .eq("enrollment_id", enrollment.id)
    .order("scheduled_start", {
      ascending: true,
    });

  if (sessionsError) {
    return jsonError(
      `수업 목록 확인 실패: ${sessionsError.message}`,
      500
    );
  }

  const sessions =
    (sessionData ?? []) as TeacherEvaluationSession[];

  const sessionIds = sessions.map(
    (item) => item.id
  );

  let existingEvaluations:
    ExistingTeacherEvaluation[] = [];

  if (sessionIds.length > 0) {
    const {
      data: evaluationData,
      error: evaluationError,
    } = await admin
      .from("evaluations")
      .select(
        "class_session_id, evaluation_type, period_number"
      )
      .in("class_session_id", sessionIds);

    if (evaluationError) {
      return jsonError(
        `기존 평가 확인 실패: ${evaluationError.message}`,
        500
      );
    }

    existingEvaluations =
      (evaluationData ??
        []) as ExistingTeacherEvaluation[];
  }

  const requirement =
    getTeacherEvaluationRequirementForSession({
      sessionId: numericSessionId,
      enrollmentId: enrollment.id,
      startDate: enrollment.start_date,
      totalLessons: enrollment.total_lessons,
      sessions,
      existingEvaluations,
    });

  if (!requirement) {
    return jsonError(
      "이 수업은 월간평가 또는 최종평가 대상이 아닙니다.",
      409
    );
  }

  const payload = {
    class_session_id: numericSessionId,

    // 평가 작성자는 실제 수업 진행 강사가 아니라
    // 수강의 정규 담당 강사다.
    teacher_user_id: user.id,

    evaluation_type: requirement.type,
    period_number: requirement.periodNumber,

    participation_score: Number(
      body.participationScore
    ),
    comprehension_score: Number(
      body.comprehensionScore
    ),
    speaking_score: Number(
      body.speakingScore
    ),
    pronunciation_score: Number(
      body.pronunciationScore
    ),

    strengths: cleanText(body.strengths),
    improvements: cleanText(body.improvements),
    homework: cleanText(body.homework),
    teacher_comment: cleanText(
      body.teacherComment
    ),

    updated_at: new Date().toISOString(),
  };

  /*
   * evaluations.class_session_id에는 UNIQUE 제약조건이 있다.
   *
   * 기존의
   * SELECT -> INSERT / UPDATE
   * 방식 대신 upsert를 사용하여 동일 수업에 대한
   * 동시 저장 요청에서도 중복 INSERT 충돌을 방지한다.
   */
  const {
    error: saveError,
  } = await admin
    .from("evaluations")
    .upsert(payload, {
      onConflict: "class_session_id",
    });

  if (saveError) {
    return jsonError(
      `종합평가 저장 실패: ${saveError.message}`,
      500
    );
  }

  return NextResponse.json({
    ok: true,
    sessionId: numericSessionId,
    evaluationType: requirement.type,
    periodNumber: requirement.periodNumber,
  });
}