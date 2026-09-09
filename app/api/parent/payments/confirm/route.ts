import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

type ConfirmRequestBody = {
  paymentKey?: string;
  orderId?: string;
  amount?: number;
};

type EnrollmentPaymentRow = {
  id: number;
  enrollment_request_id: number;
  parent_user_id: string;
  child_id: number;
  order_id: string;
  payment_key: string | null;
  order_name: string;
  amount: number;
  currency: string;
  status: string;
  approved_at: string | null;
};

type TossPaymentResponse = {
  paymentKey?: string;
  orderId?: string;
  orderName?: string;
  status?: string;
  method?: string | null;
  totalAmount?: number;
  approvedAt?: string | null;
  requestedAt?: string | null;
  [key: string]: unknown;
};

type TossErrorResponse = {
  code?: string;
  message?: string;
  [key: string]: unknown;
};

export async function POST(request: Request) {
  try {
    /*
     * =========================================================
     * 1. 로그인 확인
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
     * 2. 학부모 계정 확인
     * =========================================================
     */
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile || profile.role !== "parent") {
      return NextResponse.json(
        {
          success: false,
          error: "학부모 계정만 결제를 승인할 수 있습니다.",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * =========================================================
     * 3. Toss redirect 값 확인
     * =========================================================
     */
    let body: ConfirmRequestBody;

    try {
      body = (await request.json()) as ConfirmRequestBody;
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "결제 승인 정보가 올바르지 않습니다.",
        },
        {
          status: 400,
        }
      );
    }

    const paymentKey =
      typeof body.paymentKey === "string"
        ? body.paymentKey.trim()
        : "";

    const orderId =
      typeof body.orderId === "string"
        ? body.orderId.trim()
        : "";

    const requestedAmount = Number(body.amount);

    if (!paymentKey || !orderId) {
      return NextResponse.json(
        {
          success: false,
          error: "결제 승인 정보가 누락되었습니다.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !Number.isInteger(requestedAmount) ||
      requestedAmount <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "결제 금액이 올바르지 않습니다.",
        },
        {
          status: 400,
        }
      );
    }

    const admin = createAdminClient();

    /*
     * =========================================================
     * 4. TALKLY DB 주문 조회
     *
     * orderId + 로그인 학부모를 동시에 확인합니다.
     * =========================================================
     */
    const {
      data: paymentData,
      error: paymentError,
    } = await admin
      .from("enrollment_payments")
      .select(`
        id,
        enrollment_request_id,
        parent_user_id,
        child_id,
        order_id,
        payment_key,
        order_name,
        amount,
        currency,
        status,
        approved_at
      `)
      .eq("order_id", orderId)
      .eq("parent_user_id", user.id)
      .maybeSingle();

    if (paymentError) {
      console.error(
        "[TOSS CONFIRM] 결제 주문 조회 실패:",
        paymentError
      );

      return NextResponse.json(
        {
          success: false,
          error: "결제 주문을 확인하지 못했습니다.",
        },
        {
          status: 500,
        }
      );
    }

    if (!paymentData) {
      return NextResponse.json(
        {
          success: false,
          error: "등록된 결제 주문을 찾을 수 없습니다.",
        },
        {
          status: 404,
        }
      );
    }

    const payment =
      paymentData as EnrollmentPaymentRow;

    /*
     * =========================================================
     * 5. 이미 승인 완료된 주문이면 재승인하지 않음
     *
     * 성공 페이지 새로고침 등에 대비합니다.
     * =========================================================
     */
    if (payment.status === "paid") {
      return NextResponse.json({
        success: true,
        alreadyPaid: true,
        paymentId: payment.id,
        orderId: payment.order_id,
        amount: payment.amount,
        approvedAt: payment.approved_at,
      });
    }

    /*
     * =========================================================
     * 6. 브라우저가 전달한 금액과 DB 금액 비교
     * =========================================================
     */
    if (Number(payment.amount) !== requestedAmount) {
      console.error(
        "[TOSS CONFIRM] 결제금액 불일치:",
        {
          orderId,
          dbAmount: payment.amount,
          redirectAmount: requestedAmount,
        }
      );

      await admin
        .from("enrollment_payments")
        .update({
          status: "failed",
          failure_code: "AMOUNT_MISMATCH",
          failure_message:
            "Toss 인증 금액과 TALKLY 주문 금액이 일치하지 않습니다.",
          failed_at: new Date().toISOString(),
        })
        .eq("id", payment.id);

      return NextResponse.json(
        {
          success: false,
          error:
            "결제 금액이 일치하지 않아 승인을 중단했습니다.",
        },
        {
          status: 409,
        }
      );
    }

    /*
     * =========================================================
     * 7. enrollment_requests 가격도 다시 확인
     *
     * 주문 생성 후 수강기간/가격이 변경되는 경우까지 방어합니다.
     * =========================================================
     */
    const {
      data: enrollmentRequest,
      error: enrollmentRequestError,
    } = await admin
      .from("enrollment_requests")
      .select(`
        id,
        applicant_user_id,
        child_id,
        duration_months,
        final_price,
        assignment_confirmed_at
      `)
      .eq(
        "id",
        payment.enrollment_request_id
      )
      .eq(
        "applicant_user_id",
        user.id
      )
      .maybeSingle();

    if (
      enrollmentRequestError ||
      !enrollmentRequest
    ) {
      console.error(
        "[TOSS CONFIRM] 수강신청 확인 실패:",
        enrollmentRequestError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "수강신청 정보를 다시 확인할 수 없습니다.",
        },
        {
          status: 500,
        }
      );
    }

    if (!enrollmentRequest.assignment_confirmed_at) {
      return NextResponse.json(
        {
          success: false,
          error:
            "강사 및 수업 일정이 확정되지 않은 신청입니다.",
        },
        {
          status: 409,
        }
      );
    }

    const currentFinalPrice =
      Number(enrollmentRequest.final_price);

    if (
      !Number.isInteger(currentFinalPrice) ||
      currentFinalPrice <= 0 ||
      currentFinalPrice !== payment.amount
    ) {
      await admin
        .from("enrollment_payments")
        .update({
          status: "failed",
          failure_code:
            "ENROLLMENT_PRICE_CHANGED",
          failure_message:
            "결제 주문 생성 이후 수강신청 결제금액이 변경되었습니다.",
          failed_at:
            new Date().toISOString(),
        })
        .eq("id", payment.id);

      return NextResponse.json(
        {
          success: false,
          error:
            "결제 준비 이후 수강료 정보가 변경되었습니다. 다시 결제를 진행해 주세요.",
        },
        {
          status: 409,
        }
      );
    }

    /*
     * =========================================================
     * 8. Toss Secret Key 확인
     * =========================================================
     */
    const secretKey =
      process.env.TOSS_SECRET_KEY;

    if (!secretKey) {
      console.error(
        "[TOSS CONFIRM] TOSS_SECRET_KEY 환경변수가 없습니다."
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "결제 승인 설정이 완료되지 않았습니다.",
        },
        {
          status: 500,
        }
      );
    }

    /*
     * =========================================================
     * 9. 상태를 confirming으로 변경
     * =========================================================
     */
    const {
      error: confirmingUpdateError,
    } = await admin
      .from("enrollment_payments")
      .update({
        status: "confirming",
        payment_key: paymentKey,
      })
      .eq("id", payment.id);

    if (confirmingUpdateError) {
      console.error(
        "[TOSS CONFIRM] confirming 저장 실패:",
        confirmingUpdateError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "결제 승인 준비상태를 저장하지 못했습니다.",
        },
        {
          status: 500,
        }
      );
    }

    /*
     * =========================================================
     * 10. Toss 결제 승인 API 호출
     *
     * Secret Key 뒤에 ":"를 붙인 뒤 Base64 인코딩합니다.
     * =========================================================
     */
    const authorization =
      Buffer.from(
        `${secretKey}:`
      ).toString("base64");

    let tossResponse: Response;

    try {
      tossResponse = await fetch(
        "https://api.tosspayments.com/v1/payments/confirm",
        {
          method: "POST",
          headers: {
            Authorization:
              `Basic ${authorization}`,
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            paymentKey,
            orderId,
            amount: payment.amount,
          }),
          cache: "no-store",
        }
      );
    } catch (error) {
      console.error(
        "[TOSS CONFIRM] Toss API 통신 실패:",
        error
      );

      await admin
        .from("enrollment_payments")
        .update({
          status: "failed",
          failure_code:
            "TOSS_NETWORK_ERROR",
          failure_message:
            "Toss Payments 승인 API 통신에 실패했습니다.",
          failed_at:
            new Date().toISOString(),
        })
        .eq("id", payment.id);

      return NextResponse.json(
        {
          success: false,
          error:
            "결제 승인 서버와 통신하지 못했습니다.",
        },
        {
          status: 502,
        }
      );
    }

    let tossResult:
      | TossPaymentResponse
      | TossErrorResponse;

    try {
      tossResult =
        (await tossResponse.json()) as
          | TossPaymentResponse
          | TossErrorResponse;
    } catch {
      tossResult = {
        code:
          "INVALID_TOSS_RESPONSE",
        message:
          "Toss Payments 응답을 읽을 수 없습니다.",
      };
    }

    /*
     * =========================================================
     * 11. Toss 승인 실패
     * =========================================================
     */
    if (!tossResponse.ok) {
      const tossError =
        tossResult as TossErrorResponse;

      console.error(
        "[TOSS CONFIRM] Toss 승인 실패:",
        tossError
      );

      await admin
        .from("enrollment_payments")
        .update({
          status: "failed",
          failure_code:
            tossError.code ??
            `HTTP_${tossResponse.status}`,
          failure_message:
            tossError.message ??
            "Toss Payments 결제 승인에 실패했습니다.",
          toss_response:
            tossResult,
          failed_at:
            new Date().toISOString(),
        })
        .eq("id", payment.id);

      return NextResponse.json(
        {
          success: false,
          code:
            tossError.code ??
            null,
          error:
            tossError.message ??
            "결제 승인에 실패했습니다.",
        },
        {
          status: 400,
        }
      );
    }

    const tossPayment =
      tossResult as TossPaymentResponse;

    /*
     * =========================================================
     * 12. Toss 응답 자체도 다시 검증
     * =========================================================
     */
    if (
      tossPayment.orderId !== orderId ||
      tossPayment.paymentKey !==
        paymentKey ||
      Number(
        tossPayment.totalAmount
      ) !== payment.amount
    ) {
      console.error(
        "[TOSS CONFIRM] Toss 승인 응답 불일치:",
        {
          expectedOrderId:
            orderId,
          responseOrderId:
            tossPayment.orderId,
          expectedAmount:
            payment.amount,
          responseAmount:
            tossPayment.totalAmount,
        }
      );

      await admin
        .from("enrollment_payments")
        .update({
          status: "failed",
          failure_code:
            "TOSS_RESPONSE_MISMATCH",
          failure_message:
            "Toss 승인 결과와 TALKLY 주문 정보가 일치하지 않습니다.",
          toss_response:
            tossPayment,
          failed_at:
            new Date().toISOString(),
        })
        .eq("id", payment.id);

      return NextResponse.json(
        {
          success: false,
          error:
            "결제 승인 결과 검증에 실패했습니다. 관리자에게 문의해 주세요.",
        },
        {
          status: 409,
        }
      );
    }

    /*
     * 현재 첫 연동은 즉시 승인되는 일반결제를 기준으로 합니다.
     */
    if (tossPayment.status !== "DONE") {
      console.error(
        "[TOSS CONFIRM] 즉시 완료되지 않은 결제:",
        tossPayment.status
      );

      await admin
        .from("enrollment_payments")
        .update({
          status: "failed",
          payment_key:
            paymentKey,
          payment_method:
            tossPayment.method ??
            null,
          toss_status:
            tossPayment.status ??
            null,
          failure_code:
            "PAYMENT_NOT_DONE",
          failure_message:
            `Toss 결제상태가 DONE이 아닙니다: ${
              tossPayment.status ??
              "UNKNOWN"
            }`,
          toss_response:
            tossPayment,
          failed_at:
            new Date().toISOString(),
        })
        .eq("id", payment.id);

      return NextResponse.json(
        {
          success: false,
          error:
            "결제가 즉시 완료되지 않았습니다. 관리자에게 문의해 주세요.",
        },
        {
          status: 409,
        }
      );
    }

    /*
     * =========================================================
     * 13. 결제 성공 저장
     * =========================================================
     */
    const approvedAt =
      tossPayment.approvedAt ??
      new Date().toISOString();

    const {
      data: savedPayment,
      error: savePaymentError,
    } = await admin
      .from("enrollment_payments")
      .update({
        status: "paid",
        payment_key:
          paymentKey,
        payment_method:
          tossPayment.method ??
          null,
        toss_status:
          tossPayment.status ??
          "DONE",
        approved_at:
          approvedAt,
        failure_code:
          null,
        failure_message:
          null,
        toss_response:
          tossPayment,
      })
      .eq("id", payment.id)
      .select(`
        id,
        enrollment_request_id,
        child_id,
        order_id,
        order_name,
        amount,
        status,
        payment_method,
        approved_at
      `)
      .single();

    if (
      savePaymentError ||
      !savedPayment
    ) {
      /*
       * 여기까지 왔다면 Toss에서는 결제가 승인됐을 수 있습니다.
       * 따라서 사용자에게 재결제를 유도하면 안 됩니다.
       */
      console.error(
        "[TOSS CONFIRM] Toss 승인 후 DB 저장 실패:",
        savePaymentError
      );

      return NextResponse.json(
        {
          success: false,
          paymentMayBeApproved:
            true,
          error:
            "결제는 승인되었을 수 있으나 TALKLY 결제내역 저장 중 문제가 발생했습니다. 다시 결제하지 말고 관리자에게 문의해 주세요.",
        },
        {
          status: 500,
        }
      );
    }

    /*
     * =========================================================
     * 중요
     *
     * 아직 여기서 enrollments를 생성하지 않습니다.
     *
     * 결제 테스트가 정상임을 확인한 다음 단계에서
     * paid 결제를 기준으로 수강 등록을 생성합니다.
     * =========================================================
     */
    return NextResponse.json({
      success: true,
      payment: savedPayment,
    });
  } catch (error) {
    console.error(
      "[TOSS CONFIRM] 예상하지 못한 오류:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "결제를 승인하는 중 오류가 발생했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}