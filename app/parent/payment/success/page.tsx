"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";

type ConfirmState =
  | "loading"
  | "success"
  | "error";

type ConfirmResult = {
  success?: boolean;
  alreadyPaid?: boolean;
  paymentMayBeApproved?: boolean;
  error?: string;
  payment?: {
    id: number;
    enrollment_request_id: number;
    child_id: number;
    order_id: string;
    order_name: string;
    amount: number;
    status: string;
    payment_method:
      | string
      | null;
    approved_at:
      | string
      | null;
  };
  paymentId?: number;
  orderId?: string;
  amount?: number;
  approvedAt?: string | null;
};

function formatMoney(
  value: number
) {
  return new Intl.NumberFormat(
    "ko-KR"
  ).format(value);
}

export default function PaymentSuccessPage() {
  const startedRef =
    useRef(false);

  const [
    state,
    setState,
  ] =
    useState<ConfirmState>(
      "loading"
    );

  const [
    message,
    setMessage,
  ] =
    useState(
      "결제를 최종 승인하고 있습니다."
    );

  const [
    payment,
    setPayment,
  ] =
    useState<{
      childId: number | null;
      requestId: number | null;
      orderId: string;
      amount: number;
      approvedAt:
        | string
        | null;
    } | null>(null);

  useEffect(() => {
    if (startedRef.current) {
      return;
    }

    startedRef.current = true;

    async function confirmPayment() {
      try {
        const params =
          new URLSearchParams(
            window.location.search
          );

        const paymentKey =
          params.get(
            "paymentKey"
          );

        const orderId =
          params.get(
            "orderId"
          );

        const amountText =
          params.get(
            "amount"
          );

        const amount =
          Number(amountText);

        if (
          !paymentKey ||
          !orderId ||
          !amountText
        ) {
          throw new Error(
            "결제 인증 정보가 누락되었습니다."
          );
        }

        if (
          !Number.isInteger(
            amount
          ) ||
          amount <= 0
        ) {
          throw new Error(
            "결제 금액 정보가 올바르지 않습니다."
          );
        }

        const response =
          await fetch(
            "/api/parent/payments/confirm",
            {
              method:
                "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body:
                JSON.stringify({
                  paymentKey,
                  orderId,
                  amount,
                }),
            }
          );

        const result =
          (await response.json()) as ConfirmResult;

        if (!response.ok) {
          if (
            result.paymentMayBeApproved
          ) {
            throw new Error(
              result.error ??
                "결제는 승인되었을 수 있습니다. 새로 결제하지 말고 관리자에게 문의해 주세요."
            );
          }

          throw new Error(
            result.error ??
              "결제 승인에 실패했습니다."
          );
        }

        /*
         * 최초 성공
         */
        if (
          result.payment
        ) {
          setPayment({
            childId:
              result.payment
                .child_id,
            requestId:
              result.payment
                .enrollment_request_id,
            orderId:
              result.payment
                .order_id,
            amount:
              result.payment
                .amount,
            approvedAt:
              result.payment
                .approved_at,
          });
        } else {
          /*
           * 이미 paid였던 주문
           * 성공 페이지 새로고침 대응
           */
          setPayment({
            childId: null,
            requestId: null,
            orderId:
              result.orderId ??
              orderId,
            amount:
              Number(
                result.amount ??
                  amount
              ),
            approvedAt:
              result.approvedAt ??
              null,
          });
        }

        setState(
          "success"
        );

        setMessage(
          result.alreadyPaid
            ? "이미 정상적으로 완료된 결제입니다."
            : "TALKLY 수강료 결제가 정상적으로 완료되었습니다."
        );
      } catch (error) {
        console.error(
          "[PAYMENT SUCCESS PAGE]",
          error
        );

        setState(
          "error"
        );

        setMessage(
          error instanceof Error
            ? error.message
            : "결제 승인 중 오류가 발생했습니다."
        );
      }
    }

    void confirmPayment();
  }, []);

  return (
    <main
      style={{
        minHeight:
          "100vh",
        padding:
          "56px 20px 90px",
        background:
          "linear-gradient(180deg, #f5f8ff 0%, #ffffff 58%)",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth:
            "620px",
          margin:
            "0 auto",
          padding:
            "32px",
          borderRadius:
            "24px",
          border:
            "1px solid #e4e7ec",
          background:
            "#ffffff",
          boxShadow:
            "0 20px 55px rgba(10,31,68,0.10)",
          textAlign:
            "center",
        }}
      >
        <div
          style={{
            color:
              "#3978ef",
            fontSize:
              "12px",
            fontWeight:
              900,
            letterSpacing:
              "0.1em",
          }}
        >
          TALKLY PAYMENT
        </div>

        {state ===
          "loading" && (
          <>
            <div
              style={{
                margin:
                  "28px auto 0",
                width:
                  "54px",
                height:
                  "54px",
                borderRadius:
                  "999px",
                border:
                  "5px solid #e4e7ec",
                borderTopColor:
                  "#3978ef",
                animation:
                  "talkly-spin 0.8s linear infinite",
              }}
            />

            <h1
              style={{
                margin:
                  "24px 0 0",
                color:
                  "#0A1F44",
                fontSize:
                  "28px",
              }}
            >
              결제를 확인하고
              있습니다
            </h1>
          </>
        )}

        {state ===
          "success" && (
          <>
            <div
              style={{
                width:
                  "64px",
                height:
                  "64px",
                margin:
                  "26px auto 0",
                display:
                  "flex",
                alignItems:
                  "center",
                justifyContent:
                  "center",
                borderRadius:
                  "999px",
                background:
                  "#ecfdf3",
                color:
                  "#067647",
                fontSize:
                  "30px",
                fontWeight:
                  900,
              }}
            >
              ✓
            </div>

            <h1
              style={{
                margin:
                  "22px 0 0",
                color:
                  "#0A1F44",
                fontSize:
                  "30px",
              }}
            >
              결제가
              완료되었습니다
            </h1>
          </>
        )}

        {state ===
          "error" && (
          <>
            <div
              style={{
                width:
                  "64px",
                height:
                  "64px",
                margin:
                  "26px auto 0",
                display:
                  "flex",
                alignItems:
                  "center",
                justifyContent:
                  "center",
                borderRadius:
                  "999px",
                background:
                  "#fef3f2",
                color:
                  "#b42318",
                fontSize:
                  "28px",
                fontWeight:
                  900,
              }}
            >
              !
            </div>

            <h1
              style={{
                margin:
                  "22px 0 0",
                color:
                  "#0A1F44",
                fontSize:
                  "28px",
              }}
            >
              결제 확인이
              필요합니다
            </h1>
          </>
        )}

        <p
          style={{
            margin:
              "14px auto 0",
            maxWidth:
              "470px",
            color:
              state ===
              "error"
                ? "#b42318"
                : "#667085",
            fontSize:
              "14px",
            lineHeight:
              1.8,
            fontWeight:
              state ===
              "error"
                ? 700
                : 500,
          }}
        >
          {message}
        </p>

        {state ===
          "success" &&
          payment && (
            <div
              style={{
                marginTop:
                  "26px",
                padding:
                  "20px",
                borderRadius:
                  "16px",
                background:
                  "#f8fafc",
                border:
                  "1px solid #eaecf0",
                textAlign:
                  "left",
              }}
            >
              <ResultRow
                label="주문번호"
                value={
                  payment.orderId
                }
              />

              <ResultRow
                label="결제금액"
                value={`${formatMoney(
                  payment.amount
                )}원`}
              />

              <ResultRow
                label="상태"
                value="결제 완료"
              />
            </div>
          )}

        {state ===
          "success" && (
          <div
            style={{
              marginTop:
                "28px",
              display:
                "grid",
              gap:
                "10px",
            }}
          >
            {payment?.childId &&
            payment.requestId ? (
              <Link
                href={`/parent/children/${payment.childId}/enrollment-requests/${payment.requestId}`}
                style={{
                  minHeight:
                    "50px",
                  display:
                    "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "center",
                  padding:
                    "0 18px",
                  borderRadius:
                    "12px",
                  background:
                    "#0A1F44",
                  color:
                    "#ffffff",
                  textDecoration:
                    "none",
                  fontWeight:
                    900,
                }}
              >
                수강신청 상세로
                돌아가기
              </Link>
            ) : (
              <Link
                href="/parent"
                style={{
                  minHeight:
                    "50px",
                  display:
                    "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "center",
                  padding:
                    "0 18px",
                  borderRadius:
                    "12px",
                  background:
                    "#0A1F44",
                  color:
                    "#ffffff",
                  textDecoration:
                    "none",
                  fontWeight:
                    900,
                }}
              >
                학부모
                대시보드로 이동
              </Link>
            )}
          </div>
        )}

        {state ===
          "error" && (
          <div
            style={{
              marginTop:
                "28px",
              display:
                "grid",
              gap:
                "10px",
            }}
          >
            <Link
              href="/parent"
              style={{
                minHeight:
                  "50px",
                display:
                  "flex",
                alignItems:
                  "center",
                justifyContent:
                  "center",
                padding:
                  "0 18px",
                borderRadius:
                  "12px",
                background:
                  "#0A1F44",
                color:
                  "#ffffff",
                textDecoration:
                  "none",
                fontWeight:
                  900,
              }}
            >
              학부모
              대시보드로 이동
            </Link>

            <div
              style={{
                color:
                  "#667085",
                fontSize:
                  "11px",
                lineHeight:
                  1.7,
              }}
            >
              결제가 실제로
              승인되었을 가능성이
              있는 경우에는 다시
              결제하지 말고
              관리자에게 문의해
              주세요.
            </div>
          </div>
        )}
      </section>

      <style>{`
        @keyframes talkly-spin {
          from {
            transform: rotate(0deg);
          }

          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </main>
  );
}

function ResultRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        display:
          "flex",
        justifyContent:
          "space-between",
        alignItems:
          "center",
        gap:
          "18px",
        padding:
          "8px 0",
      }}
    >
      <span
        style={{
          color:
            "#667085",
          fontSize:
            "12px",
        }}
      >
        {label}
      </span>

      <strong
        style={{
          color:
            "#101828",
          fontSize:
            "12px",
          textAlign:
            "right",
          wordBreak:
            "break-all",
        }}
      >
        {value}
      </strong>
    </div>
  );
}