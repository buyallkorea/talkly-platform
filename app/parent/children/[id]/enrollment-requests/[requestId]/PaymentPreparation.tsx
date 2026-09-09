"use client";

import {
  useMemo,
  useState,
} from "react";
import Link from "next/link";

type TossPaymentMethod = {
  code: string;
  methodId?: string;
};

type TossPaymentWindow = {
  on: (
    eventName: "paymentRequest" | "cancel",
    callback: (paymentMethod?: TossPaymentMethod) => void | Promise<void>
  ) => void;
  destroy: () => Promise<void> | void;
};

type TossWidgets = {
  setAmount: (amount: { value: number; currency: "KRW" }) => Promise<void>;
  renderPaymentWindow: () => Promise<TossPaymentWindow>;
  requestPayment: (request: {
    orderId: string;
    orderName: string;
    successUrl: string;
    failUrl: string;
    customerName?: string;
  }) => Promise<void> | void;
};

type TossPaymentsInstance = {
  widgets: (params: { customerKey: string }) => TossWidgets;
};

declare global {
  interface Window {
    TossPayments?: (clientKey: string) => TossPaymentsInstance;
  }
}

type PreparePaymentResult = {
  success?: boolean;
  error?: string;
  alreadyPaid?: boolean;
  orderId?: string;
  orderName?: string;
  amount?: number;
  currency?: string;
  customerKey?: string;
};

const TOSS_SDK_URL = "https://js.tosspayments.com/v2/standard";

function loadTossPaymentsSdk() {
  return new Promise<void>((resolve, reject) => {
    if (window.TossPayments) {
      resolve();
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${TOSS_SDK_URL}"]`
    );

    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("토스페이먼츠 결제 모듈을 불러오지 못했습니다.")),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.src = TOSS_SDK_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("토스페이먼츠 결제 모듈을 불러오지 못했습니다."));
    document.head.appendChild(script);
  });
}

type Pricing = {
  id: number;
  pricingCategory: string;
  pricePerLesson: number;
  monthlyLessonCount: number;
  weekendMultiplier: number;
};

type DiscountPolicy = {
  id: number;
  durationMonths: number;
  discountRate: number;
};

type Props = {
  requestId: number;
  childId: number;
  childName: string;
  courseName: string;
  teacherName: string;
  teacherNationality:
    | string
    | null;
  schedule: string;
  assignedDays: string[];
  lessonDurationMinutes: number;
  lessonsPerWeek: number;
  pricing: Pricing;
  discountPolicies: DiscountPolicy[];
  savedSelection: {
    durationMonths:
      | number
      | null;
    finalPrice:
      | number
      | null;
  };
};

function formatMoney(
  value: number
) {
  return new Intl.NumberFormat(
    "ko-KR"
  ).format(
    Math.round(value)
  );
}

function getCategoryLabel(
  category: string
) {
  switch (category) {
    case "philippines":
      return "필리핀 강사";
    case "western":
      return "원어민 강사";
    case "special":
      return "스페셜";
    case "intensive":
      return "인텐시브";
    default:
      return category;
  }
}

