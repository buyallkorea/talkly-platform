import Link from "next/link";
import { createAdminClient } from "@/lib/supabase-admin";
import PaymentPreparation from "@/app/student/enrollment-requests/[requestId]/PaymentPreparation";

type Request = {
  id: number;
  application_number: string | null;
  course_id: number;
  pricing_category: string | null;
  duration_months: number | null;
  lesson_duration_minutes: number;
  lessons_per_week: number;
  preferred_days: string[];
  preferred_time_candidates: string[];
  final_price: number | null;
};

const weekdayNames: Record<string, string> = {
  Monday: "월", Tuesday: "화", Wednesday: "수", Thursday: "목", Friday: "금",
  Saturday: "토", Sunday: "일",
};

export default async function PreAssignmentCheckout({
  request,
  childId,
  studentName,
}: {
  request: Request;
  childId: number | null;
  studentName: string;
}) {
  // Caller has already verified the logged-in applicant and child ownership.
  const admin = createAdminClient();
  const home = childId === null
    ? "/student/enrollment-requests"
    : `/parent/children/${childId}/enrollment-requests`;
  const [courseResult, pricingResult, discountsResult, paidResult] = await Promise.all([
    admin.from("courses").select("name").eq("id", request.course_id).maybeSingle(),
    admin.from("course_pricing")
      .select("id,pricing_category,price_per_lesson,monthly_lesson_count,weekend_multiplier")
      .eq("course_id", request.course_id)
      .eq("lesson_duration_minutes", request.lesson_duration_minutes)
      .eq("lessons_per_week", request.lessons_per_week)
      .eq("pricing_category", request.pricing_category ?? "")
      .eq("is_active", true)
      .maybeSingle(),
    admin.from("enrollment_discount_policies")
      .select("id,duration_months,discount_rate")
      .eq("duration_months", request.duration_months)
      .eq("is_active", true),
    admin.from("enrollment_payments")
      .select("id,status,approved_at")
      .eq("enrollment_request_id", request.id)
      .in("status", ["paid", "confirming"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (paidResult.error) throw new Error("결제 상태를 확인하지 못했습니다.");
  const paid = paidResult.data?.status === "paid";
  if (paid || paidResult.data?.status === "confirming") {
    return (
      <main style={{ maxWidth: 840, margin: "45px auto", padding: "22px" }}>
        <section style={{ border: "1px solid #d1fadf", borderRadius: 18, padding: 30, background: "#f6fef9" }}>
          <h1 style={{ color: "#05603a" }}>{paid ? "수강료 결제 완료 · 강사 배정 대기" : "결제 승인 처리 중"}</h1>
          <p style={{ lineHeight: 1.8 }}>
            신청번호 <strong>{request.application_number ?? request.id}</strong>.
            {paid
              ? " 수강료 결제를 확인했습니다. 관리자가 학생 수준과 강사의 실제 가능시간을 검토하여 배정한 후 수업 일정이 확정됩니다."
              : " 결제 처리 상태를 확인 중입니다. 중복 결제하지 마시고 잠시 후 신청현황에서 확인해 주세요."}
          </p>
          <Link href={home}>내 수강신청 현황 확인</Link>
        </section>
      </main>
    );
  }

  if (courseResult.error || !courseResult.data || pricingResult.error || !pricingResult.data ||
      discountsResult.error || !discountsResult.data?.length || !request.duration_months) {
    return (
      <main style={{ maxWidth: 840, margin: "45px auto", padding: 22 }}>
        <h1>결제 준비를 완료할 수 없습니다</h1>
        <p>강사 지역과 수강 조건에 맞는 가격표 또는 할인정보를 확인할 수 없습니다. 결제는 진행되지 않았습니다.</p>
        <Link href={home}>수강신청 현황으로 이동</Link>
      </main>
    );
  }

  const pricing = pricingResult.data;
  const schedule = `${(request.preferred_days ?? []).map((day) => weekdayNames[day] ?? day).join(" · ")}
     / 희망시간 ${(request.preferred_time_candidates ?? []).join(" / ")} (결제 후 관리자 확정)`;
  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(180deg,#f5f8ff 0%,#fff 56%)" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "30px 18px 85px" }}>
        <Link href={home} style={{ color: "#475467", fontWeight: 800 }}>← 수강신청 현황</Link>
        <header style={{
          padding: "17px 26px", marginTop: 10,
          background: "linear-gradient(120deg,#0a1f44,#3978ef)",
          color: "white", borderRadius: 18,
        }}>
          <span style={{ fontSize: 11, letterSpacing: 1.4, color: "#c7d9ff" }}>TALKLY PAYMENT</span>
          <h1 style={{ margin: "5px 0 0", fontSize: "clamp(21px, 2.6vw, 28px)", lineHeight: 1.25 }}>
            수강료 결제 · 관리자 강사 배정
          </h1>
        </header>
        <p style={{ fontSize: 12, color: "#52617a", margin: "12px 2px 0", lineHeight: 1.6 }}>
          신청번호 {request.application_number ?? request.id} · 결제 완료 후 관리자가 학생 수준과 강사 일정을 확인해 배정합니다.
        </p>
        <PaymentPreparation
          requestId={request.id}
          childId={childId}
          childName={studentName}
          courseName={courseResult.data.name}
          teacherName="관리자 배정 예정"
          teacherNationality={null}
          schedule={schedule}
          assignedDays={request.preferred_days ?? []}
          lessonDurationMinutes={request.lesson_duration_minutes}
          lessonsPerWeek={request.lessons_per_week}
          pricing={{
            id: pricing.id,
            pricingCategory: pricing.pricing_category,
            pricePerLesson: Number(pricing.price_per_lesson),
            monthlyLessonCount: Number(pricing.monthly_lesson_count ?? 0),
            weekendMultiplier: Number(pricing.weekend_multiplier),
          }}
          discountPolicies={discountsResult.data.map((policy) => ({
            id: policy.id,
            durationMonths: policy.duration_months,
            discountRate: Number(policy.discount_rate),
          }))}
          savedSelection={{ durationMonths: request.duration_months, finalPrice: request.final_price }}
        />
      </div>
    </main>
  );
}
