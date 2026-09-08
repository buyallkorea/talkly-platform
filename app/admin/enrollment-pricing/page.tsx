import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

type PricingCategory =
  | "western"
  | "philippines"
  | "special"
  | "intensive";

type PricingRow = {
  id: number;
  pricing_category: string | null;
  lesson_duration_minutes: number;
  lessons_per_week: number | null;
  monthly_lesson_count: number | null;
  price_per_lesson: number;
  weekend_multiplier: number;
  is_active: boolean;
};

type DiscountRow = {
  id: number;
  duration_months: number;
  discount_rate: number;
  is_active: boolean;
};

type PricingSummary = {
  category: PricingCategory;
  duration: number;
  pricePerLesson: number;
  weekendMultiplier: number;
  active: boolean;
  lessonCounts: {
    lessonsPerWeek: number;
    monthlyLessonCount: number;
  }[];
};

const CATEGORY_ORDER: PricingCategory[] = [
  "western",
  "philippines",
  "special",
  "intensive",
];

const CATEGORY_META: Record<
  PricingCategory,
  {
    label: string;
    description: string;
    badge: string;
  }
> = {
  western: {
    label: "Western",
    description: "서구권 원어민 강사 수업",
    badge: "WESTERN",
  },
  philippines: {
    label: "Philippines",
    description: "필리핀 강사 수업",
    badge: "PHILIPPINES",
  },
  special: {
    label: "Special",
    description: "특별 프로그램 수업",
    badge: "SPECIAL",
  },
  intensive: {
    label: "Intensive",
    description: "집중 프로그램 수업",
    badge: "INTENSIVE",
  },
};

function formatWon(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function parsePositiveNumber(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

async function requireAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "admin") {
    redirect("/");
  }

  return user;
}

async function updatePricing(formData: FormData) {
  "use server";

  await requireAdmin();

  const category = String(
    formData.get("pricing_category") ?? ""
  ) as PricingCategory;

  const duration = Number(
    formData.get("lesson_duration_minutes")
  );

  const pricePerLesson = parsePositiveNumber(
    formData.get("price_per_lesson")
  );

  const weekendMultiplier = parsePositiveNumber(
    formData.get("weekend_multiplier")
  );

  if (!CATEGORY_ORDER.includes(category)) {
    throw new Error("올바르지 않은 가격 유형입니다.");
  }

  if (![25, 50].includes(duration)) {
    throw new Error("올바르지 않은 수업시간입니다.");
  }

  if (
    pricePerLesson === null ||
    !Number.isInteger(pricePerLesson)
  ) {
    throw new Error("회당 수강료를 확인해 주세요.");
  }

  if (
    weekendMultiplier === null ||
    weekendMultiplier < 1
  ) {
    throw new Error("주말 배수를 확인해 주세요.");
  }

  const admin = createAdminClient();

  const { error } = await admin
    .from("course_pricing")
    .update({
      price_per_lesson: pricePerLesson,
      weekend_multiplier: weekendMultiplier,
      updated_at: new Date().toISOString(),
    })
    .eq("pricing_category", category)
    .eq("lesson_duration_minutes", duration)
    .in("lessons_per_week", [1, 2, 3, 4, 5])
    .eq("is_active", true);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/enrollment-pricing");
}

