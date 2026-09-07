import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";

import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

import PaymentPreparation from "./PaymentPreparation";

type PageProps = {
  params: Promise<{
    id: string;
    requestId: string;
  }>;
};

type EnrollmentRequestRow = {
  id: number;
  applicant_user_id: string;
  child_id: number;
  course_id: number;
  status: string;
  assigned_teacher_user_id: string | null;
  assigned_days: string[] | null;
  assigned_times: Record<string, string> | null;
  assigned_lesson_duration_minutes: number | null;
  assigned_lessons_per_week: number | null;
  assignment_confirmed_at: string | null;
  pricing_category: string | null;
  course_pricing_id: number | null;
  duration_months: number | null;
  monthly_lesson_count: number | null;
  regular_price: number | null;
  discount_rate: number | null;
  discount_amount: number | null;
  final_price: number | null;
};

type PricingRow = {
  id: number;
  course_id: number;
  lesson_duration_minutes: number;
  price_per_lesson: number;
  weekend_multiplier: number;
  pricing_category: string;
  lessons_per_week: number | null;
  monthly_lesson_count: number | null;
};

type DiscountPolicyRow = {
  id: number;
  duration_months: number;
  discount_rate: number;
};

const DAY_LABELS: Record<string, string> = {
  Sunday: "일",
  Monday: "월",
  Tuesday: "화",
  Wednesday: "수",
  Thursday: "목",
  Friday: "금",
  Saturday: "토",
};

function getPricingCategory(
  savedCategory: string | null,
  nationality: string | null
) {
  if (
    savedCategory &&
    [
      "philippines",
      "western",
      "special",
      "intensive",
    ].includes(savedCategory)
  ) {
    return savedCategory;
  }

  const normalized =
    (nationality ?? "")
      .trim()
      .toLowerCase();

  if (
    normalized.includes("philipp") ||
    normalized.includes("필리핀")
  ) {
    return "philippines";
  }

  /*
   * 현재 teacher_profiles에는 별도 가격등급 필드가 없으므로,
   * 기존 신청에 pricing_category가 저장되어 있지 않은 경우
   * 필리핀 강사 외 등록 원어민은 western으로 계산합니다.
   *
   * special / intensive는 향후 관리자에서
   * pricing_category를 명시적으로 지정할 때 그대로 사용됩니다.
   */
  return "western";
}

function scheduleText(
  days: string[] | null,
  times: Record<string, string> | null
) {
  return (days ?? [])
    .map(
      (day) =>
        `${DAY_LABELS[day] ?? day} ${
          times?.[day] ?? "-"
        }`
    )
    .join(" · ");
}

