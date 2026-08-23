import {
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@/lib/supabase-server";

import {
  checkTeacherReviewEligibility,
} from "@/lib/teacher-reviews";

type ReviewRequestBody = {
  enrollmentId?: number;

  attitudeScore?: number;

  lessonQualityScore?: number;

  explanationScore?: number;

  communicationScore?: number;

  preparationScore?: number;

  satisfactionScore?: number;

  comment?: string;
};

const MAX_COMMENT_LENGTH =
  2000;

function isValidScore(
  value: unknown
): value is number {
  return (
    typeof value ===
      "number" &&
    Number.isInteger(
      value
    ) &&
    value >= 1 &&
    value <= 10
  );
}

export async function POST(
  request: Request
) {
  try {
    const supabase =
      await createClient();

    /*
     * ========================================
     * 1. 로그인
     * ========================================
     */

    const {
      data: {
        user,
      },
    } =
      await supabase.auth.getUser();

    if (!user) {
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
     * ========================================
     * 2. 요청 데이터
     * ========================================
     */

    const body =
      (await request.json()) as
        ReviewRequestBody;

    const enrollmentId =
      Number(
        body.enrollmentId
      );

    if (
      !Number.isInteger(
        enrollmentId
      ) ||
      enrollmentId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "올바른 수강정보가 필요합니다.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * ========================================
     * 3. 점수 검증
     * ========================================
     */

    const scores = [
      body.attitudeScore,
      body.lessonQualityScore,
      body.explanationScore,
      body.communicationScore,
      body.preparationScore,
      body.satisfactionScore,
    ];

    if (
      !scores.every(
        isValidScore
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "모든 평가항목은 1점부터 10점까지 선택해야 합니다.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * TypeScript가 위 every 이후
     * 배열 전체를 number[]로 좁히지 않으므로
     * 개별 값도 안전하게 확정합니다.
     */

    const attitudeScore =
      body.attitudeScore as number;

    const lessonQualityScore =
      body.lessonQualityScore as number;

    const explanationScore =
      body.explanationScore as number;

    const communicationScore =
      body.communicationScore as number;

    const preparationScore =
      body.preparationScore as number;

    const satisfactionScore =
      body.satisfactionScore as number;

    /*
     * ========================================
     * 4. 코멘트
     * ========================================
     */

    const comment =
      typeof body.comment ===
      "string"
        ? body.comment.trim()
        : "";

    if (
      comment.length >
      MAX_COMMENT_LENGTH
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            `자유의견은 ${MAX_COMMENT_LENGTH.toLocaleString("ko-KR")}자 이내로 작성해주세요.`,
        },
        {
          status: 400,
        }
      );
    }

    /*
     * ========================================
     * 5. 평가 가능 여부를 서버에서 다시 검사
     *
     * 화면에서 버튼이 보였더라도
     * 제출 순간에 상태가 변경될 수 있으므로
     * 반드시 다시 확인합니다.
     * ========================================
     */

    const eligibility =
      await checkTeacherReviewEligibility({
        supabase,
        userId:
          user.id,
        enrollmentId,
      });

    if (
      !eligibility.eligible
    ) {
      const status =
        eligibility.code ===
        "ALREADY_REVIEWED"
          ? 409
          : 403;

      return NextResponse.json(
        {
          success: false,

          code:
            eligibility.code,

          error:
            eligibility.message,
        },
        {
          status,
        }
      );
    }

    if (
      !eligibility.teacherUserId
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            "평가 대상 강사를 확인할 수 없습니다.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * ========================================
     * 6. 평가 저장
     *
     * 중요:
     * teacher_user_id는 클라이언트에서 받지 않습니다.
     *
     * 서버가 실제 수강/수업 데이터를 확인한 뒤
     * 결정한 강사 ID만 저장합니다.
     *
     * 따라서 학생이 다른 강사 ID를 임의로
     * 제출할 수 없습니다.
     * ========================================
     */

    const {
      data: review,
      error: insertError,
    } =
      await supabase
        .from(
          "teacher_reviews"
        )
        .insert({
          enrollment_id:
            enrollmentId,

          teacher_user_id:
            eligibility.teacherUserId,

          reviewer_user_id:
            user.id,

          child_id:
            eligibility.childId,

          attitude_score:
            attitudeScore,

          lesson_quality_score:
            lessonQualityScore,

          explanation_score:
            explanationScore,

          communication_score:
            communicationScore,

          preparation_score:
            preparationScore,

          satisfaction_score:
            satisfactionScore,

          comment:
            comment ||
            null,
        })
        .select(`
          id,
          enrollment_id,
          teacher_user_id,
          created_at
        `)
        .single();

    if (
      insertError
    ) {
      /*
       * unique(enrollment_id)
       *
       * 동시에 두 번 제출되는 경우에도
       * DB가 마지막 방어선 역할을 합니다.
       */
      if (
        insertError.code ===
        "23505"
      ) {
        return NextResponse.json(
          {
            success: false,

            code:
              "ALREADY_REVIEWED",

            error:
              "이미 강사 평가를 완료한 수강입니다.",
          },
          {
            status: 409,
          }
        );
      }

      console.error(
        "TEACHER REVIEW INSERT ERROR:",
        insertError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            insertError.message,
        },
        {
          status: 400,
        }
      );
    }

    /*
     * ========================================
     * 7. 이번 평가의 종합점수
     * ========================================
     */

    const overallScore =
      Number(
        (
          (
            attitudeScore +
            lessonQualityScore +
            explanationScore +
            communicationScore +
            preparationScore +
            satisfactionScore
          ) /
          6
        ).toFixed(2)
      );

    return NextResponse.json({
      success: true,

      message:
        "강사 평가가 등록되었습니다.",

      review: {
        id:
          review.id,

        enrollmentId:
          review.enrollment_id,

        teacherUserId:
          review.teacher_user_id,

        teacherName:
          eligibility.teacherName,

        courseName:
          eligibility.courseName,

        overallScore,

        createdAt:
          review.created_at,
      },
    });
  } catch (error) {
    console.error(
      "TEACHER REVIEW SUBMIT ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof
          Error
            ? error.message
            : "강사평가 등록 중 오류가 발생했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}