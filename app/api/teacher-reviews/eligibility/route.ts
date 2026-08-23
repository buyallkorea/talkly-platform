import {
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@/lib/supabase-server";

import {
  checkTeacherReviewEligibility,
} from "@/lib/teacher-reviews";

export async function GET(
  request: Request
) {
  try {
    const supabase =
      await createClient();

    /*
     * ========================================
     * 로그인
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
     * enrollmentId
     * ========================================
     */

    const url =
      new URL(
        request.url
      );

    const enrollmentId =
      Number(
        url.searchParams.get(
          "enrollmentId"
        )
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
     * 공통 eligibility 검사
     * ========================================
     */

    const result =
      await checkTeacherReviewEligibility({
        supabase,
        userId:
          user.id,
        enrollmentId,
      });

    /*
     * 평가 가능 여부는
     * API 오류가 아니라 업무 상태이므로
     * HTTP 200으로 반환합니다.
     */
    return NextResponse.json({
      success: true,

      eligibility:
        result,
    });
  } catch (error) {
    console.error(
      "TEACHER REVIEW ELIGIBILITY ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof
          Error
            ? error.message
            : "강사평가 가능 여부를 확인하는 중 오류가 발생했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}