export default async function ParentEnrollmentRequestPaymentPage({
  params,
}: PageProps) {
  const {
    id,
    requestId,
  } = await params;

  const childId = Number(id);
  const enrollmentRequestId =
    Number(requestId);

  if (
    !Number.isInteger(childId) ||
    childId <= 0 ||
    !Number.isInteger(
      enrollmentRequestId
    ) ||
    enrollmentRequestId <= 0
  ) {
    notFound();
  }

  const supabase =
    await createClient();

  const {
    data: { user },
  } =
    await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const {
    data: profile,
  } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (
    !profile ||
    profile.role !== "parent"
  ) {
    redirect("/");
  }

  const {
    data: child,
    error: childError,
  } = await supabase
    .from("children")
    .select(`
      id,
      name
    `)
    .eq("id", childId)
    .eq(
      "parent_user_id",
      user.id
    )
    .eq("is_active", true)
    .maybeSingle();

  if (
    childError ||
    !child
  ) {
    notFound();
  }

  const adminClient =
    createAdminClient();

  const {
    data: requestData,
    error: requestError,
  } = await adminClient
    .from("enrollment_requests")
    .select(`
      id,
      applicant_user_id,
      child_id,
      course_id,
      status,
      assigned_teacher_user_id,
      assigned_days,
      assigned_times,
      assigned_lesson_duration_minutes,
      assigned_lessons_per_week,
      assignment_confirmed_at,
      pricing_category,
      course_pricing_id,
      duration_months,
      monthly_lesson_count,
      regular_price,
      discount_rate,
      discount_amount,
      final_price
    `)
    .eq(
      "id",
      enrollmentRequestId
    )
    .eq(
      "applicant_user_id",
      user.id
    )
    .eq(
      "child_id",
      childId
    )
    .maybeSingle();

  if (requestError) {
    throw new Error(
      `수강신청 정보를 불러오지 못했습니다: ${requestError.message}`
    );
  }

  if (!requestData) {
    notFound();
  }

  const request =
    requestData as EnrollmentRequestRow;

  const assigned =
    Boolean(
      request.assigned_teacher_user_id &&
        request.assignment_confirmed_at &&
        request.assigned_lesson_duration_minutes &&
        request.assigned_lessons_per_week
    );

  if (!assigned) {
    redirect(
      `/parent/children/${childId}/enrollment-requests`
    );
  }

  const [
    courseResult,
    teacherResult,
    discountResult,
  ] =
    await Promise.all([
      adminClient
        .from("courses")
        .select(
          "id, name"
        )
        .eq(
          "id",
          request.course_id
        )
        .maybeSingle(),

      adminClient
        .from(
          "teacher_profiles"
        )
        .select(`
          user_id,
          display_name,
          nationality
        `)
        .eq(
          "user_id",
          request.assigned_teacher_user_id!
        )
        .maybeSingle(),

      adminClient
        .from(
          "enrollment_discount_policies"
        )
        .select(`
          id,
          duration_months,
          discount_rate
        `)
        .eq(
          "is_active",
          true
        )
        .order(
          "duration_months",
          {
            ascending: true,
          }
        ),
    ]);

  if (
    courseResult.error ||
    !courseResult.data
  ) {
    throw new Error(
      "과정 정보를 불러올 수 없습니다."
    );
  }

  if (
    teacherResult.error ||
    !teacherResult.data
  ) {
    throw new Error(
      "배정된 강사 정보를 불러올 수 없습니다."
    );
  }

  if (discountResult.error) {
    throw new Error(
      `기간 할인정책을 불러오지 못했습니다: ${discountResult.error.message}`
    );
  }

  const pricingCategory =
    getPricingCategory(
      request.pricing_category,
      teacherResult.data.nationality
    );

  const {
    data: pricingData,
    error: pricingError,
  } = await adminClient
    .from("course_pricing")
    .select(`
      id,
      course_id,
      lesson_duration_minutes,
      price_per_lesson,
      weekend_multiplier,
      pricing_category,
      lessons_per_week,
      monthly_lesson_count
    `)
    .eq(
      "course_id",
      request.course_id
    )
    .eq(
      "lesson_duration_minutes",
      request.assigned_lesson_duration_minutes!
    )
    .eq(
      "lessons_per_week",
      request.assigned_lessons_per_week!
    )
    .eq(
      "pricing_category",
      pricingCategory
    )
    .eq(
      "is_active",
      true
    )
    .maybeSingle();

  if (pricingError) {
    throw new Error(
      `수강료 정보를 불러오지 못했습니다: ${pricingError.message}`
    );
  }

  if (!pricingData) {
    throw new Error(
      "현재 배정 조건에 맞는 수강료가 등록되어 있지 않습니다."
    );
  }

  const pricing =
    pricingData as PricingRow;

  const discounts =
    (
      discountResult.data ??
      []
    ) as DiscountPolicyRow[];

  if (
    discounts.length === 0
  ) {
    throw new Error(
      "사용 가능한 수강기간 할인정책이 없습니다."
    );
  }

  const schedule =
    scheduleText(
      request.assigned_days,
      request.assigned_times
    );

  return (
    <main
      style={{
        minHeight:
          "100vh",
        background:
          "linear-gradient(180deg, #f5f8ff 0%, #ffffff 48%, #f8fbff 100%)",
      }}
    >
      <div
        style={{
          maxWidth:
            "1120px",
          margin:
            "0 auto",
          padding:
            "34px 20px 90px",
        }}
      >
        <Link
          href={`/parent/children/${childId}/enrollment-requests`}
          style={{
            display:
              "inline-flex",
            alignItems:
              "center",
            color:
              "#475467",
            textDecoration:
              "none",
            fontSize:
              "13px",
            fontWeight:
              800,
          }}
        >
          ← 수강 준비 현황
        </Link>

        <section
          style={{
            position:
              "relative",
            overflow:
              "hidden",
            marginTop:
              "18px",
            padding:
              "34px 36px",
            borderRadius:
              "24px",
            background:
              "linear-gradient(135deg, #0A1F44 0%, #164c96 58%, #3978ef 100%)",
            boxShadow:
              "0 18px 45px rgba(10,31,68,0.16)",
          }}
        >
          <div
            style={{
              position:
                "absolute",
              width:
                "230px",
              height:
                "230px",
              top: "-95px",
              right:
                "-50px",
              borderRadius:
                "999px",
              background:
                "rgba(255,255,255,0.08)",
            }}
          />

          <div
            style={{
              position:
                "relative",
              zIndex: 1,
            }}
          >
            <div
              style={{
                color:
                  "#b8d0ff",
                fontSize:
                  "12px",
                fontWeight:
                  900,
                letterSpacing:
                  "0.13em",
              }}
            >
              TALKLY PAYMENT
            </div>

            <h1
              style={{
                margin:
                  "10px 0 0",
                color:
                  "#ffffff",
                fontSize:
                  "clamp(29px, 5vw, 44px)",
                lineHeight:
                  1.15,
                letterSpacing:
                  "-0.04em",
              }}
            >
              수강기간과
              <br />
              결제금액을 확인해 주세요
            </h1>

            <p
              style={{
                margin:
                  "15px 0 0",
                color:
                  "rgba(255,255,255,0.82)",
                fontSize:
                  "14px",
                lineHeight:
                  1.75,
              }}
            >
              배정된 수업 조건은
              그대로 유지되며,
              수강기간만 선택하면
              할인과 최종 금액이
              자동으로 계산됩니다.
            </p>
          </div>
        </section>

        <PaymentPreparation
          requestId={
            request.id
          }
          childId={
            child.id
          }
          childName={
            child.name
          }
          courseName={
            courseResult.data.name
          }
          teacherName={
            teacherResult.data
              .display_name ??
            "Teacher"
          }
          teacherNationality={
            teacherResult.data
              .nationality
          }
          schedule={
            schedule
          }
          assignedDays={
            request.assigned_days ??
            []
          }
          lessonDurationMinutes={
            request.assigned_lesson_duration_minutes!
          }
          lessonsPerWeek={
            request.assigned_lessons_per_week!
          }
          pricing={{
            id:
              pricing.id,
            pricingCategory:
              pricing.pricing_category,
            pricePerLesson:
              Number(
                pricing.price_per_lesson
              ),
            monthlyLessonCount:
              Number(
                pricing.monthly_lesson_count ??
                  0
              ),
            weekendMultiplier:
              Number(
                pricing.weekend_multiplier
              ),
          }}
          discountPolicies={discounts.map(
            (policy) => ({
              id:
                policy.id,
              durationMonths:
                Number(
                  policy.duration_months
                ),
              discountRate:
                Number(
                  policy.discount_rate
                ),
            })
          )}
          savedSelection={{
            durationMonths:
              request.duration_months,
            finalPrice:
              request.final_price,
          }}
        />
      </div>
    </main>
  );
}