async function updateDiscount(formData: FormData) {
  "use server";

  await requireAdmin();

  const id = Number(formData.get("discount_id"));
  const discountRate = parsePositiveNumber(
    formData.get("discount_rate")
  );

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("할인정책 ID가 올바르지 않습니다.");
  }

  if (
    discountRate === null ||
    discountRate > 100
  ) {
    throw new Error("할인율은 0~100 사이여야 합니다.");
  }

  const admin = createAdminClient();

  const { error } = await admin
    .from("enrollment_discount_policies")
    .update({
      discount_rate: discountRate,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/enrollment-pricing");
}

export default async function EnrollmentPricingPage() {
  await requireAdmin();

  const admin = createAdminClient();

  const [
    { data: pricingData, error: pricingError },
    { data: discountData, error: discountError },
  ] = await Promise.all([
    admin
      .from("course_pricing")
      .select(
        `
          id,
          pricing_category,
          lesson_duration_minutes,
          lessons_per_week,
          monthly_lesson_count,
          price_per_lesson,
          weekend_multiplier,
          is_active
        `
      )
      .in("pricing_category", CATEGORY_ORDER)
      .in("lesson_duration_minutes", [25, 50])
      .in("lessons_per_week", [1, 2, 3, 4, 5])
      .eq("is_active", true)
      .order("pricing_category")
      .order("lesson_duration_minutes")
      .order("lessons_per_week"),

    admin
      .from("enrollment_discount_policies")
      .select(
        `
          id,
          duration_months,
          discount_rate,
          is_active
        `
      )
      .order("duration_months"),
  ]);

  if (pricingError) {
    throw new Error(pricingError.message);
  }

  if (discountError) {
    throw new Error(discountError.message);
  }

  const pricingRows =
    (pricingData ?? []) as PricingRow[];

  const discountRows =
    (discountData ?? []) as DiscountRow[];

  const summaries: PricingSummary[] = [];

  for (const category of CATEGORY_ORDER) {
    for (const duration of [25, 50]) {
      const rows = pricingRows.filter(
        (row) =>
          row.pricing_category === category &&
          row.lesson_duration_minutes === duration
      );

      if (rows.length === 0) {
        continue;
      }

      const first = rows[0];

      const lessonCountMap = new Map<
        number,
        number
      >();

      for (const row of rows) {
        if (
          row.lessons_per_week &&
          row.monthly_lesson_count
        ) {
          lessonCountMap.set(
            row.lessons_per_week,
            row.monthly_lesson_count
          );
        }
      }

      summaries.push({
        category,
        duration,
        pricePerLesson: Number(
          first.price_per_lesson
        ),
        weekendMultiplier: Number(
          first.weekend_multiplier
        ),
        active: rows.some((row) => row.is_active),
        lessonCounts: [1, 2, 3, 4, 5].map(
          (lessonsPerWeek) => ({
            lessonsPerWeek,
            monthlyLessonCount:
              lessonCountMap.get(
                lessonsPerWeek
              ) ?? lessonsPerWeek * 4,
          })
        ),
      });
    }
  }

  const activeDiscounts = discountRows.filter(
    (row) => row.is_active
  );

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(180deg, #f7f9fc 0%, #eef3f9 100%)",
        padding: "34px 24px 70px",
      }}
    >
      <div
        style={{
          maxWidth: 1240,
          margin: "0 auto",
        }}
      >
        {/* Header */}
        <section
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 20,
            marginBottom: 24,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: "#53719d",
                letterSpacing: "0.08em",
                marginBottom: 8,
              }}
            >
              ENROLLMENT PRICING
            </div>

            <h1
              style={{
                margin: 0,
                color: "#0a1f44",
                fontSize: 32,
                lineHeight: 1.25,
              }}
            >
              수강료 · 할인 관리
            </h1>

            <p
              style={{
                margin: "10px 0 0",
                color: "#64748b",
                fontSize: 14,
                lineHeight: 1.7,
              }}
            >
              신규 수강신청에 적용되는 회당
              수강료와 기간 할인정책을 관리합니다.
            </p>
          </div>

          <a
            href="/admin"
            style={{
              textDecoration: "none",
              color: "#475569",
              fontSize: 14,
              fontWeight: 700,
              border: "1px solid #dbe3ee",
              background: "#ffffff",
              borderRadius: 12,
              padding: "11px 15px",
            }}
          >
            ← 관리자 홈
          </a>
        </section>

        {/* Important notice */}
        <section
          style={{
            borderRadius: 18,
            padding: "18px 20px",
            background: "#eef5ff",
            border: "1px solid #d5e5fb",
            marginBottom: 24,
          }}
        >
          <div
            style={{
              color: "#153c75",
              fontSize: 14,
              fontWeight: 800,
              marginBottom: 5,
            }}
          >
            가격정책 적용 기준
          </div>

          <div
            style={{
              color: "#52657e",
              fontSize: 13,
              lineHeight: 1.7,
            }}
          >
            이 화면에서 변경한 가격은 앞으로
            생성되는 수강신청의 가격 계산에
            사용됩니다. 이미 신청된 건에 저장된
            가격 스냅샷은 변경하지 않습니다.
          </div>
        </section>

        {/* Pricing */}
        <section
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: 22,
            overflow: "hidden",
            boxShadow:
              "0 8px 30px rgba(15, 23, 42, 0.04)",
            marginBottom: 24,
          }}
        >
          <div
            style={{
              padding: "22px 24px",
              borderBottom:
                "1px solid #edf1f5",
            }}
          >
            <h2
              style={{
                margin: 0,
                color: "#0f274f",
                fontSize: 20,
              }}
            >
              기본 수강료
            </h2>

            <p
              style={{
                margin: "7px 0 0",
                color: "#7a889c",
                fontSize: 13,
              }}
            >
              가격 유형과 수업시간별 회당
              수강료를 관리합니다.
            </p>
          </div>

          <div
            style={{
              padding: 24,
              display: "grid",
              gap: 20,
            }}
          >
            {CATEGORY_ORDER.map((category) => {
              const categoryRows =
                summaries.filter(
                  (item) =>
                    item.category === category
                );

              if (categoryRows.length === 0) {
                return null;
              }

              const meta =
                CATEGORY_META[category];

              return (
                <div
                  key={category}
                  style={{
                    border:
                      "1px solid #e5eaf1",
                    borderRadius: 18,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      padding: "18px 20px",
                      background: "#f8fafc",
                      borderBottom:
                        "1px solid #e8edf3",
                      display: "flex",
                      justifyContent:
                        "space-between",
                      alignItems: "center",
                      gap: 16,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <strong
                          style={{
                            color: "#102a56",
                            fontSize: 17,
                          }}
                        >
                          {meta.label}
                        </strong>

                        <span
                          style={{
                            background:
                              "#eaf1fb",
                            color: "#42648e",
                            padding: "4px 8px",
                            borderRadius: 999,
                            fontSize: 10,
                            fontWeight: 800,
                            letterSpacing:
                              "0.05em",
                          }}
                        >
                          {meta.badge}
                        </span>
                      </div>

                      <div
                        style={{
                          color: "#7a8798",
                          fontSize: 12,
                          marginTop: 5,
                        }}
                      >
                        {meta.description}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      padding: 20,
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(360px, 1fr))",
                      gap: 16,
                    }}
                  >
                    {categoryRows.map(
                      (item) => (
                        <form
                          key={`${item.category}-${item.duration}`}
                          action={
                            updatePricing
                          }
                          style={{
                            border:
                              "1px solid #e6ebf2",
                            borderRadius: 16,
                            padding: 18,
                            background:
                              "#ffffff",
                          }}
                        >
                          <input
                            type="hidden"
                            name="pricing_category"
                            value={
                              item.category
                            }
                          />

                          <input
                            type="hidden"
                            name="lesson_duration_minutes"
                            value={
                              item.duration
                            }
                          />

                          <div
                            style={{
                              display: "flex",
                              justifyContent:
                                "space-between",
                              alignItems:
                                "center",
                              marginBottom: 16,
                            }}
                          >
                            <div>
                              <strong
                                style={{
                                  color:
                                    "#172b4d",
                                  fontSize: 16,
                                }}
                              >
                                {
                                  item.duration
                                }
                                분 수업
                              </strong>

                              <div
                                style={{
                                  marginTop: 4,
                                  color:
                                    "#8995a6",
                                  fontSize: 11,
                                }}
                              >
                                1 LESSON
                              </div>
                            </div>

                            <span
                              style={{
                                padding:
                                  "5px 9px",
                                borderRadius:
                                  999,
                                background:
                                  item.active
                                    ? "#ecfdf3"
                                    : "#f1f5f9",
                                color:
                                  item.active
                                    ? "#18864b"
                                    : "#64748b",
                                fontSize: 11,
                                fontWeight: 800,
                              }}
                            >
                              {item.active
                                ? "사용중"
                                : "비활성"}
                            </span>
                          </div>

                          <label
                            style={{
                              display:
                                "block",
                              marginBottom: 14,
                            }}
                          >
                            <span
                              style={{
                                display:
                                  "block",
                                color:
                                  "#5e6c80",
                                fontSize: 12,
                                fontWeight: 700,
                                marginBottom: 7,
                              }}
                            >
                              회당 수강료
                            </span>

                            <div
                              style={{
                                display:
                                  "flex",
                                alignItems:
                                  "center",
                                gap: 8,
                              }}
                            >
                              <input
                                type="number"
                                name="price_per_lesson"
                                min="0"
                                step="100"
                                defaultValue={
                                  item.pricePerLesson
                                }
                                required
                                style={{
                                  width: "100%",
                                  border:
                                    "1px solid #d9e1eb",
                                  borderRadius:
                                    10,
                                  padding:
                                    "11px 12px",
                                  fontSize: 14,
                                  fontWeight: 700,
                                  color:
                                    "#1e293b",
                                  outline:
                                    "none",
                                }}
                              />

                              <span
                                style={{
                                  whiteSpace:
                                    "nowrap",
                                  color:
                                    "#64748b",
                                  fontSize: 13,
                                }}
                              >
                                원
                              </span>
                            </div>
                          </label>

                          <label
                            style={{
                              display:
                                "block",
                              marginBottom: 15,
                            }}
                          >
                            <span
                              style={{
                                display:
                                  "block",
                                color:
                                  "#5e6c80",
                                fontSize: 12,
                                fontWeight: 700,
                                marginBottom: 7,
                              }}
                            >
                              주말 수업 배수
                            </span>

                            <div
                              style={{
                                display:
                                  "flex",
                                alignItems:
                                  "center",
                                gap: 8,
                              }}
                            >
                              <input
                                type="number"
                                name="weekend_multiplier"
                                min="1"
                                max="5"
                                step="0.05"
                                defaultValue={
                                  item.weekendMultiplier
                                }
                                required
                                style={{
                                  width: "100%",
                                  border:
                                    "1px solid #d9e1eb",
                                  borderRadius:
                                    10,
                                  padding:
                                    "11px 12px",
                                  fontSize: 14,
                                  fontWeight: 700,
                                  color:
                                    "#1e293b",
                                }}
                              />

                              <span
                                style={{
                                  whiteSpace:
                                    "nowrap",
                                  color:
                                    "#64748b",
                                  fontSize: 13,
                                }}
                              >
                                배
                              </span>
                            </div>
                          </label>

                          <div
                            style={{
                              background:
                                "#f8fafc",
                              borderRadius: 12,
                              padding:
                                "12px 14px",
                              marginBottom: 15,
                            }}
                          >
                            <div
                              style={{
                                color:
                                  "#66758a",
                                fontSize: 11,
                                fontWeight: 800,
                                marginBottom: 8,
                              }}
                            >
                              월 수업횟수
                            </div>

                            <div
                              style={{
                                display:
                                  "flex",
                                flexWrap:
                                  "wrap",
                                gap: 6,
                              }}
                            >
                              {item.lessonCounts.map(
                                (count) => (
                                  <span
                                    key={
                                      count.lessonsPerWeek
                                    }
                                    style={{
                                      border:
                                        "1px solid #e2e8f0",
                                      background:
                                        "#ffffff",
                                      borderRadius:
                                        8,
                                      padding:
                                        "6px 8px",
                                      color:
                                        "#526174",
                                      fontSize:
                                        11,
                                    }}
                                  >
                                    주
                                    {
                                      count.lessonsPerWeek
                                    }
                                    회 · 월
                                    {
                                      count.monthlyLessonCount
                                    }
                                    회
                                  </span>
                                )
                              )}
                            </div>
                          </div>

                          <div
                            style={{
                              display:
                                "flex",
                              justifyContent:
                                "space-between",
                              alignItems:
                                "center",
                              gap: 12,
                            }}
                          >
                            <div
                              style={{
                                color:
                                  "#8290a3",
                                fontSize: 11,
                              }}
                            >
                              현재{" "}
                              <strong
                                style={{
                                  color:
                                    "#4f6178",
                                }}
                              >
                                {formatWon(
                                  item.pricePerLesson
                                )}
                                원
                              </strong>
                            </div>

                            <button
                              type="submit"
                              style={{
                                border: 0,
                                borderRadius:
                                  10,
                                padding:
                                  "10px 16px",
                                background:
                                  "#0a1f44",
                                color:
                                  "#ffffff",
                                fontSize: 12,
                                fontWeight: 800,
                                cursor:
                                  "pointer",
                              }}
                            >
                              가격 저장
                            </button>
                          </div>
                        </form>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Discount policies */}
        <section
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: 22,
            overflow: "hidden",
            boxShadow:
              "0 8px 30px rgba(15, 23, 42, 0.04)",
          }}
        >
          <div
            style={{
              padding: "22px 24px",
              borderBottom:
                "1px solid #edf1f5",
            }}
          >
            <h2
              style={{
                margin: 0,
                color: "#0f274f",
                fontSize: 20,
              }}
            >
              기간 할인
            </h2>

            <p
              style={{
                margin: "7px 0 0",
                color: "#7a889c",
                fontSize: 13,
              }}
            >
              학부모가 배정 완료 후 선택하는
              수강기간별 할인율입니다.
            </p>
          </div>

          <div
            style={{
              padding: 24,
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(210px, 1fr))",
              gap: 14,
            }}
          >
            {activeDiscounts.map(
              (discount) => (
                <form
                  key={discount.id}
                  action={updateDiscount}
                  style={{
                    border:
                      "1px solid #e5eaf1",
                    borderRadius: 16,
                    padding: 18,
                    background: "#ffffff",
                  }}
                >
                  <input
                    type="hidden"
                    name="discount_id"
                    value={discount.id}
                  />

                  <div
                    style={{
                      display: "flex",
                      justifyContent:
                        "space-between",
                      alignItems: "center",
                      marginBottom: 16,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 20,
                          fontWeight: 900,
                          color: "#0a1f44",
                        }}
                      >
                        {discount.duration_months}
                        개월
                      </div>

                      <div
                        style={{
                          marginTop: 3,
                          color: "#8a97a8",
                          fontSize: 11,
                        }}
                      >
                        COURSE PERIOD
                      </div>
                    </div>

                    <span
                      style={{
                        borderRadius: 999,
                        padding: "5px 9px",
                        background:
                          discount.discount_rate >
                          0
                            ? "#fff7e8"
                            : "#f1f5f9",
                        color:
                          discount.discount_rate >
                          0
                            ? "#9a6412"
                            : "#64748b",
                        fontSize: 11,
                        fontWeight: 800,
                      }}
                    >
                      {discount.discount_rate >
                      0
                        ? `${discount.discount_rate}% 할인`
                        : "할인 없음"}
                    </span>
                  </div>

                  <label>
                    <span
                      style={{
                        display: "block",
                        color: "#5e6c80",
                        fontSize: 12,
                        fontWeight: 700,
                        marginBottom: 7,
                      }}
                    >
                      할인율
                    </span>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <input
                        type="number"
                        name="discount_rate"
                        min="0"
                        max="100"
                        step="0.01"
                        defaultValue={
                          discount.discount_rate
                        }
                        required
                        style={{
                          width: "100%",
                          border:
                            "1px solid #d9e1eb",
                          borderRadius: 10,
                          padding:
                            "11px 12px",
                          fontSize: 14,
                          fontWeight: 700,
                          color: "#1e293b",
                        }}
                      />

                      <span
                        style={{
                          color: "#64748b",
                          fontSize: 13,
                        }}
                      >
                        %
                      </span>
                    </div>
                  </label>

                  <button
                    type="submit"
                    style={{
                      width: "100%",
                      marginTop: 15,
                      border: 0,
                      borderRadius: 10,
                      padding: "10px 14px",
                      background: "#0a1f44",
                      color: "#ffffff",
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                  >
                    할인율 저장
                  </button>
                </form>
              )
            )}
          </div>
        </section>

        <section
          style={{
            marginTop: 20,
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(250px, 1fr))",
            gap: 12,
          }}
        >
          <div
            style={{
              border: "1px solid #e2e8f0",
              background: "#ffffff",
              borderRadius: 15,
              padding: 16,
            }}
          >
            <strong
              style={{
                display: "block",
                color: "#263b5d",
                fontSize: 13,
                marginBottom: 5,
              }}
            >
              주말 수업
            </strong>

            <span
              style={{
                color: "#77869a",
                fontSize: 12,
                lineHeight: 1.6,
              }}
            >
              주말 수업은 해당 회차에만 설정된
              주말 배수를 적용합니다.
            </span>
          </div>

          <div
            style={{
              border: "1px solid #e2e8f0",
              background: "#ffffff",
              borderRadius: 15,
              padding: 16,
            }}
          >
            <strong
              style={{
                display: "block",
                color: "#263b5d",
                fontSize: 13,
                marginBottom: 5,
              }}
            >
              기존 신청 가격 보호
            </strong>

            <span
              style={{
                color: "#77869a",
                fontSize: 12,
                lineHeight: 1.6,
              }}
            >
              가격 변경은 기존 신청 건의 저장된
              가격정보를 수정하지 않습니다.
            </span>
          </div>

          <div
            style={{
              border: "1px solid #e2e8f0",
              background: "#ffffff",
              borderRadius: 15,
              padding: 16,
            }}
          >
            <strong
              style={{
                display: "block",
                color: "#263b5d",
                fontSize: 13,
                marginBottom: 5,
              }}
            >
              Legacy 가격
            </strong>

            <span
              style={{
                color: "#77869a",
                fontSize: 12,
                lineHeight: 1.6,
              }}
            >
              이전 25/45/60분 가격정책은
              비활성화되어 이 화면과 신규 계산에서
              제외됩니다.
            </span>
          </div>
        </section>
      </div>
    </main>
  );
}