export default function PaymentPreparation({
  requestId,
  childId,
  childName,
  courseName,
  teacherName,
  teacherNationality,
  schedule,
  assignedDays,
  lessonDurationMinutes,
  lessonsPerWeek,
  pricing,
  discountPolicies,
  savedSelection,
}: Props) {
  const initialMonths =
    discountPolicies.some(
      (policy) =>
        policy.durationMonths ===
        savedSelection.durationMonths
    )
      ? savedSelection.durationMonths!
      : discountPolicies[0]
          ?.durationMonths ?? 1;

  const [
    selectedMonths,
    setSelectedMonths,
  ] =
    useState(initialMonths);

  const [
    isSaving,
    setIsSaving,
  ] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] =
    useState("");

  const selectedPolicy =
    useMemo(
      () =>
        discountPolicies.find(
          (policy) =>
            policy.durationMonths ===
            selectedMonths
        ) ??
        discountPolicies[0],
      [
        discountPolicies,
        selectedMonths,
      ]
    );

  const weekendDayCount =
    assignedDays.filter(
      (day) =>
        day === "Saturday" ||
        day === "Sunday"
    ).length;

  const weekdayDayCount =
    Math.max(
      0,
      lessonsPerWeek -
        weekendDayCount
    );

  const weeksPerMonth =
    lessonsPerWeek > 0
      ? pricing.monthlyLessonCount /
        lessonsPerWeek
      : 0;

  const monthlyWeekdayLessons =
    weekdayDayCount *
    weeksPerMonth;

  const monthlyWeekendLessons =
    weekendDayCount *
    weeksPerMonth;

  const monthlyRegularPrice =
    pricing.pricePerLesson *
    (
      monthlyWeekdayLessons +
      monthlyWeekendLessons *
        pricing.weekendMultiplier
    );

  const regularPrice =
    monthlyRegularPrice *
    selectedMonths;

  const discountRate =
    Number(
      selectedPolicy
        ?.discountRate ??
        0
    );

  const discountAmount =
    Math.round(
      regularPrice *
        (
          discountRate /
          100
        )
    );

  const finalPrice =
    Math.max(
      0,
      Math.round(
        regularPrice -
          discountAmount
      )
    );

  async function saveAndContinue() {
    setIsSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      /*
       * 1. 선택한 수강기간을 서버에 저장하고
       *    최종 결제금액을 확정합니다.
       */
      const pricingResponse = await fetch(
        `/api/parent/enrollment-requests/${requestId}/pricing`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            durationMonths: selectedMonths,
          }),
        }
      );

      const pricingResult = await pricingResponse.json();

      if (!pricingResponse.ok) {
        throw new Error(
          pricingResult.error || "결제금액을 확정할 수 없습니다."
        );
      }

      /*
       * 2. TALKLY 서버에서 Toss 주문을 생성합니다.
       *    결제금액은 브라우저의 finalPrice가 아니라
       *    prepare API가 DB에서 다시 확인한 값을 사용합니다.
       */
      const prepareResponse = await fetch(
        `/api/parent/enrollment-requests/${requestId}/payment/prepare`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const prepared =
        (await prepareResponse.json()) as PreparePaymentResult;

      if (!prepareResponse.ok) {
        throw new Error(
          prepared.error || "결제 주문을 준비하지 못했습니다."
        );
      }

      if (
        !prepared.orderId ||
        !prepared.orderName ||
        !prepared.customerKey ||
        !Number.isInteger(Number(prepared.amount)) ||
        Number(prepared.amount) <= 0
      ) {
        throw new Error("결제 주문 정보가 올바르지 않습니다.");
      }

      const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;

      if (!clientKey) {
        throw new Error(
          "토스페이먼츠 클라이언트 키가 설정되지 않았습니다."
        );
      }

      /*
       * 3. Toss Payments SDK v2를 불러옵니다.
       */
      await loadTossPaymentsSdk();

      if (!window.TossPayments) {
        throw new Error("토스페이먼츠 결제 모듈을 초기화하지 못했습니다.");
      }

      const tossPayments = window.TossPayments(clientKey);
      const widgets = tossPayments.widgets({
        customerKey: prepared.customerKey,
      });

      const amount = Number(prepared.amount);

      await widgets.setAmount({
        value: amount,
        currency: "KRW",
      });

      /*
       * 4. 결제창형 UI를 렌더링합니다.
       *    사용자가 결제수단을 선택하고 결제를 요청하면
       *    paymentRequest 이벤트가 발생합니다.
       */
      const paymentWindow = await widgets.renderPaymentWindow();

      paymentWindow.on("cancel", async () => {
        setIsSaving(false);
        setSuccessMessage("");
        setErrorMessage("결제를 취소했습니다. 다시 결제할 수 있습니다.");

        try {
          await paymentWindow.destroy();
        } catch {
          // 이미 닫힌 결제창이면 무시합니다.
        }
      });

      paymentWindow.on("paymentRequest", async () => {
        try {
          const origin = window.location.origin;

          await widgets.requestPayment({
            orderId: prepared.orderId!,
            orderName: prepared.orderName!,
            successUrl: `${origin}/parent/payment/success`,
            failUrl: `${origin}/parent/payment/fail`,
            customerName: childName,
          });
        } catch (error) {
          console.error("[TOSS PAYMENT REQUEST]", error);
          setIsSaving(false);
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "결제 요청 중 오류가 발생했습니다."
          );

          try {
            await paymentWindow.destroy();
          } catch {
            // 이미 닫힌 결제창이면 무시합니다.
          }
        }
      });
    } catch (error) {
      console.error("[TOSS PAYMENT PREPARE]", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "결제를 준비하는 중 오류가 발생했습니다."
      );
      setIsSaving(false);
    }
  }

  return (
    <>
      <section
        style={{
          marginTop:
            "24px",
          display:
            "grid",
          gridTemplateColumns:
            "minmax(0, 1.45fr) minmax(300px, 0.8fr)",
          gap: "18px",
          alignItems:
            "start",
        }}
        className="payment-layout"
      >
        <div>
          <section
            style={{
              padding:
                "25px",
              borderRadius:
                "20px",
              border:
                "1px solid #e4e7ec",
              background:
                "#ffffff",
              boxShadow:
                "0 12px 34px rgba(16,24,40,0.06)",
            }}
          >
            <div
              style={{
                display:
                  "flex",
                justifyContent:
                  "space-between",
                alignItems:
                  "flex-start",
                gap: "16px",
                flexWrap:
                  "wrap",
              }}
            >
              <div>
                <div
                  style={{
                    color:
                      "#3978ef",
                    fontSize:
                      "11px",
                    fontWeight:
                      900,
                    letterSpacing:
                      "0.08em",
                  }}
                >
                  ASSIGNED CLASS
                </div>

                <h2
                  style={{
                    margin:
                      "8px 0 0",
                    color:
                      "#101828",
                    fontSize:
                      "25px",
                    letterSpacing:
                      "-0.03em",
                  }}
                >
                  {childName} ·{" "}
                  {courseName}
                </h2>
              </div>

              <span
                style={{
                  display:
                    "inline-flex",
                  alignItems:
                    "center",
                  minHeight:
                    "29px",
                  padding:
                    "0 11px",
                  borderRadius:
                    "999px",
                  background:
                    "#ecfdf3",
                  color:
                    "#067647",
                  fontSize:
                    "11px",
                  fontWeight:
                    900,
                }}
              >
                배정 완료
              </span>
            </div>

            <div
              style={{
                marginTop:
                  "22px",
                display:
                  "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(150px, 1fr))",
                gap: "10px",
              }}
            >
              <Info
                label="담당 강사"
                value={`${teacherName}${
                  teacherNationality
                    ? ` · ${teacherNationality}`
                    : ""
                }`}
              />

              <Info
                label="수업 일정"
                value={
                  schedule ||
                  "-"
                }
              />

              <Info
                label="수업 시간"
                value={`${lessonDurationMinutes}분`}
              />

              <Info
                label="수업 횟수"
                value={`주 ${lessonsPerWeek}회`}
              />
            </div>
          </section>

          <section
            style={{
              marginTop:
                "18px",
              padding:
                "25px",
              borderRadius:
                "20px",
              border:
                "1px solid #e4e7ec",
              background:
                "#ffffff",
              boxShadow:
                "0 12px 34px rgba(16,24,40,0.05)",
            }}
          >
            <div>
              <div
                style={{
                  color:
                    "#3978ef",
                  fontSize:
                    "11px",
                  fontWeight:
                    900,
                  letterSpacing:
                    "0.08em",
                }}
              >
                STEP 1
              </div>

              <h2
                style={{
                  margin:
                    "7px 0 0",
                  color:
                    "#101828",
                  fontSize:
                    "24px",
                  letterSpacing:
                    "-0.03em",
                }}
              >
                수강기간 선택
              </h2>

              <p
                style={{
                  margin:
                    "8px 0 0",
                  color:
                    "#667085",
                  fontSize:
                    "13px",
                  lineHeight:
                    1.7,
                }}
              >
                기간이 길수록
                TALKLY 장기수강
                할인율이 자동으로
                적용됩니다.
              </p>
            </div>

            <div
              style={{
                marginTop:
                  "20px",
                display:
                  "grid",
                gridTemplateColumns:
                  "repeat(4, minmax(0, 1fr))",
                gap: "10px",
              }}
              className="duration-grid"
            >
              {discountPolicies.map(
                (policy) => {
                  const selected =
                    selectedMonths ===
                    policy.durationMonths;

                  return (
                    <button
                      key={
                        policy.id
                      }
                      type="button"
                      onClick={() => {
                        setSelectedMonths(
                          policy.durationMonths
                        );
                        setErrorMessage(
                          ""
                        );
                        setSuccessMessage(
                          ""
                        );
                      }}
                      style={{
                        minHeight:
                          "102px",
                        padding:
                          "14px 10px",
                        border:
                          selected
                            ? "2px solid #3978ef"
                            : "1px solid #d0d5dd",
                        borderRadius:
                          "14px",
                        background:
                          selected
                            ? "#f5f8ff"
                            : "#ffffff",
                        color:
                          "#101828",
                        cursor:
                          "pointer",
                        fontFamily:
                          "inherit",
                      }}
                    >
                      <strong
                        style={{
                          display:
                            "block",
                          fontSize:
                            "20px",
                        }}
                      >
                        {
                          policy.durationMonths
                        }
                        개월
                      </strong>

                      <span
                        style={{
                          display:
                            "block",
                          marginTop:
                            "7px",
                          color:
                            policy.discountRate >
                            0
                              ? "#175cd3"
                              : "#667085",
                          fontSize:
                            "12px",
                          fontWeight:
                            900,
                        }}
                      >
                        {policy.discountRate >
                        0
                          ? `${policy.discountRate}% 할인`
                          : "기본 수강"}
                      </span>
                    </button>
                  );
                }
              )}
            </div>
          </section>
        </div>

        <aside
          style={{
            position:
              "sticky",
            top: "20px",
            padding:
              "24px",
            borderRadius:
              "20px",
            background:
              "#0A1F44",
            color:
              "#ffffff",
            boxShadow:
              "0 18px 42px rgba(10,31,68,0.18)",
          }}
        >
          <div
            style={{
              color:
                "#a9c7ff",
              fontSize:
                "11px",
              fontWeight:
                900,
              letterSpacing:
                "0.1em",
            }}
          >
            PAYMENT SUMMARY
          </div>

          <h2
            style={{
              margin:
                "8px 0 0",
              fontSize:
                "23px",
              letterSpacing:
                "-0.03em",
            }}
          >
            결제금액
          </h2>

          <div
            style={{
              marginTop:
                "20px",
              display:
                "grid",
              gap: "11px",
            }}
          >
            <PriceRow
              label="수강기간"
              value={`${selectedMonths}개월`}
            />

            <PriceRow
              label="가격구분"
              value={
                getCategoryLabel(
                  pricing.pricingCategory
                )
              }
            />

            <PriceRow
              label="회당 수업료"
              value={`${formatMoney(
                pricing.pricePerLesson
              )}원`}
            />

            <PriceRow
              label="월 기준 수업"
              value={`${pricing.monthlyLessonCount}회`}
            />

            {weekendDayCount >
              0 && (
              <PriceRow
                label="주말 수업"
                value={`× ${pricing.weekendMultiplier}`}
              />
            )}
          </div>

          <div
            style={{
              marginTop:
                "20px",
              paddingTop:
                "18px",
              borderTop:
                "1px solid rgba(255,255,255,0.16)",
            }}
          >
            <PriceRow
              label="정상 수강료"
              value={`${formatMoney(
                regularPrice
              )}원`}
            />

            <div
              style={{
                marginTop:
                  "10px",
              }}
            >
              <PriceRow
                label={`기간 할인 (${discountRate}%)`}
                value={
                  discountAmount >
                  0
                    ? `- ${formatMoney(
                        discountAmount
                      )}원`
                    : "0원"
                }
                accent={
                  discountAmount >
                  0
                }
              />
            </div>
          </div>

          <div
            style={{
              marginTop:
                "22px",
              paddingTop:
                "20px",
              borderTop:
                "1px solid rgba(255,255,255,0.16)",
            }}
          >
            <div
              style={{
                color:
                  "rgba(255,255,255,0.7)",
                fontSize:
                  "12px",
              }}
            >
              최종 결제금액
            </div>

            <strong
              style={{
                display:
                  "block",
                marginTop:
                  "5px",
                fontSize:
                  "32px",
                letterSpacing:
                  "-0.04em",
              }}
            >
              {formatMoney(
                finalPrice
              )}
              원
            </strong>

            {discountAmount >
              0 && (
              <div
                style={{
                  marginTop:
                    "6px",
                  color:
                    "#9fe0bd",
                  fontSize:
                    "12px",
                  fontWeight:
                    900,
                }}
              >
                총{" "}
                {formatMoney(
                  discountAmount
                )}
                원 할인
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={
              saveAndContinue
            }
            disabled={
              isSaving
            }
            style={{
              width:
                "100%",
              minHeight:
                "52px",
              marginTop:
                "22px",
              border: 0,
              borderRadius:
                "12px",
              background:
                isSaving
                  ? "#98a2b3"
                  : "#ffffff",
              color:
                "#0A1F44",
              fontFamily:
                "inherit",
              fontSize:
                "14px",
              fontWeight:
                900,
              cursor:
                isSaving
                  ? "default"
                  : "pointer",
            }}
          >
            {isSaving
              ? "처리 중..."
              : "결제 진행 →"}
          </button>

          <div
            style={{
              marginTop:
                "10px",
              color:
                "rgba(255,255,255,0.62)",
              fontSize:
                "10px",
              lineHeight:
                1.6,
              textAlign:
                "center",
            }}
          >
            결제금액은 TALKLY 서버에서 다시 검증한 뒤
            토스페이먼츠 테스트 결제창으로 연결됩니다.
          </div>
        </aside>
      </section>

      {errorMessage && (
        <div
          style={{
            marginTop:
              "16px",
            padding:
              "14px 16px",
            borderRadius:
              "12px",
            border:
              "1px solid #fecdca",
            background:
              "#fef3f2",
            color:
              "#b42318",
            fontSize:
              "13px",
            fontWeight:
              700,
          }}
        >
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div
          style={{
            marginTop:
              "16px",
            padding:
              "16px",
            borderRadius:
              "12px",
            border:
              "1px solid #abefc6",
            background:
              "#ecfdf3",
            color:
              "#067647",
            fontSize:
              "13px",
            fontWeight:
              800,
            lineHeight:
              1.7,
          }}
        >
          {successMessage}
        </div>
      )}

      <div
        style={{
          marginTop:
            "20px",
          display:
            "flex",
          justifyContent:
            "flex-start",
        }}
      >
        <Link
          href={`/parent/children/${childId}/enrollment-requests`}
          style={{
            minHeight:
              "46px",
            padding:
              "0 18px",
            display:
              "inline-flex",
            alignItems:
              "center",
            justifyContent:
              "center",
            border:
              "1px solid #d0d5dd",
            borderRadius:
              "11px",
            background:
              "#ffffff",
            color:
              "#344054",
            textDecoration:
              "none",
            fontSize:
              "13px",
            fontWeight:
              900,
          }}
        >
          ← 돌아가기
        </Link>
      </div>

      <style>{`
        @media (max-width: 820px) {
          .payment-layout {
            grid-template-columns: 1fr !important;
          }

          .payment-layout aside {
            position: static !important;
          }
        }

        @media (max-width: 620px) {
          .duration-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }
      `}</style>
    </>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        padding:
          "15px 16px",
        border:
          "1px solid #eaecf0",
        borderRadius:
          "13px",
        background:
          "#fcfdff",
      }}
    >
      <div
        style={{
          color:
            "#667085",
          fontSize:
            "10px",
          fontWeight:
            800,
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop:
            "5px",
          color:
            "#101828",
          fontSize:
            "13px",
          lineHeight:
            1.55,
          fontWeight:
            900,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function PriceRow({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        display:
          "flex",
        justifyContent:
          "space-between",
        gap: "14px",
        alignItems:
          "center",
      }}
    >
      <span
        style={{
          color:
            "rgba(255,255,255,0.68)",
          fontSize:
            "11px",
        }}
      >
        {label}
      </span>

      <strong
        style={{
          color:
            accent
              ? "#9fe0bd"
              : "#ffffff",
          fontSize:
            "12px",
          textAlign:
            "right",
        }}
      >
        {value}
      </strong>
    </div>
  );
}