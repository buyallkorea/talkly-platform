import {
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@/lib/supabase-server";

import {
  createAdminClient,
} from "@/lib/supabase-admin";

import {
  activatePaidEnrollment,
} from "@/lib/enrollment/activate-paid-enrollment";

type RequestBody = {
  paymentId?: number;
};

export async function POST(
  request: Request
) {
  try {
    /*
     * =========================================================
     * 1. 로그인 확인
     * =========================================================
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
     * =========================================================
     * 2. 수강신청자 확인
     * =========================================================
     */
    const {
      data:
        profile,
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
      !profile ||
      ![
        "parent",
        "student",
      ].includes(
        profile.role
      )
    ) {
      return NextResponse.json(
        {
          success:
            false,
          error:
            "수강신청자만 처리할 수 있습니다.",
        },
        {
          status:
            403,
        }
      );
    }

    /*
     * =========================================================
     * 3. paymentId 확인
     * =========================================================
     */
    let body:
      RequestBody;

    try {
      body =
        (await request.json()) as RequestBody;
    } catch {
      return NextResponse.json(
        {
          success:
            false,
          error:
            "요청정보가 올바르지 않습니다.",
        },
        {
          status:
            400,
        }
      );
    }

    const paymentId =
      Number(
        body.paymentId
      );

    if (
      !Number.isInteger(
        paymentId
      ) ||
      paymentId <= 0
    ) {
      return NextResponse.json(
        {
          success:
            false,
          error:
            "결제 ID가 올바르지 않습니다.",
        },
        {
          status:
            400,
        }
      );
    }

    /*
     * =========================================================
     * 4. 본인 결제 및 신청 유형 확인
     * =========================================================
     */
    const admin =
      createAdminClient();

    const {
      data:
        payment,
      error:
        paymentError,
    } =
      await admin
        .from(
          "enrollment_payments"
        )
        .select(`
          id,
          parent_user_id,
          child_id,
          status
        `)
        .eq(
          "id",
          paymentId
        )
        .maybeSingle();

    if (
      paymentError ||
      !payment
    ) {
      return NextResponse.json(
        {
          success:
            false,
          error:
            "결제정보를 찾을 수 없습니다.",
        },
        {
          status:
            404,
        }
      );
    }

    if (
      payment.parent_user_id !==
      user.id
    ) {
      return NextResponse.json(
        {
          success:
            false,
          error:
            "본인의 결제만 처리할 수 있습니다.",
        },
        {
          status:
            403,
        }
      );
    }

    /*
     * 학부모 결제는 child_id가 있어야 하고,
     * 직접 수강생 결제는 child_id가 없어야 합니다.
     */
    if (
      (
        profile.role ===
          "parent" &&
        payment.child_id ===
          null
      ) ||
      (
        profile.role ===
          "student" &&
        payment.child_id !==
          null
      )
    ) {
      return NextResponse.json(
        {
          success:
            false,
          error:
            "결제 신청 유형을 확인할 수 없습니다.",
        },
        {
          status:
            403,
        }
      );
    }

    if (
      payment.status !==
      "paid"
    ) {
      return NextResponse.json(
        {
          success:
            false,
          error:
            "결제가 완료된 주문만 수강등록할 수 있습니다.",
        },
        {
          status:
            409,
        }
      );
    }

    /*
     * =========================================================
     * 5. 실제 수강 활성화
     * =========================================================
     */
    const result =
      await activatePaidEnrollment(
        paymentId
      );

    return NextResponse.json({
      success:
        true,

      enrollmentId:
        result.enrollmentId,

      alreadyExisted:
        result.alreadyExisted,

      totalLessons:
        result.totalLessons,

      startDate:
        result.startDate,

      endDate:
        result.endDate,
    });
  } catch (error) {
    console.error(
      "[ACTIVATE PAID ENROLLMENT]",
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
            : "수강등록 처리 중 오류가 발생했습니다.",
      },
      {
        status:
          500,
      }
    );
  }
}