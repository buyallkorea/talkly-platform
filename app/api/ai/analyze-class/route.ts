import { NextResponse } from "next/server";
import {
  createClient as createAdminClient,
} from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase-server";

import {
  analyzeClassTranscript,
  type AiAnalysis,
} from "@/lib/ai/class-analysis";

type RequestBody = {
  sessionId: number;
  transcript: string;
};

function createAdmin() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase 관리자 환경변수가 설정되지 않았습니다."
    );
  }

  return createAdminClient(
    url,
    key,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

export async function POST(
  request: Request
) {
  try {
    /*
     * ==========================================
     * 로그인 확인
     * ==========================================
     */
    const supabase =
      await createClient();

    const {
      data: { user },
      error: userError,
    } =
      await supabase.auth.getUser();

    if (
      userError ||
      !user
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "로그인이 필요합니다.",
        },
        {
          status: 401,
        }
      );
    }

    /*
     * ==========================================
     * 관리자 권한 확인
     *
     * 현재 analyze-class API는
     * 관리자 수동 테스트용으로 유지합니다.
     *
     * 향후 Zoom Webhook 자동처리는
     * 별도 서버 공용 파이프라인에서
     * analyzeClassTranscript()를 직접 사용합니다.
     * ==========================================
     */
    const {
      data: profile,
      error: profileError,
    } =
      await supabase
        .from("profiles")
        .select("role")
        .eq(
          "id",
          user.id
        )
        .maybeSingle();

    if (
      profileError ||
      !profile ||
      profile.role !==
        "admin"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "관리자 권한이 필요합니다.",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * ==========================================
     * 요청 본문
     * ==========================================
     */
    const body =
      (await request.json()) as
        RequestBody;

    const sessionId =
      Number(
        body.sessionId
      );

    const transcript =
      body.transcript
        ?.trim();

    if (
      !Number.isInteger(
        sessionId
      ) ||
      sessionId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "올바른 수업 ID가 필요합니다.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !transcript ||
      transcript.length < 20
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "분석할 수업 전사문이 너무 짧습니다.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * ==========================================
     * Service Role 관리자 Client
     * ==========================================
     */
    const admin =
      createAdmin();

    /*
     * ==========================================
     * 수업 조회
     * ==========================================
     */
    const {
      data: session,
      error: sessionError,
    } =
      await admin
        .from(
          "class_sessions"
        )
        .select(`
          id,
          enrollment_id,
          lesson_number,
          status,
          scheduled_start,
          scheduled_end
        `)
        .eq(
          "id",
          sessionId
        )
        .maybeSingle();

    if (sessionError) {
      return NextResponse.json(
        {
          success: false,
          error:
            `수업 조회 실패: ${sessionError.message}`,
        },
        {
          status: 500,
        }
      );
    }

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error:
            "수업을 찾을 수 없습니다.",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * ==========================================
     * 현재 수동 테스트 단계에서는
     * completed 상태를 강제하지 않습니다.
     *
     * 향후 Zoom 자동 분석에서는
     * 수업 종료 후 처리하도록
     * process-class-audio / webhook 단계에서
     * 제한할 예정입니다.
     * ==========================================
     */

    /*
     * ==========================================
     * 수강정보 조회
     * ==========================================
     */
    const {
      data: enrollment,
      error: enrollmentError,
    } =
      await admin
        .from(
          "enrollments"
        )
        .select(`
          id,
          student_user_id,
          child_id,
          course_id,
          teacher_user_id
        `)
        .eq(
          "id",
          session.enrollment_id
        )
        .maybeSingle();

    if (
      enrollmentError ||
      !enrollment
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            enrollmentError
              ?.message ||
            "수강정보를 찾을 수 없습니다.",
        },
        {
          status: 500,
        }
      );
    }

    /*
     * ==========================================
     * 학생 이름
     *
     * child_id가 있으면 children 사용
     * 아니면 student_user_id의 profiles 사용
     * ==========================================
     */
    let studentName =
      "Student";

    if (
      enrollment.child_id
    ) {
      const {
        data: child,
        error: childError,
      } =
        await admin
          .from(
            "children"
          )
          .select(
            "name"
          )
          .eq(
            "id",
            enrollment.child_id
          )
          .maybeSingle();

      if (childError) {
        console.error(
          "학생 이름 조회 실패:",
          childError.message
        );
      }

      if (
        child?.name
      ) {
        studentName =
          child.name;
      }
    } else if (
      enrollment.student_user_id
    ) {
      const {
        data: studentProfile,
        error:
          studentProfileError,
      } =
        await admin
          .from(
            "profiles"
          )
          .select(
            "name"
          )
          .eq(
            "id",
            enrollment.student_user_id
          )
          .maybeSingle();

      if (
        studentProfileError
      ) {
        console.error(
          "학생 프로필 조회 실패:",
          studentProfileError.message
        );
      }

      if (
        studentProfile
          ?.name
      ) {
        studentName =
          studentProfile.name;
      }
    }

    /*
     * ==========================================
     * 강사 이름
     *
     * 1순위 teacher_profiles.display_name
     * 2순위 profiles.name
     * ==========================================
     */
    let teacherName =
      "Teacher";

    if (
      enrollment.teacher_user_id
    ) {
      const {
        data: teacherProfile,
        error:
          teacherProfileError,
      } =
        await admin
          .from(
            "teacher_profiles"
          )
          .select(
            "display_name"
          )
          .eq(
            "user_id",
            enrollment.teacher_user_id
          )
          .maybeSingle();

      if (
        teacherProfileError
      ) {
        console.error(
          "강사 프로필 조회 실패:",
          teacherProfileError.message
        );
      }

      if (
        teacherProfile
          ?.display_name
      ) {
        teacherName =
          teacherProfile.display_name;
      } else {
        const {
          data: fallbackTeacher,
          error:
            fallbackTeacherError,
        } =
          await admin
            .from(
              "profiles"
            )
            .select(
              "name"
            )
            .eq(
              "id",
              enrollment.teacher_user_id
            )
            .maybeSingle();

        if (
          fallbackTeacherError
        ) {
          console.error(
            "강사 사용자명 조회 실패:",
            fallbackTeacherError.message
          );
        }

        if (
          fallbackTeacher
            ?.name
        ) {
          teacherName =
            fallbackTeacher.name;
        }
      }
    }

    /*
     * ==========================================
     * 과정명
     * ==========================================
     */
    let courseName =
      "English Class";

    if (
      enrollment.course_id
    ) {
      const {
        data: course,
        error: courseError,
      } =
        await admin
          .from(
            "courses"
          )
          .select(
            "name"
          )
          .eq(
            "id",
            enrollment.course_id
          )
          .maybeSingle();

      if (courseError) {
        console.error(
          "과정명 조회 실패:",
          courseError.message
        );
      }

      if (
        course?.name
      ) {
        courseName =
          course.name;
      }
    }

    /*
     * ==========================================
     * AI 분석 시작 상태 저장
     *
     * 기존 class_session_id가 있으면
     * 해당 리포트를 갱신합니다.
     * ==========================================
     */
    const {
      error: processingError,
    } =
      await admin
        .from(
          "ai_class_reports"
        )
        .upsert(
          {
            class_session_id:
              session.id,

            student_user_id:
              enrollment.student_user_id,

            child_id:
              enrollment.child_id,

            teacher_user_id:
              enrollment.teacher_user_id,

            status:
              "analyzing",

            transcript,

            updated_at:
              new Date().toISOString(),
          },
          {
            onConflict:
              "class_session_id",
          }
        );

    if (
      processingError
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            `AI 분석 상태 저장 실패: ${processingError.message}`,
        },
        {
          status: 500,
        }
      );
    }

    /*
     * ==========================================
     * 공용 TALKLY AI 분석 엔진
     * ==========================================
     */
    let analysis:
      AiAnalysis;

    try {
      analysis =
        await analyzeClassTranscript(
          transcript,
          {
            courseName,

            lessonNumber:
              session.lesson_number,

            studentName,

            teacherName,
          }
        );
    } catch (error) {
      /*
       * AI 분석 실패 시 DB 상태도 failed로 변경
       */
      const {
        error:
          failedUpdateError,
      } =
        await admin
          .from(
            "ai_class_reports"
          )
          .update({
            status:
              "failed",

            updated_at:
              new Date().toISOString(),
          })
          .eq(
            "class_session_id",
            session.id
          );

      if (
        failedUpdateError
      ) {
        console.error(
          "AI 실패 상태 저장 오류:",
          failedUpdateError.message
        );
      }

      throw error;
    }

    /*
     * ==========================================
     * 최종 AI 리포트 저장
     * ==========================================
     */
    const analyzedAt =
      new Date().toISOString();

    const {
      data: savedReport,
      error: saveError,
    } =
      await admin
        .from(
          "ai_class_reports"
        )
        .upsert(
          {
            class_session_id:
              session.id,

            student_user_id:
              enrollment.student_user_id,

            child_id:
              enrollment.child_id,

            teacher_user_id:
              enrollment.teacher_user_id,

            status:
              "completed",

            transcript,

            summary:
              analysis.summary,

            strengths:
              analysis.strengths,

            improvements:
              analysis.improvements,

            grammar_analysis:
              analysis.grammar_analysis,

            vocabulary_analysis:
              analysis.vocabulary_analysis,

            pronunciation_analysis:
              analysis.pronunciation_analysis,

            fluency_analysis:
              analysis.fluency_analysis,

            recommended_practice:
              analysis.recommended_practice,

            student_summary:
              analysis.student_summary,

            parent_summary:
              analysis.parent_summary,

            ai_model:
              "gpt-5-mini",

            analyzed_at:
              analyzedAt,

            updated_at:
              analyzedAt,
          },
          {
            onConflict:
              "class_session_id",
          }
        )
        .select(`
          id,
          class_session_id,
          status,
          summary,
          strengths,
          improvements,
          grammar_analysis,
          vocabulary_analysis,
          pronunciation_analysis,
          fluency_analysis,
          recommended_practice,
          student_summary,
          parent_summary,
          ai_model,
          analyzed_at
        `)
        .single();

    if (
      saveError
    ) {
      /*
       * 최종 저장 실패도 failed로 표시
       */
      await admin
        .from(
          "ai_class_reports"
        )
        .update({
          status:
            "failed",

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "class_session_id",
          session.id
        );

      throw new Error(
        `AI 리포트 저장 실패: ${saveError.message}`
      );
    }

    /*
     * ==========================================
     * 성공 응답
     * ==========================================
     */
    return NextResponse.json({
      success: true,

      message:
        "AI 수업 분석이 완료되었습니다.",

      session: {
        id:
          session.id,

        lessonNumber:
          session.lesson_number,

        studentName,

        teacherName,

        courseName,
      },

      report:
        savedReport,
    });
  } catch (error) {
    console.error(
      "AI CLASS ANALYSIS ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof
          Error
            ? error.message
            : "AI 수업 분석 중 오류가 발생했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}