import {
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@/lib/supabase-server";

import {
  transcribeClassAudio,
} from "@/lib/ai/class-transcription";

export async function POST(
  request: Request
) {
  try {
    /*
     * ==========================================
     * 로그인
     * ==========================================
     */
    const supabase =
      await createClient();

    const {
      data: {
        user,
      },
      error:
        userError,
    } =
      await supabase.auth.getUser();

    if (
      userError ||
      !user
    ) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            "로그인이 필요합니다.",
        },
        {
          status:
            401,
        }
      );
    }

    /*
     * ==========================================
     * 관리자 확인
     * ==========================================
     */
    const {
      data:
        profile,
      error:
        profileError,
    } =
      await supabase
        .from(
          "profiles"
        )
        .select(
          "role"
        )
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
          success:
            false,

          error:
            "관리자 권한이 필요합니다.",
        },
        {
          status:
            403,
        }
      );
    }

    /*
     * ==========================================
     * form-data
     * ==========================================
     */
    const formData =
      await request.formData();

    const sessionId =
      Number(
        formData.get(
          "sessionId"
        )
      );

    const audio =
      formData.get(
        "audio"
      );

    if (
      !Number.isInteger(
        sessionId
      ) ||
      sessionId <= 0
    ) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            "올바른 수업 ID가 필요합니다.",
        },
        {
          status:
            400,
        }
      );
    }

    if (
      !(audio instanceof File)
    ) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            "오디오 파일이 필요합니다.",
        },
        {
          status:
            400,
        }
      );
    }

    /*
     * ==========================================
     * 수업 존재 여부
     * ==========================================
     */
    const {
      data:
        session,
      error:
        sessionError,
    } =
      await supabase
        .from(
          "class_sessions"
        )
        .select(`
          id,
          lesson_number,
          enrollment_id
        `)
        .eq(
          "id",
          sessionId
        )
        .maybeSingle();

    if (
      sessionError
    ) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            `수업 조회 실패: ${sessionError.message}`,
        },
        {
          status:
            500,
        }
      );
    }

    if (!session) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            "수업을 찾을 수 없습니다.",
        },
        {
          status:
            404,
        }
      );
    }

    /*
     * ==========================================
     * 공용 AI 전사 엔진
     * ==========================================
     */
    const transcription =
      await transcribeClassAudio(
        audio
      );

    return NextResponse.json({
      success:
        true,

      message:
        "수업 음성 전사 및 Teacher/Student 화자 구분이 완료되었습니다.",

      session: {
        id:
          session.id,

        lessonNumber:
          session.lesson_number,
      },

      transcription,
    });
  } catch (error) {
    console.error(
      "CLASS TRANSCRIPTION ERROR:",
      error
    );

    return NextResponse.json(
      {
        success:
          false,

        error:
          error instanceof
          Error
            ? error.message
            : "수업 음성 전사 중 오류가 발생했습니다.",
      },
      {
        status:
          500,
      }
    );
  }
}