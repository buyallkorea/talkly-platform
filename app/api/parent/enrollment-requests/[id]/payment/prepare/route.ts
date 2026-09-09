import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type EnrollmentRequestRow = {
  id: number;
  applicant_user_id: string;
  child_id: number;
  course_id: number;
  status: string;
  assigned_teacher_user_id: string | null;
  assignment_confirmed_at: string | null;
  duration_months: number | null;
  regular_price: number | null;
  discount_rate: number | null;
  discount_amount: number | null;
  final_price: number | null;
};

export async function POST(
  request: Request,
  context: RouteContext
) {
  try {
    /*
     * =========================================================
     * 1. URL의 enrollment request ID 확인
     * =========================================================
     */
    const { id } = await context.params;
    const requestId = Number(id);

    if (
      !Number.isInteger(requestId) ||
      requestId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "올바르지 않은 수강신청 번호입니다.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * =========================================================
     * 2. 로그인 사용자 확인
     * =========================================================
     */
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: "로그인이 필요합니다.",
        },
        {
          status: 401,
        }
      );
    }

    /*
     * =========================================================
     * 3. 학부모 계정 확인
     * =========================================================
     */
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (
      !profile ||
      profile.role !== "parent"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "학부모 계정만 결제할 수 있습니다.",
        },
        {
          status: 403,
        }
      );
    }

    const admin =
      createAdminClient();

    /*
     * =========================================================
     * 4. 서버에서 수강신청 및 최종 결제금액 재조회
     *
     * 중요:
     * 브라우저에서 amount를 받지 않습니다.
     * DB에 저장된 final_price가 결제 기준입니다.
     * =========================================================
     */
    const {
      data: requestData,
      error: enrollmentRequestError,
    } = await admin
      .from("enrollment_requests")
      .select(`
        id,
        applicant_user_id,
        child_id,
        course_id,
        status,
        assigned_teacher_user_id,
        assignment_confirmed_at,
        duration_months,
        regular_price,
        discount_rate,
        discount_amount,
        final_price
      `)
      .eq("id", requestId)
      .eq(
        "applicant_user_id",
        user.id
      )
      .maybeSingle();

    if (
      enrollmentRequestError ||
      !requestData
    ) {
      console.error(
        "[TOSS PREPARE] 수강신청 조회 실패:",
        enrollmentRequestError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "수강신청 정보를 확인할 수 없습니다.",
        },
        {
          status: 404,
        }
      );
    }

    const enrollmentRequest =
      requestData as EnrollmentRequestRow;

    /*
     * =========================================================
     * 5. 강사·일정 배정 확인
     * =========================================================
     */
    if (
      !enrollmentRequest.assigned_teacher_user_id ||
      !enrollmentRequest.assignment_confirmed_at
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "강사와 수업 일정이 아직 확정되지 않았습니다.",
        },
        {
          status: 409,
        }
      );
    }

    /*
     * =========================================================
     * 6. 수강기간 및 가격 확정 여부 확인
     * =========================================================
     */
    const durationMonths =
      Number(
        enrollmentRequest.duration_months
      );

    const finalPrice =
      Number(
        enrollmentRequest.final_price
      );

    if (
      !Number.isInteger(
        durationMonths
      ) ||
      ![1, 3, 6, 12].includes(
        durationMonths
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "먼저 수강기간을 선택해 주세요.",
        },
        {
          status: 409,
        }
      );
    }

    if (
      !Number.isInteger(finalPrice) ||
      finalPrice <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "최종 결제금액을 확인할 수 없습니다.",
        },
        {
          status: 409,
        }
      );
    }

    /*
     * =========================================================
     * 7. 이미 결제 완료된 신청인지 확인
     * =========================================================
     */
    const {
      data: paidPayment,
      error: paidPaymentError,
    } = await admin
      .from(
        "enrollment_payments"
      )
      .select(`
        id,
        order_id,
        amount,
        status,
        approved_at
      `)
      .eq(
        "enrollment_request_id",
        requestId
      )
      .eq(
        "parent_user_id",
        user.id
      )
      .eq(
        "status",
        "paid"
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      )
      .limit(1)
      .maybeSingle();

    if (paidPaymentError) {
      console.error(
        "[TOSS PREPARE] 기존 결제 조회 실패:",
        paidPaymentError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "기존 결제 내역을 확인하지 못했습니다.",
        },
        {
          status: 500,
        }
      );
    }

    if (paidPayment) {
      return NextResponse.json(
        {
          success: false,
          alreadyPaid: true,
          error:
            "이미 결제가 완료된 수강신청입니다.",
        },
        {
          status: 409,
        }
      );
    }

    /*
     * =========================================================
     * 8. 학생 / 과정명 조회
     * =========================================================
     */
    const [
      childResult,
      courseResult,
    ] = await Promise.all([
      admin
        .from("children")
        .select(`
          id,
          name
        `)
        .eq(
          "id",
          enrollmentRequest.child_id
        )
        .maybeSingle(),

      admin
        .from("courses")
        .select(`
          id,
          name
        `)
        .eq(
          "id",
          enrollmentRequest.course_id
        )
        .maybeSingle(),
    ]);

    if (
      childResult.error ||
      !childResult.data
    ) {
      console.error(
        "[TOSS PREPARE] 자녀 조회 실패:",
        childResult.error
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "학생 정보를 확인할 수 없습니다.",
        },
        {
          status: 500,
        }
      );
    }

    if (
      courseResult.error ||
      !courseResult.data
    ) {
      console.error(
        "[TOSS PREPARE] 과정 조회 실패:",
        courseResult.error
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "수강 과정 정보를 확인할 수 없습니다.",
        },
        {
          status: 500,
        }
      );
    }

    /*
     * =========================================================
     * 9. Toss orderId 생성
     *
     * Toss orderId는 주문마다 유일해야 합니다.
     * 개인정보는 orderId에 넣지 않습니다.
     * =========================================================
     */
    const orderId =
      `TALKLY-${requestId}-${randomUUID()}`;

    /*
     * Toss 주문명은 너무 길지 않도록 제한합니다.
     */
    const rawOrderName =
      `${courseResult.data.name} ${durationMonths}개월 수강료`;

    const orderName =
      rawOrderName.slice(
        0,
        100
      );

    /*
     * =========================================================
     * 10. TALKLY DB에 결제 주문 먼저 저장
     * =========================================================
     */
    const now =
      new Date().toISOString();

    const {
      data: payment,
      error: paymentInsertError,
    } = await admin
      .from(
        "enrollment_payments"
      )
      .insert({
        enrollment_request_id:
          requestId,

        parent_user_id:
          user.id,

        child_id:
          enrollmentRequest.child_id,

        order_id:
          orderId,

        order_name:
          orderName,

        amount:
          finalPrice,

        currency:
          "KRW",

        status:
          "ready",

        requested_at:
          now,
      })
      .select(`
        id,
        order_id,
        order_name,
        amount,
        currency,
        status
      `)
      .single();

    if (
      paymentInsertError ||
      !payment
    ) {
      console.error(
        "[TOSS PREPARE] 결제 주문 저장 실패:",
        paymentInsertError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "결제 주문을 생성하지 못했습니다.",
        },
        {
          status: 500,
        }
      );
    }

    /*
     * =========================================================
     * 11. 클라이언트로 전달
     *
     * TOSS_SECRET_KEY는 절대 전달하지 않습니다.
     * amount도 서버 DB 기준입니다.
     * =========================================================
     */
    return NextResponse.json({
  success: true,

  paymentId:
    payment.id,

  orderId:
    payment.order_id,

  orderName:
    payment.order_name,

  amount:
    payment.amount,

  currency:
    payment.currency,

  customerKey:
    user.id,

  childName:
    childResult.data.name,

  courseName:
    courseResult.data.name,

  durationMonths,
});
  } catch (error) {
    console.error(
      "[TOSS PREPARE] 예상하지 못한 오류:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "결제를 준비하는 중 오류가 발생했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}