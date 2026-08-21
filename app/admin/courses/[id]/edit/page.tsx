import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import EditCourseForm from "./EditCourseForm";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditCoursePage({
  params,
}: PageProps) {
  const { id } = await params;

  const courseId = Number(id);

  if (
    !Number.isInteger(courseId) ||
    courseId <= 0
  ) {
    notFound();
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (
    profileError ||
    !profile ||
    profile.role !== "admin"
  ) {
    redirect("/");
  }

  /*
   * 과정 정보 조회
   *
   * 신규 추가된 분류 컬럼도 함께 조회합니다.
   */
  const {
    data: course,
    error: courseError,
  } = await supabase
    .from("courses")
    .select(`
      id,
      name,
      description,
      course_type,
      target_group,
      subject_category,
      level,
      class_format,
      duration_minutes,
      lessons_per_week,
      total_lessons,
      duration_weeks,
      price,
      is_active,
      created_at,
      updated_at
    `)
    .eq("id", courseId)
    .maybeSingle();

  if (courseError) {
    throw new Error(
      courseError.message
    );
  }

  if (!course) {
    notFound();
  }

  /*
   * 삭제 가능 여부 확인
   *
   * 아래 3개 테이블은 courses를 RESTRICT로
   * 참조하고 있으므로 하나라도 연결되어 있으면
   * 과정을 영구 삭제할 수 없습니다.
   *
   * course_pricing은 CASCADE이므로
   * 삭제 차단 대상은 아니지만 현황은 표시합니다.
   */
  const [
    enrollmentsResult,
    requestsResult,
    optionsResult,
    pricingResult,
  ] = await Promise.all([
    supabase
      .from("enrollments")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq(
        "course_id",
        courseId
      ),

    supabase
      .from(
        "enrollment_requests"
      )
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq(
        "course_id",
        courseId
      ),

    supabase
      .from(
        "enrollment_options"
      )
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq(
        "course_id",
        courseId
      ),

    supabase
      .from("course_pricing")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq(
        "course_id",
        courseId
      ),
  ]);

  const countError =
    enrollmentsResult.error ||
    requestsResult.error ||
    optionsResult.error ||
    pricingResult.error;

  if (countError) {
    throw new Error(
      countError.message
    );
  }

  const usageCounts = {
    enrollments:
      enrollmentsResult.count ??
      0,

    enrollmentRequests:
      requestsResult.count ??
      0,

    enrollmentOptions:
      optionsResult.count ??
      0,

    coursePricing:
      pricingResult.count ??
      0,
  };

  const canDelete =
    usageCounts.enrollments ===
      0 &&
    usageCounts
      .enrollmentRequests ===
      0 &&
    usageCounts
      .enrollmentOptions ===
      0;

  return (
    <main
      style={{
        width: "100%",
        maxWidth: "980px",
        margin: "0 auto",
        padding:
          "54px 42px 90px",
      }}
    >
      <Link
        href={`/admin/courses/${course.id}`}
        style={{
          color: "#667085",
          textDecoration: "none",
          fontSize: "13px",
          fontWeight: 800,
        }}
      >
        ← 과정 상세
      </Link>

      <div
        style={{
          marginTop: "22px",
          display: "flex",
          justifyContent:
            "space-between",
          alignItems:
            "flex-start",
          gap: "20px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              color: "#2f6fed",
              fontSize: "12px",
              fontWeight: 900,
              letterSpacing:
                "0.08em",
            }}
          >
            COURSE MANAGEMENT
          </div>

          <h1
            style={{
              margin:
                "10px 0 0",
              color: "#101828",
              fontSize: "36px",
              lineHeight: 1.2,
              letterSpacing:
                "-0.04em",
            }}
          >
            과정 수정
          </h1>

          <p
            style={{
              margin:
                "13px 0 0",
              color: "#667085",
              fontSize: "15px",
              lineHeight: 1.7,
            }}
          >
            <strong
              style={{
                color:
                  "#344054",
              }}
            >
              {course.name}
            </strong>{" "}
            과정의 학습 분류,
            수업조건 및 운영 상태를
            관리합니다.
          </p>
        </div>

        <span
          style={{
            minHeight: "30px",
            padding: "0 10px",
            display:
              "inline-flex",
            alignItems: "center",
            borderRadius:
              "999px",
            background:
              course.is_active
                ? "#ecfdf3"
                : "#f2f4f7",
            color:
              course.is_active
                ? "#027a48"
                : "#667085",
            fontSize: "11px",
            fontWeight: 900,
          }}
        >
          {course.is_active
            ? "활성 과정"
            : "비활성 과정"}
        </span>
      </div>

      <EditCourseForm
        course={course}
        canDelete={canDelete}
        usageCounts={
          usageCounts
        }
      />
    </main>
  );
}